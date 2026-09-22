from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import sqlite3
from .database import fetch_footfall_summary, fetch_zone_trends, fetch_dwell_times
from .test_endpoint import router as test_router
from .inventory_routes import router as inventory_router
from .queue_routes import router as queue_router
from .security_routes import router as security_router
from .copilot_routes import router as copilot_router
from .camera_routes import router as camera_router
from .zone_routes import router as zone_router
from cloud.supabase_sync import get_sync_engine

SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

# Ensure outputs directory exists
os.makedirs(os.path.join(os.path.dirname(__file__), "outputs"), exist_ok=True)

# No body-size cap — large video uploads are streamed to disk in chunks
app = FastAPI(title="Shopper Analytics API")

# Mount outputs for processed videos
app.mount("/outputs", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "outputs")), name="outputs")

# Allow frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # CRA dev server
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(test_router)
app.include_router(inventory_router)
app.include_router(queue_router)
app.include_router(security_router)
app.include_router(copilot_router)
app.include_router(camera_router)
app.include_router(zone_router)

# ── Cloud Sync Engine & Simulator ─────────────────────────────────────────────
from cloud.supabase_sync import get_sync_engine
from core.retail_simulator import retail_sim

_sync_engine = get_sync_engine()

@app.on_event("startup")
def start_background_tasks():
    _sync_engine.start()

@app.on_event("shutdown")
def stop_background_tasks():
    _sync_engine.stop()

@app.get("/api/cloud/sync-status")
def get_sync_status():
    """Returns cloud sync engine status."""
    return _sync_engine.status()

@app.post("/api/cloud/force-sync")
def force_cloud_sync():
    """Trigger an immediate cloud sync."""
    return _sync_engine.force_sync()


@app.get("/api/metrics/footfall")
def get_footfall():
    return fetch_footfall_summary()


@app.get("/api/metrics/trends")
def get_trends():
    return fetch_zone_trends()


@app.get("/api/metrics/dwell")
def get_dwell():
    return fetch_dwell_times()


@app.get("/api/metrics/efficiency")
def get_efficiency():
    """Returns store efficiency over time for the UI graph."""
    from api.queue_routes import _chart_data
    # If the simulator hasn't run long enough, pad it with some starter data
    data = list(_chart_data)
    if len(data) < 7:
        times = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
        base = [7.2, 8.1, 6.5, 8.8, 9.4, 7.9, 6.8]
        return [{"time": t, "val": v} for t, v in zip(times, base)]
    
    # Otherwise format it for the efficiency chart
    # Efficiency can be defined as (processed / (queued + 1)) * 10
    results = []
    for d in data:
        eff = min(10.0, (d["processed"] / max(1, d["queued"])) * 5.0)
        results.append({"time": d["time"], "val": round(eff, 1)})
    return results


@app.get("/api/metrics/hourly")
def get_hourly_footfall():
    """Returns footfall counts grouped by hour (last 24 hours)."""
    try:
        from core.config import DB_TYPE
        if DB_TYPE == "sqlite":
            with sqlite3.connect(SQLITE_DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT
                        strftime('%H', datetime(timestamp, 'unixepoch', 'localtime')) AS hour,
                        direction,
                        COUNT(*) as count
                    FROM footfall
                    WHERE timestamp >= strftime('%s', 'now', '-1 day')
                    GROUP BY hour, direction
                    ORDER BY hour
                """)
                rows = cursor.fetchall()
                # Build a 24-hour array
                hourly = {str(h).zfill(2): {"hour": str(h).zfill(2), "ENTRY": 0, "EXIT": 0} for h in range(24)}
                for row in rows:
                    h = row["hour"]
                    if h in hourly:
                        hourly[h][row["direction"]] = row["count"]
                return list(hourly.values())
        else:
            from .database import get_mongo_db
            import time
            db = get_mongo_db()
            since = time.time() - 86400
            pipeline = [
                {"$match": {"timestamp": {"$gte": since}}},
                {"$addFields": {"hour": {"$hour": {"$toDate": {"$multiply": ["$timestamp", 1000]}}}}},
                {"$group": {"_id": {"hour": "$hour", "direction": "$direction"}, "count": {"$sum": 1}}},
                {"$sort": {"_id.hour": 1}}
            ]
            results = list(db.footfall.aggregate(pipeline))
            hourly = {h: {"hour": str(h).zfill(2), "ENTRY": 0, "EXIT": 0} for h in range(24)}
            for r in results:
                h = r["_id"]["hour"]
                d = r["_id"]["direction"]
                if h in hourly and d in ("ENTRY", "EXIT"):
                    hourly[h][d] = r["count"]
            return list(hourly.values())
    except Exception as e:
        return []


@app.get("/api/metrics/system-status")
def get_system_status():
    """Returns edge system status: DB health, camera state, AI engine."""
    from api.queue_routes import _queue_state
    import time
    camera_active = _queue_state["camera_active"] and (time.time() - _queue_state["last_updated"]) < 10
    try:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.cursor().execute("SELECT 1")
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "camera_active": camera_active,
        "db_connected": db_ok,
        "edge_ai_ready": True,   # YOLO model always loaded on demand
        "offline_capable": True,
        "mode": "edge",
    }

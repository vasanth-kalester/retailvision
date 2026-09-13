"""
Queue Intelligence API — edge-first, in-memory queue state.
The live WebSocket stream writes queue state via update_queue_state().
"""
import time
from collections import deque
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/queue", tags=["queue"])

# ── In-memory queue state (reset on server restart — edge device behavior) ──
_queue_state = {
    "checkout_count": 0,           # current persons detected in checkout zone
    "peak_today": 0,               # peak queue length today
    "last_updated": 0.0,           # epoch timestamp of last camera update
    "camera_active": False,        # whether the stream is currently running
    "total_customers_served": 0,   # incremented when queue shrinks
}

# Rolling 5-minute history (one entry per second sampled)
_queue_history: deque = deque(maxlen=300)

# Configurable threshold — open new lane when queue exceeds this
QUEUE_ALERT_THRESHOLD = 5

def update_queue_state(count: int):
    """Called by the WebSocket stream on every processed frame."""
    now = time.time()
    prev_count = _queue_state["checkout_count"]

    _queue_state["checkout_count"] = count
    _queue_state["last_updated"] = now
    _queue_state["camera_active"] = True

    if count > _queue_state["peak_today"]:
        _queue_state["peak_today"] = count

    # Rough customer-served heuristic: queue shrank by ≥2
    if prev_count - count >= 2:
        _queue_state["total_customers_served"] += (prev_count - count)

    _queue_history.append({"t": now, "count": count})


def mark_camera_inactive():
    """Called when stream closes."""
    _queue_state["camera_active"] = False


@router.get("/status")
def get_queue_status():
    count = _queue_state["checkout_count"]
    stale = (time.time() - _queue_state["last_updated"]) > 10

    # Predictive Surge Logic (Check footfall over last 3 mins)
    surge_forecast = False
    net_inflow = 0
    try:
        from core.config import DB_TYPE
        import sqlite3, os
        if DB_TYPE == "sqlite" and not stale:
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")
            with sqlite3.connect(db_path) as conn:
                cur = conn.cursor()
                three_mins_ago = time.time() - 180
                cur.execute(f"SELECT direction, COUNT(*) FROM footfall WHERE timestamp >= {three_mins_ago} GROUP BY direction")
                rows = cur.fetchall()
                entries = sum(r[1] for r in rows if r[0] == "ENTRY")
                exits = sum(r[1] for r in rows if r[0] == "EXIT")
                net_inflow = entries - exits
                # If 4 or more people entered than left in 3 mins, predict queue build-up
                if net_inflow >= 4 and count < QUEUE_ALERT_THRESHOLD:
                    surge_forecast = True
    except Exception:
        pass

    if stale:
        status = "no_data"
        recommendation = "Start camera stream for live queue monitoring."
    elif count > QUEUE_ALERT_THRESHOLD:
        status = "high"
        recommendation = f"⚠️ High queue ({count} customers)! Open an additional billing counter immediately."
    elif surge_forecast:
        status = "surge_predicted"
        recommendation = f"📈 Surge Forecast: Rapid inflow detected (+{net_inflow} shoppers). Expect checkout congestion soon. Prepare Lane 2."
    elif count == 0:
        status = "clear"
        recommendation = "Queue is clear. Optimal customer experience."
    elif count <= 2:
        status = "low"
        recommendation = "Low queue. Maintain current staffing."
    else:
        status = "moderate"
        recommendation = f"Moderate queue ({count} customers). Monitor closely."

    # Compute avg from recent 60 samples (~last 60 sec)
    recent = list(_queue_history)[-60:] if _queue_history else []
    avg_recent = round(sum(e["count"] for e in recent) / max(len(recent), 1), 1)

    # Build a compact sparkline (last 30 samples, 1 per entry)
    sparkline = [e["count"] for e in list(_queue_history)[-30:]]

    return JSONResponse({
        "checkout_count": count,
        "status": status,
        "recommendation": recommendation,
        "peak_today": _queue_state["peak_today"],
        "avg_last_minute": avg_recent,
        "total_served": _queue_state["total_customers_served"],
        "camera_active": _queue_state["camera_active"] and not stale,
        "sparkline": sparkline,
        "alert_threshold": QUEUE_ALERT_THRESHOLD,
        "surge_predicted": surge_forecast
    })



@router.get("/history")
def get_queue_history():
    """Returns last 5 minutes of queue counts (for charts)."""
    history = list(_queue_history)
    return JSONResponse({"history": history})

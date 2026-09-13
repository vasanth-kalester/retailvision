from fastapi import APIRouter
from fastapi.responses import JSONResponse
import time
import sqlite3
import os
from core.config import DB_TYPE

router = APIRouter(prefix="/api/security", tags=["security"])

@router.get("/alerts")
def get_security_alerts():
    """Returns active security alerts (loitering)."""
    alerts = []
    try:
        if DB_TYPE == "sqlite":
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                # Get alerts from the last 15 minutes
                fifteen_mins_ago = time.time() - 900
                cur.execute(f"SELECT * FROM security_alerts WHERE timestamp >= {fifteen_mins_ago} ORDER BY timestamp DESC LIMIT 5")
                rows = cur.fetchall()
                for row in rows:
                    alerts.append({
                        "id": f"sec-{row['id']}",
                        "timestamp": row['timestamp'],
                        "track_id": row['track_id'],
                        "duration": row['duration'],
                        "alert_type": row['alert_type']
                    })
    except Exception as e:
        print(f"Error fetching security alerts: {e}")
        pass

    return JSONResponse({"alerts": alerts})

"""
Queue Intelligence API — edge-first, in-memory queue state.
"""
import time
from collections import deque
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import datetime

from pydantic import BaseModel

router = APIRouter(prefix="/api/queue", tags=["queue"])

class QueueUpdate(BaseModel):
    queue_persons: int


# ── In-memory detailed lane state ──
_lane_state = [
    {"id": "Lane 01", "type": "Regular", "status": "NORMAL", "queue_depth": 2, "estimated_wait": 1.2, "items_per_min": 22, "cashier": "Marco P."},
    {"id": "Lane 02", "type": "Regular", "status": "NORMAL", "queue_depth": 1, "estimated_wait": 0.8, "items_per_min": 18, "cashier": "Elena R."},
    {"id": "Lane 03", "type": "Express", "status": "NORMAL", "queue_depth": 0, "estimated_wait": 0.0, "items_per_min": 34, "cashier": "Jason T."},
    {"id": "Zone 04", "type": "SCO Bank A", "status": "BALANCED", "queue_depth": 3, "estimated_wait": 1.1, "items_per_min": 0, "cashier": "David K."},
    {"id": "Lane 05", "type": "Regular", "status": "STANDBY", "queue_depth": 0, "estimated_wait": 0.0, "items_per_min": 20, "cashier": "-"},
    {"id": "Lane 06", "type": "Regular", "status": "STANDBY", "queue_depth": 0, "estimated_wait": 0.0, "items_per_min": 20, "cashier": "-"},
    {"id": "Lane 07", "type": "Regular", "status": "STANDBY", "queue_depth": 0, "estimated_wait": 0.0, "items_per_min": 20, "cashier": "-"},
    {"id": "Lane 08", "type": "Regular", "status": "STANDBY", "queue_depth": 0, "estimated_wait": 0.0, "items_per_min": 20, "cashier": "-"},
]
for l in _lane_state:
    l["processed_count"] = 0

_queue_history: deque = deque(maxlen=300)
_chart_data: deque = deque(maxlen=24) # Historical points for the UI graph

# ── Camera state tracker (used by main.py system-status) ──
_queue_state = {
    "camera_active": False,
    "last_updated": 0.0,
}

def update_global_queue_state(total_waiting: int):
    now = time.time()
    _queue_history.append({"t": now, "count": total_waiting})
    
    # Periodically append to chart data (e.g. every 10 ticks = 30s)
    if len(_queue_history) % 10 == 0:
        time_str = datetime.datetime.now().strftime("%I:%M %p")
        processed = sum(l["processed_count"] for l in _lane_state)
        
        # Keep chart data moving by simulating past time points if empty
        _chart_data.append({"time": time_str, "queued": total_waiting, "processed": processed})
        
        # reset processed count to form a differential for the next window
        for l in _lane_state:
            l["processed_count"] = 0

def update_queue_state(queue_persons: int):
    """Called by the live camera WebSocket to update queue state from CV detections."""
    _queue_state["camera_active"] = True
    _queue_state["last_updated"] = time.time()

    # Distribute detected persons across active lanes
    active_lanes = [l for l in _lane_state if l["status"] != "STANDBY"]
    if not active_lanes:
        _lane_state[0]["status"] = "NORMAL"
        active_lanes = [_lane_state[0]]

    # Reset active lane depths and redistribute
    per_lane = max(0, queue_persons // len(active_lanes))
    remainder = max(0, queue_persons % len(active_lanes))

    for i, lane in enumerate(active_lanes):
        lane["queue_depth"] = per_lane + (1 if i < remainder else 0)
        depth = lane["queue_depth"]
        items_per_min = lane["items_per_min"] or 20
        wait_per_person = 10.0 / items_per_min
        lane["estimated_wait"] = round(depth * wait_per_person, 1)
        if lane["estimated_wait"] > 3.0 or depth > 5:
            lane["status"] = "CONGESTED"
        else:
            lane["status"] = "BALANCED" if "SCO" in lane["type"] else "NORMAL"

    total_waiting = sum(l["queue_depth"] for l in _lane_state)
    update_global_queue_state(total_waiting)

def mark_camera_inactive():
    """Called when the camera WebSocket disconnects."""
    _queue_state["camera_active"] = False

@router.get("/status")
def get_queue_status():
    total_count = sum(l["queue_depth"] for l in _lane_state)
    active_lanes = sum(1 for l in _lane_state if l["status"] != "STANDBY")
    
    # Check for congested lanes to trigger alerts
    congested_lanes = [l for l in _lane_state if l["status"] == "CONGESTED"]

    # Compute avg wait of active lanes
    active_wait_times = [l["estimated_wait"] for l in _lane_state if l["status"] != "STANDBY"]
    avg_wait = sum(active_wait_times) / max(len(active_wait_times), 1) if active_wait_times else 0

    return {
        "status": "high" if congested_lanes else "normal",
        "checkout_count": total_count,
        "active_lanes": active_lanes,
        "avg_wait": avg_wait,
        "surge_predicted": total_count > 15,
        "lanes": _lane_state,
        "chart_data": list(_chart_data)
    }

@router.get("/history")
def get_queue_history():
    """Returns last 5 minutes of queue counts (for charts)."""
    history = list(_queue_history)
    return JSONResponse({"history": history})

@router.post("/update")
def post_queue_update(data: QueueUpdate):
    """Receive live queue depth updates from main.py."""
    update_queue_state(data.queue_persons)
    return {"status": "ok"}


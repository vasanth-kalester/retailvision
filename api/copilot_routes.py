import time
import sqlite3
import os
from fastapi import APIRouter
from pydantic import BaseModel
from api.queue_routes import get_queue_status

router = APIRouter(prefix="/api/copilot", tags=["copilot"])

class ChatRequest(BaseModel):
    message: str

def _get_store_context():
    """Gathers all live edge data to act as context for the Copilot."""
    context = {}
    
    # 1. Queue Status
    try:
        import json
        queue_resp = get_queue_status()
        context['queue'] = json.loads(queue_resp.body.decode('utf-8'))
    except:
        pass

    # 2. Footfall & Zones
    try:
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")
        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            # Busiest zone
            fifteen_mins_ago = time.time() - 900
            cur.execute(f"SELECT zone_name, SUM(occupancy_count) as total FROM zone_metrics WHERE timestamp >= {fifteen_mins_ago} GROUP BY zone_name ORDER BY total DESC LIMIT 1")
            row = cur.fetchone()
            if row:
                context['busiest_zone'] = row[0]
            
            # Security alerts
            cur.execute(f"SELECT COUNT(*) FROM security_alerts WHERE timestamp >= {fifteen_mins_ago}")
            sec_count = cur.fetchone()[0]
            context['security_alerts'] = sec_count
            
            # Total footfall today
            today_start = time.time() - (time.time() % 86400)
            cur.execute(f"SELECT COUNT(*) FROM footfall WHERE direction='ENTRY' AND timestamp >= {today_start}")
            context['footfall_today'] = cur.fetchone()[0]
    except:
        pass
        
    return context

@router.post("/chat")
def copilot_chat(req: ChatRequest):
    """
    Simulated LLM endpoint that processes natural language queries 
    against the live edge analytics state.
    """
    msg = req.message.lower()
    ctx = _get_store_context()
    
    response = ""
    
    # NLP Keyword Routing Engine
    if "queue" in msg or "staff" in msg or "counter" in msg or "checkout" in msg:
        q = ctx.get('queue', {})
        if q.get('surge_predicted'):
            response = f"I predict a surge at checkout very soon! There's a high influx of shoppers right now. Currently {q.get('checkout_count', 0)} in line. I strongly recommend opening another counter."
        elif q.get('status') == 'high':
            response = f"The checkout queue is currently high with {q.get('checkout_count')} customers waiting. You should open an additional billing counter immediately."
        elif q.get('status') == 'clear':
            response = "The checkout queue is completely clear right now. Optimal customer experience."
        else:
            response = f"The checkout queue is manageable right now ({q.get('checkout_count', 0)} waiting). Average wait time is low."

    elif "busy" in msg or "busiest" in msg or "zone" in msg or "where" in msg:
        zone = ctx.get('busiest_zone', 'the main floor')
        response = f"Based on the last 15 minutes of heatmap data, **{zone}** is currently the busiest section of the store."
        
    elif "security" in msg or "alert" in msg or "loiter" in msg or "theft" in msg or "suspicious" in msg:
        sec_count = ctx.get('security_alerts', 0)
        if sec_count > 0:
            response = f"⚠️ Alert: I have detected **{sec_count} suspicious loitering incidents** in the last 15 minutes. Please check the Alerts panel for specific tracking IDs."
        else:
            response = "All clear. I haven't detected any suspicious loitering or security alerts recently."
            
    elif "footfall" in msg or "many" in msg or "people" in msg or "total" in msg:
        count = ctx.get('footfall_today', 0)
        response = f"We have had **{count} total entries** today. The edge cameras are actively tracking new arrivals."
        
    elif "hello" in msg or "hi" in msg or "help" in msg:
        response = "Hello! I am your Retail Edge Copilot. Ask me about the **checkout queue**, the **busiest zones**, **total footfall**, or **security alerts**."
        
    else:
        response = "I'm analyzing the edge data... but I didn't quite catch that. You can ask me about the queue status, busiest zones, footfall, or active security alerts."
        
    # Simulate LLM thinking delay
    time.sleep(0.5)
    
    return {"reply": response}

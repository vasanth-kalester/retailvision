import sqlite3
import os
from typing import List, Dict, Any

# Path relative to the script location assuming it runs from project root
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

def get_connection():
    # Use URI to open in read-only mode if possible, but standard connect is fine for simple queries
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_footfall_summary() -> Dict[str, int]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT direction, COUNT(*) as count FROM footfall GROUP BY direction")
            rows = cursor.fetchall()
            
            summary = {"ENTRY": 0, "EXIT": 0}
            for row in rows:
                if row['direction'] in summary:
                    summary[row['direction']] = row['count']
            return summary
    except Exception as e:
        print(f"DB Error: {e}")
        return {"ENTRY": 0, "EXIT": 0}

def fetch_zone_trends(limit: int = 50) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            # Fetch the latest metrics, grouped by timestamp and zone
            cursor.execute("""
                SELECT timestamp, zone_name, occupancy_count 
                FROM zone_metrics 
                ORDER BY timestamp DESC 
                LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            
            trends = []
            for row in rows:
                trends.append({
                    "timestamp": row['timestamp'],
                    "zone_name": row['zone_name'],
                    "occupancy_count": row['occupancy_count']
                })
            # Reverse to chronological order for charts
            return trends[::-1]
    except Exception:
        return []

def fetch_dwell_times() -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT promo_zone, AVG(dwell_duration) as avg_duration, COUNT(*) as visitor_count
                FROM dwell_times
                GROUP BY promo_zone
            """)
            rows = cursor.fetchall()
            
            dwells = []
            for row in rows:
                dwells.append({
                    "promo_zone": row['promo_zone'],
                    "avg_duration": round(row['avg_duration'], 2),
                    "visitor_count": row['visitor_count']
                })
            return dwells
    except Exception:
        return []

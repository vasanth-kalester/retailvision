import os
import sqlite3
from typing import List, Dict, Any
from pymongo import MongoClient
from core.config import DB_TYPE

DB_URI = "mongodb://localhost:27017/"
MONGO_DB_NAME = "shopper_analytics"
SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

def get_mongo_db():
    client = MongoClient(DB_URI)
    return client[MONGO_DB_NAME]

def fetch_footfall_summary() -> Dict[str, int]:
    summary = {"ENTRY": 0, "EXIT": 0}
    try:
        if DB_TYPE == "mongodb":
            db = get_mongo_db()
            pipeline = [
                {"$group": {"_id": "$direction", "count": {"$sum": 1}}}
            ]
            results = list(db.footfall.aggregate(pipeline))
            for res in results:
                direction = res["_id"]
                if direction in summary:
                    summary[direction] = res["count"]
        else:
            with sqlite3.connect(SQLITE_DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT direction, COUNT(*) as count FROM footfall GROUP BY direction")
                for row in cursor.fetchall():
                    if row['direction'] in summary:
                        summary[row['direction']] = row['count']
        return summary
    except Exception as e:
        print(f"DB Error: {e}")
        return summary

def fetch_zone_trends(limit: int = 50) -> List[Dict[str, Any]]:
    try:
        if DB_TYPE == "mongodb":
            db = get_mongo_db()
            cursor = db.zone_metrics.find(
                {}, 
                {"_id": 0, "timestamp": 1, "zone_name": 1, "occupancy_count": 1}
            ).sort("timestamp", -1).limit(limit)
            
            results = list(cursor)
            trends = []
            for row in results:
                trends.append({
                    "timestamp": row.get('timestamp'),
                    "zone_name": row.get('zone_name'),
                    "occupancy_count": row.get('occupancy_count')
                })
            return trends[::-1]
        else:
            with sqlite3.connect(SQLITE_DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT timestamp, zone_name, occupancy_count FROM zone_metrics ORDER BY timestamp DESC LIMIT ?", (limit,))
                results = cursor.fetchall()
                trends = []
                for row in results:
                    trends.append({
                        "timestamp": row['timestamp'],
                        "zone_name": row['zone_name'],
                        "occupancy_count": row['occupancy_count']
                    })
                return trends[::-1]
    except Exception:
        return []

def fetch_dwell_times() -> List[Dict[str, Any]]:
    try:
        if DB_TYPE == "mongodb":
            db = get_mongo_db()
            pipeline = [
                {
                    "$group": {
                        "_id": "$promo_zone",
                        "avg_duration": {"$avg": "$dwell_duration"},
                        "visitor_count": {"$sum": 1}
                    }
                }
            ]
            results = list(db.dwell_times.aggregate(pipeline))
            dwells = []
            for row in results:
                dwells.append({
                    "promo_zone": row.get('_id'),
                    "avg_duration": round(row.get('avg_duration', 0), 2),
                    "visitor_count": row.get('visitor_count', 0)
                })
            return dwells
        else:
            with sqlite3.connect(SQLITE_DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT promo_zone, AVG(dwell_duration) as avg_duration, COUNT(*) as visitor_count
                    FROM dwell_times
                    GROUP BY promo_zone
                """)
                results = cursor.fetchall()
                dwells = []
                for row in results:
                    dwells.append({
                        "promo_zone": row['promo_zone'],
                        "avg_duration": round(row['avg_duration'], 2),
                        "visitor_count": row['visitor_count']
                    })
                return dwells
    except Exception:
        return []

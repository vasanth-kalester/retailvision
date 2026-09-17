import threading
import queue
import time
import os
import sqlite3
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from core.config import DB_TYPE

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

class MongoStoreDatabase:
    def __init__(self, uri="mongodb://localhost:27017/", db_name="shopper_analytics"):
        self.uri = uri
        self.db_name = db_name
        self.client = MongoClient(self.uri)
        self.db = self.client[self.db_name]
        
        # Initialize collections
        self.footfall = self.db["footfall"]
        self.zone_metrics = self.db["zone_metrics"]
        self.dwell_times = self.db["dwell_times"]
        self.customer_journeys = self.db["customer_journeys"]
        self.staff_interactions = self.db["staff_interactions"]
        self.demographics = self.db["demographics"]

        self.write_queue = queue.Queue()
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()

    def _worker(self):
        while True:
            task = self.write_queue.get()
            if task is None:
                break
            collection_name, document = task
            try:
                self.db[collection_name].insert_one(document)
            except PyMongoError as e:
                print(f"[Mongo DB Error] {e}")
            finally:
                self.write_queue.task_done()

    def log_footfall(self, track_id: int, direction: str):
        document = {
            "timestamp": time.time(),
            "track_id": track_id,
            "direction": direction
        }
        self.write_queue.put(("footfall", document))

    def log_zone_metrics(self, zone_name: str, count: int):
        document = {
            "timestamp": time.time(),
            "zone_name": zone_name,
            "occupancy_count": count
        }
        self.write_queue.put(("zone_metrics", document))

    def log_dwell_time(self, track_id: int, promo_zone: str, entry_time: float, exit_time: float, duration: float):
        document = {
            "track_id": track_id,
            "promo_zone": promo_zone,
            "entry_time": entry_time,
            "exit_time": exit_time,
            "dwell_duration": duration
        }
        self.write_queue.put(("dwell_times", document))

    def log_security_alert(self, track_id: int, duration: float):
        document = {
            "timestamp": time.time(),
            "track_id": track_id,
            "duration": duration,
            "alert_type": "loitering"
        }
        self.write_queue.put(("security_alerts", document))

    def log_journey(self, track_id: int, journey_path: list):
        document = {
            "track_id": track_id,
            "timestamp": time.time(),
            "path": journey_path
        }
        self.write_queue.put(("customer_journeys", document))

    def log_staff_interaction(self, staff_id: int, shopper_id: int, duration: float):
        document = {
            "timestamp": time.time(),
            "staff_id": staff_id,
            "shopper_id": shopper_id,
            "duration": duration
        }
        self.write_queue.put(("staff_interactions", document))

    def log_demographics(self, track_id: int, age: str, gender: str):
        document = {
            "track_id": track_id,
            "timestamp": time.time(),
            "age": age,
            "gender": gender
        }
        self.write_queue.put(("demographics", document))

    def log_video_analysis(self, filename: str, duration_sec: float, unique_visitors: int, insights: list):
        document = {
            "timestamp": time.time(),
            "filename": filename,
            "duration_sec": duration_sec,
            "unique_visitors": unique_visitors,
            "insights": insights
        }
        self.write_queue.put(("video_analysis_metadata", document))

    def shutdown(self):
        self.write_queue.put(None)
        self.worker_thread.join()

    def generate_insights(self) -> list:
        insights = []
        try:
            pipeline = [{"$match": {"direction": "ENTRY"}}, {"$count": "count"}]
            result = list(self.footfall.aggregate(pipeline))
            total_entries = result[0]["count"] if result else 0
            
            if total_entries > 0:
                insights.append(f"Store has seen {total_entries} total entries. Ensure adequate staffing at checkout counters.")
            
            dwell_pipeline = [
                {
                    "$group": {
                        "_id": "$promo_zone",
                        "avg_duration": {"$avg": "$dwell_duration"},
                        "visitor_count": {"$sum": 1}
                    }
                }
            ]
            dwell_data = list(self.dwell_times.aggregate(dwell_pipeline))
            
            for row in dwell_data:
                zone = row['_id']
                avg_dur = row['avg_duration']
                visitors = row['visitor_count']
                
                if visitors < (total_entries * 0.1):
                    insights.append(f"[Alert] {zone}: Very low engagement ({visitors} visitors). Consider relocating this display to a higher-traffic area.")
                elif avg_dur < 10.0:
                    insights.append(f"[Warning] {zone}: High traffic but low average dwell time ({avg_dur:.1f}s). The promotion may not be compelling enough to hold shopper attention.")
                else:
                    insights.append(f"[Positive] {zone}: Strong performance. High engagement and healthy dwell time ({avg_dur:.1f}s). Replicate this setup in other zones.")
        except Exception as e:
            insights.append(f"Could not generate insights due to error: {e}")
        return insights


class SQLiteStoreDatabase:
    def __init__(self, db_path=DB_PATH):
        self.db_path = db_path
        self.write_queue = queue.Queue()
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self._init_db()
        self.worker_thread.start()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS footfall (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL,
                    track_id INTEGER,
                    direction TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS zone_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL,
                    zone_name TEXT,
                    occupancy_count INTEGER
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dwell_times (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id INTEGER,
                    promo_zone TEXT,
                    entry_time REAL,
                    exit_time REAL,
                    dwell_duration REAL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS security_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL,
                    track_id INTEGER,
                    duration REAL,
                    alert_type TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS customer_journeys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id INTEGER,
                    timestamp REAL,
                    path TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS staff_interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL,
                    staff_id INTEGER,
                    shopper_id INTEGER,
                    duration REAL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS demographics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id INTEGER,
                    timestamp REAL,
                    age TEXT,
                    gender TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS video_analysis_metadata (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL,
                    filename TEXT,
                    duration_sec REAL,
                    unique_visitors INTEGER,
                    insights TEXT
                )
            """)
            conn.commit()

    def _worker(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            while True:
                task = self.write_queue.get()
                if task is None:
                    break
                query, args = task
                try:
                    cursor.execute(query, args)
                    conn.commit()
                except sqlite3.Error as e:
                    print(f"[SQLite DB Error] {e}")
                finally:
                    self.write_queue.task_done()

    def log_footfall(self, track_id: int, direction: str):
        query = "INSERT INTO footfall (timestamp, track_id, direction) VALUES (?, ?, ?)"
        self.write_queue.put((query, (time.time(), track_id, direction)))

    def log_zone_metrics(self, zone_name: str, count: int):
        query = "INSERT INTO zone_metrics (timestamp, zone_name, occupancy_count) VALUES (?, ?, ?)"
        self.write_queue.put((query, (time.time(), zone_name, count)))

    def log_dwell_time(self, track_id: int, promo_zone: str, entry_time: float, exit_time: float, duration: float):
        query = "INSERT INTO dwell_times (track_id, promo_zone, entry_time, exit_time, dwell_duration) VALUES (?, ?, ?, ?, ?)"
        self.write_queue.put((query, (track_id, promo_zone, entry_time, exit_time, duration)))

    def log_security_alert(self, track_id: int, duration: float):
        query = "INSERT INTO security_alerts (timestamp, track_id, duration, alert_type) VALUES (?, ?, ?, ?)"
        self.write_queue.put((query, (time.time(), track_id, duration, "loitering")))

    def log_journey(self, track_id: int, journey_path: list):
        import json
        query = "INSERT INTO customer_journeys (track_id, timestamp, path) VALUES (?, ?, ?)"
        self.write_queue.put((query, (track_id, time.time(), json.dumps(journey_path))))

    def log_staff_interaction(self, staff_id: int, shopper_id: int, duration: float):
        query = "INSERT INTO staff_interactions (timestamp, staff_id, shopper_id, duration) VALUES (?, ?, ?, ?)"
        self.write_queue.put((query, (time.time(), staff_id, shopper_id, duration)))

    def log_demographics(self, track_id: int, age: str, gender: str):
        query = "INSERT INTO demographics (track_id, timestamp, age, gender) VALUES (?, ?, ?, ?)"
        self.write_queue.put((query, (track_id, time.time(), age, gender)))

    def log_video_analysis(self, filename: str, duration_sec: float, unique_visitors: int, insights: list):
        import json
        query = "INSERT INTO video_analysis_metadata (timestamp, filename, duration_sec, unique_visitors, insights) VALUES (?, ?, ?, ?, ?)"
        self.write_queue.put((query, (time.time(), filename, duration_sec, unique_visitors, json.dumps(insights))))

    def shutdown(self):
        self.write_queue.put(None)
        self.worker_thread.join()

    def generate_insights(self) -> list:
        insights = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("SELECT direction, COUNT(*) as count FROM footfall GROUP BY direction")
                footfall_data = cursor.fetchall()
                total_entries = sum(row['count'] for row in footfall_data if row['direction'] == 'ENTRY')
                
                if total_entries > 0:
                    insights.append(f"Store has seen {total_entries} total entries. Ensure adequate staffing at checkout counters.")
                
                cursor.execute("""
                    SELECT promo_zone, AVG(dwell_duration) as avg_duration, COUNT(*) as visitor_count
                    FROM dwell_times
                    GROUP BY promo_zone
                """)
                dwell_data = cursor.fetchall()
                
                for row in dwell_data:
                    zone = row['promo_zone']
                    avg_dur = row['avg_duration']
                    visitors = row['visitor_count']
                    
                    if visitors < (total_entries * 0.1):
                        insights.append(f"[Alert] {zone}: Very low engagement ({visitors} visitors). Consider relocating this display to a higher-traffic area.")
                    elif avg_dur < 10.0:
                        insights.append(f"[Warning] {zone}: High traffic but low average dwell time ({avg_dur:.1f}s). The promotion may not be compelling enough to hold shopper attention.")
                    else:
                        insights.append(f"[Positive] {zone}: Strong performance. High engagement and healthy dwell time ({avg_dur:.1f}s). Replicate this setup in other zones.")
        except Exception as e:
            insights.append(f"Could not generate insights due to error: {e}")
            
        return insights

# Global Instance based on DB_TYPE
if DB_TYPE == "sqlite":
    print("[Database] Using SQLite Backend")
    db = SQLiteStoreDatabase()
else:
    print("[Database] Using MongoDB Backend")
    db = MongoStoreDatabase()

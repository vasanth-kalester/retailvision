import sqlite3
import threading
import queue
import time
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

class StoreDatabase:
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
                    print(f"[DB Error] {e}")
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

    def shutdown(self):
        self.write_queue.put(None)
        self.worker_thread.join()

    def generate_insights(self) -> list:
        """
        Analyzes dwell times versus footfall ratios to output plain-language operational recommendations.
        """
        insights = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # 1. Total Footfall Assessment
                cursor.execute("SELECT direction, COUNT(*) as count FROM footfall GROUP BY direction")
                footfall_data = cursor.fetchall()
                total_entries = sum(row['count'] for row in footfall_data if row['direction'] == 'ENTRY')
                
                if total_entries > 0:
                    insights.append(f"Store has seen {total_entries} total entries. Ensure adequate staffing at checkout counters.")
                
                # 2. Dwell Time Analysis per Promotional Zone
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
                    
                    if visitors < (total_entries * 0.1): # Less than 10% of total visitors engaged
                        insights.append(f"[Alert] {zone}: Very low engagement ({visitors} visitors). Consider relocating this display to a higher-traffic area.")
                    elif avg_dur < 10.0:
                        insights.append(f"[Warning] {zone}: High traffic but low average dwell time ({avg_dur:.1f}s). The promotion may not be compelling enough to hold shopper attention.")
                    else:
                        insights.append(f"[Positive] {zone}: Strong performance. High engagement and healthy dwell time ({avg_dur:.1f}s). Replicate this setup in other zones.")
                        
        except Exception as e:
            insights.append(f"Could not generate insights due to error: {e}")
            
        return insights

# Global Instance
db = StoreDatabase()

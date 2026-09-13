import time
import os
import sqlite3
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from core.config import DB_TYPE

# MongoDB setup
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "shopper_analytics")

warehouse_coll = None
store_coll = None
replenish_coll = None
warehouse_alerts_coll = None
warehouse_shelves_coll = None

if DB_TYPE == "mongodb":
    client = MongoClient(MONGO_URI)
    _db = client[MONGO_DB_NAME]
    warehouse_coll = _db["warehouse_inventory"]
    store_coll = _db["store_inventory"]
    replenish_coll = _db["replenishment_requests"]
    warehouse_alerts_coll = _db["warehouse_alerts"]
    warehouse_shelves_coll = _db["warehouse_shelves"]

# SQLite setup
SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

def _init_sqlite():
    with sqlite3.connect(SQLITE_DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS warehouse_inventory (
                sku TEXT PRIMARY KEY,
                product_name TEXT,
                total_units INTEGER,
                safety_stock INTEGER,
                reorder_point INTEGER,
                last_updated REAL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS store_inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id TEXT,
                sku TEXT,
                on_hand_units INTEGER,
                last_counted REAL,
                UNIQUE(store_id, sku)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS replenishment_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                store_id TEXT,
                sku TEXT,
                requested_qty INTEGER,
                status TEXT,
                created_at REAL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS warehouse_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT,
                current_units INTEGER,
                alert_type TEXT,
                triggered_at REAL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS warehouse_shelves (
                shelf_name TEXT PRIMARY KEY,
                sku TEXT,
                created_at REAL
            )
        """)
        conn.commit()

if DB_TYPE == "sqlite":
    _init_sqlite()

# -------------------------------------------------------------------
# Helper functions
# -------------------------------------------------------------------
def get_all_shelves():
    if DB_TYPE == "mongodb":
        return list(warehouse_shelves_coll.find({}, {"_id": 0}))
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT shelf_name, sku FROM warehouse_shelves")
            return [dict(row) for row in cursor.fetchall()]

def add_shelf(shelf_name: str):
    if DB_TYPE == "mongodb":
        warehouse_shelves_coll.update_one(
            {"shelf_name": shelf_name},
            {"$setOnInsert": {"shelf_name": shelf_name, "sku": None, "created_at": time.time()}},
            upsert=True
        )
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.cursor().execute(
                "INSERT OR IGNORE INTO warehouse_shelves (shelf_name, sku, created_at) VALUES (?, NULL, ?)",
                (shelf_name, time.time())
            )
            conn.commit()

def remove_shelf(shelf_name: str):
    if DB_TYPE == "mongodb":
        warehouse_shelves_coll.delete_one({"shelf_name": shelf_name})
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.cursor().execute("DELETE FROM warehouse_shelves WHERE shelf_name = ?", (shelf_name,))
            conn.commit()

def map_shelf_to_product(shelf_name: str, sku: str):
    # If sku is empty string, we treat it as None (unmap)
    mapped_sku = sku if sku else None
    if DB_TYPE == "mongodb":
        warehouse_shelves_coll.update_one(
            {"shelf_name": shelf_name},
            {"$set": {"sku": mapped_sku}}
        )
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.cursor().execute("UPDATE warehouse_shelves SET sku = ? WHERE shelf_name = ?", (mapped_sku, shelf_name))
            conn.commit()

def delete_warehouse_product(sku: str):
    if DB_TYPE == "mongodb":
        warehouse_coll.delete_one({"_id": sku})
        warehouse_shelves_coll.update_many({"sku": sku}, {"$set": {"sku": None}})
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM warehouse_inventory WHERE sku = ?", (sku,))
            cursor.execute("UPDATE warehouse_shelves SET sku = NULL WHERE sku = ?", (sku,))
            conn.commit()


def get_warehouse_stock(sku: str):
    if DB_TYPE == "mongodb":
        return warehouse_coll.find_one({"_id": sku})
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.cursor().execute("SELECT * FROM warehouse_inventory WHERE sku = ?", (sku,)).fetchone()
            return dict(row) if row else None

def get_store_stock(store_id: str, sku: str):
    if DB_TYPE == "mongodb":
        return store_coll.find_one({"store_id": store_id, "_id": sku})
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.cursor().execute("SELECT * FROM store_inventory WHERE store_id = ? AND sku = ?", (store_id, sku)).fetchone()
            return dict(row) if row else None

def update_store_stock(store_id: str, sku: str, new_qty: int):
    if DB_TYPE == "mongodb":
        store_coll.update_one(
            {"store_id": store_id, "_id": sku},
            {"$set": {"on_hand_units": new_qty, "last_counted": time.time()}},
            upsert=True,
        )
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.cursor().execute("""
                INSERT INTO store_inventory (store_id, sku, on_hand_units, last_counted)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(store_id, sku) DO UPDATE SET
                    on_hand_units=excluded.on_hand_units,
                    last_counted=excluded.last_counted
            """, (store_id, sku, new_qty, time.time()))
            conn.commit()

def create_replenishment_request(store_id: str, sku: str, qty: int):
    if DB_TYPE == "mongodb":
        existing = replenish_coll.find_one({
            "store_id": store_id,
            "sku": sku,
            "status": "pending"
        })
        if existing: return existing
        doc = {
            "store_id": store_id,
            "sku": sku,
            "requested_qty": qty,
            "status": "pending",
            "created_at": time.time(),
        }
        replenish_coll.insert_one(doc)
        return doc
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            row = cursor.execute("SELECT * FROM replenishment_requests WHERE store_id=? AND sku=? AND status='pending'", (store_id, sku)).fetchone()
            if row: return dict(row)
            doc = {
                "store_id": store_id,
                "sku": sku,
                "requested_qty": qty,
                "status": "pending",
                "created_at": time.time()
            }
            cursor.execute("INSERT INTO replenishment_requests (store_id, sku, requested_qty, status, created_at) VALUES (?, ?, ?, ?, ?)", 
                           (doc["store_id"], doc["sku"], doc["requested_qty"], doc["status"], doc["created_at"]))
            conn.commit()
            return doc

def create_warehouse_alert(sku: str, current_units: int, alert_type: str = "low_stock"):
    one_hour_ago = time.time() - 3600
    if DB_TYPE == "mongodb":
        existing = warehouse_alerts_coll.find_one({
            "sku": sku,
            "alert_type": alert_type,
            "triggered_at": {"$gt": one_hour_ago}
        })
        if existing: return existing
        doc = {
            "sku": sku,
            "current_units": current_units,
            "alert_type": alert_type,
            "triggered_at": time.time(),
        }
        warehouse_alerts_coll.insert_one(doc)
        return doc
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            row = cursor.execute("SELECT * FROM warehouse_alerts WHERE sku=? AND alert_type=? AND triggered_at > ?", (sku, alert_type, one_hour_ago)).fetchone()
            if row: return dict(row)
            doc = {
                "sku": sku,
                "current_units": current_units,
                "alert_type": alert_type,
                "triggered_at": time.time()
            }
            cursor.execute("INSERT INTO warehouse_alerts (sku, current_units, alert_type, triggered_at) VALUES (?, ?, ?, ?)",
                           (doc["sku"], doc["current_units"], doc["alert_type"], doc["triggered_at"]))
            conn.commit()
            return doc

# -------------------------------------------------------------------
# Core computation – used by the replenishment engine
# -------------------------------------------------------------------

def compute_replenishment(store_id: str, sku: str, min_store_stock: int, warehouse_safety_stock: int):
    store_doc = get_store_stock(store_id, sku)
    warehouse_doc = get_warehouse_stock(sku)
    if not store_doc or not warehouse_doc:
        return 0, False

    on_hand = store_doc.get("on_hand_units", 0)
    warehouse_units = warehouse_doc.get("total_units", 0)
    
    needed = max(min_store_stock - on_hand, 0)
    max_possible = max(warehouse_units - warehouse_safety_stock, 0)
    request_qty = min(needed, max_possible)
    
    low_stock_alert = warehouse_units <= warehouse_doc.get("reorder_point", 0)
    
    return request_qty, low_stock_alert

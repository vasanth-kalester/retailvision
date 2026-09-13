import time
import os
import sqlite3
from pymongo import MongoClient
from core.config import DB_TYPE

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "shopper_analytics")
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "shopper_analytics.db")

warehouse_data = [
    {
        "_id": "SKU_001",
        "product_name": "Premium Coffee Beans",
        "total_units": 100,
        "safety_stock": 20,
        "reorder_point": 25,
        "last_updated": time.time()
    },
    {
        "_id": "SKU_002",
        "product_name": "Organic Almond Milk",
        "total_units": 22, # Close to safety stock
        "safety_stock": 20,
        "reorder_point": 25,
        "last_updated": time.time()
    },
    {
        "_id": "SKU_003",
        "product_name": "Whole Wheat Bread",
        "total_units": 500,
        "safety_stock": 50,
        "reorder_point": 60,
        "last_updated": time.time()
    },
    {
        "_id": "SKU_004",
        "product_name": "Wireless Earbuds",
        "total_units": 150,
        "safety_stock": 30,
        "reorder_point": 40,
        "last_updated": time.time()
    },
    {
        "_id": "SKU_005",
        "product_name": "Moisturizing Lotion",
        "total_units": 80,
        "safety_stock": 15,
        "reorder_point": 25,
        "last_updated": time.time()
    },
    {
        "_id": "SKU_006",
        "product_name": "Sparkling Water (12-pack)",
        "total_units": 300,
        "safety_stock": 40,
        "reorder_point": 50,
        "last_updated": time.time()
    }
]

store_data = [
    {
        "_id": "SKU_001",
        "store_id": "STORE_001",
        "on_hand_units": 4, # Less than MIN_STORE_STOCK (5), will trigger replenishment
        "last_counted": time.time()
    },
    {
        "_id": "SKU_002",
        "store_id": "STORE_001",
        "on_hand_units": 2, # Will trigger replenishment, but warehouse is low too
        "last_counted": time.time()
    },
    {
        "_id": "SKU_003",
        "store_id": "STORE_001",
        "on_hand_units": 15, # Plenty in store
        "last_counted": time.time()
    },
    {
        "_id": "SKU_004",
        "store_id": "STORE_001",
        "on_hand_units": 8,
        "last_counted": time.time()
    },
    {
        "_id": "SKU_005",
        "store_id": "STORE_001",
        "on_hand_units": 3, # Less than min
        "last_counted": time.time()
    },
    {
        "_id": "SKU_006",
        "store_id": "STORE_001",
        "on_hand_units": 20,
        "last_counted": time.time()
    }
]

def seed_mongodb():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    
    warehouse_coll = db["warehouse_inventory"]
    warehouse_coll.drop()
    warehouse_coll.insert_many(warehouse_data)
    print(f"Seeded {len(warehouse_data)} warehouse SKUs.")

    store_coll = db["store_inventory"]
    store_coll.drop()
    store_coll.insert_many(store_data)
    print(f"Seeded {len(store_data)} store inventory records.")

    db["replenishment_requests"].drop()
    db["warehouse_alerts"].drop()
    print("Cleared existing replenishment requests and warehouse alerts.")

def seed_sqlite():
    print(f"Connecting to SQLite at {SQLITE_DB_PATH}...")
    
    # Ensure tables exist first
    from core.inventory import _init_sqlite
    _init_sqlite()
    
    with sqlite3.connect(SQLITE_DB_PATH) as conn:
        cursor = conn.cursor()
        
        # Clear tables
        cursor.execute("DELETE FROM warehouse_inventory")
        cursor.execute("DELETE FROM store_inventory")
        cursor.execute("DELETE FROM replenishment_requests")
        cursor.execute("DELETE FROM warehouse_alerts")
        
        for item in warehouse_data:
            cursor.execute("""
                INSERT INTO warehouse_inventory (sku, product_name, total_units, safety_stock, reorder_point, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (item["_id"], item["product_name"], item["total_units"], item["safety_stock"], item["reorder_point"], item["last_updated"]))
        print(f"Seeded {len(warehouse_data)} warehouse SKUs.")

        for item in store_data:
            cursor.execute("""
                INSERT INTO store_inventory (store_id, sku, on_hand_units, last_counted)
                VALUES (?, ?, ?, ?)
            """, (item["store_id"], item["_id"], item["on_hand_units"], item["last_counted"]))
        print(f"Seeded {len(store_data)} store inventory records.")
        
        conn.commit()

def seed_database():
    if DB_TYPE == "mongodb":
        seed_mongodb()
    else:
        seed_sqlite()
    print("Database seeding complete!")

if __name__ == "__main__":
    seed_database()

from pymongo import MongoClient

def clear_db():
    try:
        client = MongoClient("mongodb://localhost:27017/")
        db = client["shopper_analytics"]
        db.footfall.drop()
        db.zone_metrics.drop()
        db.dwell_times.drop()
        print("Database cleared successfully.")
    except Exception as e:
        print(f"Failed to clear database: {e}")

if __name__ == "__main__":
    clear_db()

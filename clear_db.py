"""
Clear all analytics data from the database before a demo recording.
Supports both SQLite (default) and MongoDB backends.
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "shopper_analytics.db")

TABLES_TO_CLEAR = [
    "footfall",
    "zone_metrics",
    "dwell_times",
    "security_alerts",
    "customer_journeys",
    "staff_interactions",
    "demographics",
    "video_analysis_metadata",
]


def clear_sqlite():
    """Clear all analytics tables in the SQLite database."""
    if not os.path.exists(DB_PATH):
        print(f"[OK] No SQLite database found at {DB_PATH} — nothing to clear.")
        return

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        for table in TABLES_TO_CLEAR:
            try:
                cursor.execute(f"DELETE FROM {table}")
                count = cursor.rowcount
                print(f"  [OK] Cleared {table} ({count} rows)")
            except sqlite3.OperationalError:
                print(f"  - Skipped {table} (table does not exist)")
        conn.commit()
    print("\n[DONE] SQLite database cleared successfully.")


def clear_mongo():
    """Clear all analytics collections in MongoDB."""
    try:
        from pymongo import MongoClient
        client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
        client.server_info()  # Force connection test
        db = client["shopper_analytics"]
        for table in TABLES_TO_CLEAR:
            db[table].drop()
            print(f"  [OK] Dropped {table}")
        print("\n[DONE] MongoDB database cleared successfully.")
    except Exception as e:
        print(f"  [SKIP] MongoDB not available: {e}")


def reset_api_queue_state():
    """Reset in-memory queue state by hitting the API (if running)."""
    try:
        import urllib.request, json as _json
        req = urllib.request.Request(
            "http://localhost:8000/api/queue/update",
            data=_json.dumps({"queue_persons": 0}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=1)
        print("  [OK] Reset queue state via API")
    except Exception:
        print("  - API not running (queue state will be fresh on next start)")


def main():
    print("=" * 50)
    print("[CLEAN] RetailVision Database Cleaner")
    print("=" * 50)
    print()

    # Detect backend type
    try:
        from core.config import DB_TYPE
    except ImportError:
        DB_TYPE = "sqlite"

    if DB_TYPE == "sqlite":
        print("[SQLite Mode]")
        clear_sqlite()
    else:
        print("[MongoDB Mode]")
        clear_mongo()

    print()
    reset_api_queue_state()
    print()
    print("=" * 50)
    print("[READY] Database is clean - ready for demo recording!")
    print("=" * 50)


if __name__ == "__main__":
    main()

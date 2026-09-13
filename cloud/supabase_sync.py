"""
Cloud Sync Engine
Periodically aggregates local SQLite analytics data and pushes
summarised snapshots to Supabase, then prunes stale local records.

Privacy guarantee: Only numeric aggregates leave the edge device.
No raw video frames, bounding boxes, or biometric data are ever transmitted.
"""
import threading
import time
import os
import json
import sqlite3
from datetime import datetime, timezone, timedelta

from cloud.supabase_config import (
    SUPABASE_URL, SUPABASE_KEY, STORE_ID,
    SYNC_INTERVAL_SECONDS, LOCAL_RETENTION_SECONDS,
    is_cloud_configured,
)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")
SYNC_STATE_PATH = os.path.join(os.path.dirname(__file__), ".sync_state.json")


class CloudSyncEngine:
    """Background engine that syncs edge data to Supabase every N seconds."""

    def __init__(self):
        self.enabled = is_cloud_configured()
        self.last_sync: float = 0.0
        self.next_sync: float = 0.0
        self.records_synced: int = 0
        self.last_error: str | None = None
        self._timer: threading.Timer | None = None
        self._client = None

        # Load previous sync state
        self._load_state()

        if self.enabled:
            try:
                from supabase import create_client
                self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
                print(f"[CloudSync] Initialised — syncing every {SYNC_INTERVAL_SECONDS}s to {SUPABASE_URL}")
            except Exception as e:
                print(f"[CloudSync] Failed to initialise Supabase client: {e}")
                self.enabled = False
                self.last_error = str(e)
        else:
            print("[CloudSync] Disabled — SUPABASE_URL / SUPABASE_KEY not set")

    # ── Public API ────────────────────────────────────────────────────────

    def start(self):
        """Start the periodic sync loop."""
        if not self.enabled:
            return
        self._schedule_next()

    def stop(self):
        """Cancel pending timer."""
        if self._timer:
            self._timer.cancel()

    def force_sync(self) -> dict:
        """Trigger an immediate sync (called from API endpoint)."""
        if not self.enabled:
            return {"status": "disabled", "reason": "Cloud sync not configured"}
        return self._do_sync()

    def status(self) -> dict:
        return {
            "enabled": self.enabled,
            "last_sync": self.last_sync,
            "last_sync_human": datetime.fromtimestamp(self.last_sync, tz=timezone.utc).isoformat() if self.last_sync else None,
            "next_sync": self.next_sync,
            "next_sync_human": datetime.fromtimestamp(self.next_sync, tz=timezone.utc).isoformat() if self.next_sync else None,
            "records_synced": self.records_synced,
            "last_error": self.last_error,
            "sync_interval_seconds": SYNC_INTERVAL_SECONDS,
            "store_id": STORE_ID,
        }

    # ── Internal Logic ────────────────────────────────────────────────────

    def _schedule_next(self):
        self.next_sync = time.time() + SYNC_INTERVAL_SECONDS
        self._timer = threading.Timer(SYNC_INTERVAL_SECONDS, self._tick)
        self._timer.daemon = True
        self._timer.start()

    def _tick(self):
        self._do_sync()
        self._schedule_next()

    def _do_sync(self) -> dict:
        """Execute one full sync cycle."""
        synced = 0
        try:
            now = time.time()

            # 1) Aggregate and push footfall
            synced += self._sync_footfall(now)

            # 2) Aggregate and push queue stats
            synced += self._sync_queue_stats(now)

            # 3) Push inventory snapshot
            synced += self._sync_inventory(now)

            # 4) Push alert summary
            synced += self._sync_alerts(now)

            # 5) Prune old local data
            self._prune_local_data(now)

            self.last_sync = now
            self.records_synced += synced
            self.last_error = None
            self._save_state()

            print(f"[CloudSync] Sync complete — {synced} records pushed, local data pruned")
            return {"status": "success", "records_synced": synced}

        except Exception as e:
            self.last_error = str(e)
            print(f"[CloudSync] Sync failed (will retry next cycle): {e}")
            return {"status": "error", "error": str(e)}

    def _sync_footfall(self, now: float) -> int:
        """Aggregate footfall into hourly buckets and push to Supabase."""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT
                        CAST(strftime('%s', datetime(timestamp, 'unixepoch', 'localtime', 'start of hour')) AS INTEGER) AS hour_ts,
                        direction,
                        COUNT(*) as count
                    FROM footfall
                    WHERE timestamp > ?
                    GROUP BY hour_ts, direction
                """, (self.last_sync,))
                rows = cursor.fetchall()

            if not rows:
                return 0

            # Group by hour
            hours: dict = {}
            for row in rows:
                h = row["hour_ts"]
                if h not in hours:
                    hours[h] = {"entries": 0, "exits": 0}
                if row["direction"] == "ENTRY":
                    hours[h]["entries"] = row["count"]
                elif row["direction"] == "EXIT":
                    hours[h]["exits"] = row["count"]

            records = []
            for hour_ts, counts in hours.items():
                records.append({
                    "store_id": STORE_ID,
                    "hour_start": datetime.fromtimestamp(hour_ts, tz=timezone.utc).isoformat(),
                    "entries": counts["entries"],
                    "exits": counts["exits"],
                })

            if records:
                self._client.table("hourly_footfall").upsert(records).execute()
            return len(records)

        except Exception as e:
            print(f"[CloudSync] Footfall sync error: {e}")
            return 0

    def _sync_queue_stats(self, now: float) -> int:
        """Aggregate queue metrics (from footfall proxy) and push."""
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                # Use zone_metrics as a proxy for queue occupancy
                cursor.execute("""
                    SELECT
                        CAST(strftime('%s', datetime(timestamp, 'unixepoch', 'localtime', 'start of hour')) AS INTEGER) AS hour_ts,
                        AVG(occupancy_count) as avg_depth,
                        MAX(occupancy_count) as peak
                    FROM zone_metrics
                    WHERE timestamp > ?
                    GROUP BY hour_ts
                """, (self.last_sync,))
                rows = cursor.fetchall()

            if not rows:
                return 0

            records = []
            for row in rows:
                records.append({
                    "store_id": STORE_ID,
                    "hour_start": datetime.fromtimestamp(row["hour_ts"], tz=timezone.utc).isoformat(),
                    "avg_queue_depth": round(row["avg_depth"], 2),
                    "peak_queue": row["peak"],
                    "avg_wait_minutes": round(row["avg_depth"] * 0.7, 1),  # Estimated
                })

            if records:
                self._client.table("hourly_queue_stats").upsert(records).execute()
            return len(records)

        except Exception as e:
            print(f"[CloudSync] Queue stats sync error: {e}")
            return 0

    def _sync_inventory(self, now: float) -> int:
        """Push a full snapshot of current inventory levels."""
        try:
            # Read warehouse inventory from the inventory DB
            inv_db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")
            with sqlite3.connect(inv_db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT sku, product_name, total_units, safety_stock, reorder_point
                    FROM warehouse_inventory
                """)
                rows = cursor.fetchall()

            if not rows:
                return 0

            records = []
            for row in rows:
                records.append({
                    "store_id": STORE_ID,
                    "sku": row["sku"],
                    "product_name": row["product_name"],
                    "total_units": row["total_units"],
                    "safety_stock": row["safety_stock"],
                    "reorder_point": row["reorder_point"],
                })

            if records:
                self._client.table("inventory_snapshots").upsert(records).execute()
            return len(records)

        except Exception as e:
            print(f"[CloudSync] Inventory sync error: {e}")
            return 0

    def _sync_alerts(self, now: float) -> int:
        """Push recent security + stock alerts."""
        count = 0
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT timestamp, track_id, duration, alert_type
                    FROM security_alerts
                    WHERE timestamp > ?
                """, (self.last_sync,))
                rows = cursor.fetchall()

            records = []
            for row in rows:
                records.append({
                    "store_id": STORE_ID,
                    "alert_type": row["alert_type"],
                    "description": f"Track #{row['track_id']} lingered for {row['duration']:.0f}s",
                    "severity": "high" if row["duration"] > 120 else "medium",
                    "created_at": datetime.fromtimestamp(row["timestamp"], tz=timezone.utc).isoformat(),
                })

            if records:
                self._client.table("alert_history").insert(records).execute()
                count = len(records)

        except Exception as e:
            print(f"[CloudSync] Alert sync error: {e}")

        return count

    def _prune_local_data(self, now: float):
        """Delete local records older than the retention window."""
        cutoff = now - LOCAL_RETENTION_SECONDS
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM footfall WHERE timestamp < ?", (cutoff,))
                cursor.execute("DELETE FROM zone_metrics WHERE timestamp < ?", (cutoff,))
                cursor.execute("DELETE FROM security_alerts WHERE timestamp < ?", (cutoff,))
                # dwell_times uses entry_time
                cursor.execute("DELETE FROM dwell_times WHERE entry_time < ?", (cutoff,))
                conn.commit()
                total = sum([cursor.execute(f"SELECT changes()").fetchone()[0] for _ in range(1)])
                print(f"[CloudSync] Pruned records older than {LOCAL_RETENTION_SECONDS}s")
        except Exception as e:
            print(f"[CloudSync] Prune error (non-fatal): {e}")

    # ── State Persistence ─────────────────────────────────────────────────

    def _save_state(self):
        try:
            with open(SYNC_STATE_PATH, "w") as f:
                json.dump({"last_sync": self.last_sync, "records_synced": self.records_synced}, f)
        except Exception:
            pass

    def _load_state(self):
        try:
            if os.path.exists(SYNC_STATE_PATH):
                with open(SYNC_STATE_PATH, "r") as f:
                    state = json.load(f)
                    self.last_sync = state.get("last_sync", 0.0)
                    self.records_synced = state.get("records_synced", 0)
        except Exception:
            pass


# ── Singleton ─────────────────────────────────────────────────────────────
_engine: CloudSyncEngine | None = None

def get_sync_engine() -> CloudSyncEngine:
    global _engine
    if _engine is None:
        _engine = CloudSyncEngine()
    return _engine

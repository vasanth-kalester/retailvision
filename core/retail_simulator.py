import time
import random
import threading
import sqlite3
import os
import datetime

SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "shopper_analytics.db")

class RetailSimulator:
    def __init__(self):
        self.running = False
        self.thread = None
        self.tick = 0
        
        # Base realistic store traffic
        self.current_shoppers = 50
        
    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._sim_loop, daemon=True)
            self.thread.start()

    def stop(self):
        self.running = False

    def _sim_loop(self):
        while self.running:
            self.tick += 1
            time.sleep(3.0)  # Accelerated real-time (update every 3s)
            
            try:
                self._simulate_footfall()
                self._simulate_queue()
                if self.tick % 5 == 0:  # Every 15s
                    self._simulate_inventory()
            except Exception as e:
                print(f"Simulator error: {e}")

    def _simulate_footfall(self):
        # 1. Random entries / exits to change active shoppers
        entries = 0
        exits = 0
        
        # Every 10 ticks, create a mini surge
        surge = 5 if (self.tick % 10 == 0) else 0
        
        entries += random.randint(0, 2) + surge
        
        if self.current_shoppers > 0:
            exits += random.randint(0, 2)
            
        self.current_shoppers += (entries - exits)
        if self.current_shoppers < 0:
            self.current_shoppers = 0
            
        now = time.time()
        
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            cursor = conn.cursor()
            for _ in range(entries):
                cursor.execute("INSERT INTO footfall (timestamp, track_id, direction) VALUES (?, ?, 'ENTRY')", (now, int(now * 1000) % 100000))
            for _ in range(exits):
                cursor.execute("INSERT INTO footfall (timestamp, track_id, direction) VALUES (?, ?, 'EXIT')", (now, int(now * 1000) % 100000 + 1))
            conn.commit()

    def _simulate_queue(self):
        from api.queue_routes import _lane_state, update_global_queue_state
        
        # 8 lanes total
        # Determine total checkout load based on current_shoppers
        target_in_checkout = int(self.current_shoppers * 0.15) # 15% of people are checking out
        current_queued = sum(l["queue_depth"] for l in _lane_state)
        
        # Adjust queues towards target
        diff = target_in_checkout - current_queued
        
        active_lanes = [l for l in _lane_state if l["status"] in ["NORMAL", "CONGESTED", "BALANCED"]]
        if not active_lanes:
            # force open lane 1
            _lane_state[0]["status"] = "NORMAL"
            active_lanes = [_lane_state[0]]
            
        # Randomly process customers (decrease queue)
        for lane in active_lanes:
            if lane["queue_depth"] > 0 and random.random() < 0.4: # 40% chance per tick to process a person
                lane["queue_depth"] -= 1
                lane["processed_count"] += 1
                
        # Add new customers (increase queue)
        if diff > 0:
            for _ in range(min(diff, 3)): # Max 3 new people join queues per tick
                lane = random.choice(active_lanes)
                lane["queue_depth"] += 1
                
        # Auto-manage lanes and calculate wait times
        total_waiting = 0
        for lane in _lane_state:
            depth = lane["queue_depth"]
            total_waiting += depth
            
            # Simple wait time logic based on lane type
            items_per_min = lane["items_per_min"]
            if items_per_min == 0: items_per_min = 20
            
            # 10 items avg per person, divided by items/min = wait time per person
            wait_per_person = 10.0 / items_per_min
            lane["estimated_wait"] = round(depth * wait_per_person, 1)
            
            # Update congestion status
            if lane["status"] != "STANDBY":
                if lane["estimated_wait"] > 3.0 or depth > 5:
                    lane["status"] = "CONGESTED"
                else:
                    lane["status"] = "BALANCED" if "SCO" in lane["type"] else "NORMAL"
                    
        # Update historical chart data
        update_global_queue_state(total_waiting)

    def _simulate_inventory(self):
        # Slowly decrease a random item's total_units to trigger alerts
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("SELECT * FROM inventory_snapshots WHERE total_units > 0")
            items = cursor.fetchall()
            if items:
                item = random.choice(items)
                new_units = max(0, item["total_units"] - random.randint(1, 5))
                cursor.execute("UPDATE inventory_snapshots SET total_units = ? WHERE sku = ?", (new_units, item["sku"]))
                conn.commit()

# Singleton instance
retail_sim = RetailSimulator()

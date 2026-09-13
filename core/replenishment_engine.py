import threading
import time
from .config import MIN_STORE_STOCK, WAREHOUSE_SAFETY_STOCK_DEFAULT, REPLENISHMENT_ENGINE_INTERVAL
from .inventory import (
    store_coll, 
    compute_replenishment, 
    create_replenishment_request, 
    create_warehouse_alert,
    get_warehouse_stock
)

class ReplenishmentEngine:
    def __init__(self, store_id: str = "STORE_001"):
        self.store_id = store_id
        self.running = False
        self.thread = None

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._loop, daemon=True)
            self.thread.start()
            print(f"[Inventory] Replenishment engine started for {self.store_id}.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
            print(f"[Inventory] Replenishment engine stopped.")

    def _loop(self):
        while self.running:
            try:
                self._run_check()
            except Exception as e:
                print(f"[Inventory] Error in replenishment engine: {e}")
            
            # Sleep in small increments to allow responsive shutdown
            for _ in range(REPLENISHMENT_ENGINE_INTERVAL * 10):
                if not self.running:
                    break
                time.sleep(0.1)

    def _run_check(self):
        # 1. Iterate over all SKUs in the current store
        store_items = store_coll.find({"store_id": self.store_id})
        
        for item in store_items:
            sku = item["_id"]
            
            # Compute needs
            req_qty, low_stock_alert = compute_replenishment(
                self.store_id, 
                sku, 
                MIN_STORE_STOCK, 
                WAREHOUSE_SAFETY_STOCK_DEFAULT
            )
            
            # Generate requests if needed
            if req_qty > 0:
                create_replenishment_request(self.store_id, sku, req_qty)
                print(f"[Inventory] Generated replenishment request for {req_qty} units of {sku}.")
                
            # Generate warehouse alerts if needed
            if low_stock_alert:
                warehouse_doc = get_warehouse_stock(sku)
                if warehouse_doc:
                    create_warehouse_alert(sku, warehouse_doc.get("total_units", 0), "low_stock")
                    print(f"[Inventory] Generated warehouse low-stock alert for {sku}.")

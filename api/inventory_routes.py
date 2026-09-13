from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional
import time
import sqlite3
from bson import ObjectId

from core.config import DB_TYPE
from core.inventory import (
    store_coll,
    warehouse_coll,
    replenish_coll,
    warehouse_alerts_coll,
    update_store_stock,
    get_all_shelves,
    add_shelf,
    remove_shelf,
    map_shelf_to_product,
    delete_warehouse_product,
    SQLITE_DB_PATH
)

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

# --- Models ---
class StoreCountUpdate(BaseModel):
    store_id: str
    sku: str
    on_hand_units: int

class RequestStatusUpdate(BaseModel):
    status: str  # "pending", "approved", "fulfilled", "rejected"


class ShelfCreate(BaseModel):
    shelf_name: str

class ShelfMap(BaseModel):
    sku: str

class WarehouseUpdate(BaseModel):
    sku: str
    total_units: int
    product_name: Optional[str] = None
    safety_stock: Optional[int] = 20
    reorder_point: Optional[int] = 25

# --- Routes ---

@router.get("/store/{store_id}")
def get_store_inventory(store_id: str):
    if DB_TYPE == "mongodb":
        items = list(store_coll.find({"store_id": store_id}, {"_id": 1, "on_hand_units": 1, "last_counted": 1}))
        for item in items:
            item["sku"] = item.pop("_id")
        return {"items": items}
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT sku, on_hand_units, last_counted FROM store_inventory WHERE store_id = ?", (store_id,))
            items = [dict(row) for row in cursor.fetchall()]
            return {"items": items}

@router.post("/store/count")
def update_store_count(update: StoreCountUpdate):
    update_store_stock(update.store_id, update.sku, update.on_hand_units)
    return {"message": "Store stock updated"}

@router.get("/replenishment/requests")
def get_replenishment_requests(store_id: Optional[str] = None):
    if DB_TYPE == "mongodb":
        query = {}
        if store_id:
            query["store_id"] = store_id
        requests = list(replenish_coll.find(query).sort("created_at", -1).limit(50))
        for r in requests:
            r["_id"] = str(r["_id"])
        return {"requests": requests}
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            if store_id:
                cursor.execute("SELECT id as _id, store_id, sku, requested_qty, status, created_at FROM replenishment_requests WHERE store_id = ? ORDER BY created_at DESC LIMIT 50", (store_id,))
            else:
                cursor.execute("SELECT id as _id, store_id, sku, requested_qty, status, created_at FROM replenishment_requests ORDER BY created_at DESC LIMIT 50")
            requests = [dict(row) for row in cursor.fetchall()]
            return {"requests": requests}

@router.put("/replenishment/requests/{req_id}/status")
def update_request_status(req_id: str, update: RequestStatusUpdate):
    if update.status not in ["pending", "approved", "fulfilled", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    if DB_TYPE == "mongodb":
        res = replenish_coll.update_one(
            {"_id": ObjectId(req_id)},
            {"$set": {"status": update.status}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Request not found")
        return {"message": "Status updated"}
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE replenishment_requests SET status = ? WHERE id = ?", (update.status, req_id))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Request not found")
            conn.commit()
            return {"message": "Status updated"}

@router.get("/warehouse")
def get_warehouse_inventory():
    if DB_TYPE == "mongodb":
        items = list(warehouse_coll.find())
        for item in items:
            item["sku"] = item.pop("_id")
        return {"items": items}
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT sku, product_name, total_units, safety_stock, reorder_point, last_updated FROM warehouse_inventory")
            items = [dict(row) for row in cursor.fetchall()]
            return {"items": items}

@router.get("/warehouse/alerts")
def get_warehouse_alerts():
    if DB_TYPE == "mongodb":
        alerts = list(warehouse_alerts_coll.find().sort("triggered_at", -1).limit(50))
        for a in alerts:
            a["_id"] = str(a["_id"])
        return {"alerts": alerts}
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id as _id, sku, current_units, alert_type, triggered_at FROM warehouse_alerts ORDER BY triggered_at DESC LIMIT 50")
            alerts = [dict(row) for row in cursor.fetchall()]
            return {"alerts": alerts}

@router.post("/warehouse/update")
def update_warehouse_stock(update: WarehouseUpdate):
    if DB_TYPE == "mongodb":
        update_data = {
            "total_units": update.total_units,
            "safety_stock": update.safety_stock,
            "reorder_point": update.reorder_point,
            "last_updated": time.time()
        }
        if update.product_name:
            update_data["product_name"] = update.product_name
            
        warehouse_coll.update_one(
            {"_id": update.sku},
            {"$set": update_data},
            upsert=True
        )
        return {"message": "Warehouse stock updated"}
    else:
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            cursor = conn.cursor()
            if update.product_name:
                cursor.execute("""
                    INSERT INTO warehouse_inventory (sku, total_units, product_name, safety_stock, reorder_point, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(sku) DO UPDATE SET 
                        total_units=excluded.total_units, 
                        product_name=excluded.product_name,
                        safety_stock=excluded.safety_stock,
                        reorder_point=excluded.reorder_point,
                        last_updated=excluded.last_updated
                """, (update.sku, update.total_units, update.product_name, update.safety_stock, update.reorder_point, time.time()))
            else:
                cursor.execute("""
                    INSERT INTO warehouse_inventory (sku, total_units, safety_stock, reorder_point, last_updated)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(sku) DO UPDATE SET 
                        total_units=excluded.total_units,
                        safety_stock=excluded.safety_stock,
                        reorder_point=excluded.reorder_point,
                        last_updated=excluded.last_updated
                """, (update.sku, update.total_units, update.safety_stock, update.reorder_point, time.time()))
            conn.commit()
            return {"message": "Warehouse stock updated"}


@router.get("/warehouse/shelves")
def list_shelves():
    return {"shelves": get_all_shelves()}

@router.post("/warehouse/shelves")
def create_shelf(data: ShelfCreate):
    add_shelf(data.shelf_name)
    return {"message": "Shelf created"}

@router.delete("/warehouse/shelves/{shelf_name}")
def delete_shelf(shelf_name: str):
    remove_shelf(shelf_name)
    return {"message": "Shelf deleted"}

@router.put("/warehouse/shelves/{shelf_name}/map")
def map_shelf(shelf_name: str, data: ShelfMap):
    map_shelf_to_product(shelf_name, data.sku)
    return {"message": "Shelf mapped"}

@router.delete("/warehouse/{sku}")
def delete_product(sku: str):
    delete_warehouse_product(sku)
    return {"message": "Product deleted"}

# --- WebSockets ---
active_connections: List[WebSocket] = []

@router.websocket("/ws/stock-updates")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def broadcast_inventory_update(message: dict):
    for connection in active_connections:
        await connection.send_json(message)

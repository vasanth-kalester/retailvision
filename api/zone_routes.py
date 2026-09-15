from fastapi import APIRouter
from pydantic import BaseModel
import json
import os
from typing import List

router = APIRouter()

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "zone_products.json")

class ZoneProductMap(BaseModel):
    zoneName: str
    sku: str

def load_zone_products():
    if not os.path.exists(CONFIG_FILE):
        return {}
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def save_zone_products(data):
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)

@router.get("/api/zones/details")
def get_zone_details():
    from core.config import OPERATIONAL_ZONES
    return {"zones": OPERATIONAL_ZONES}

@router.get("/api/zones/products")
def get_products():
    return load_zone_products()

@router.post("/api/zones/products")
def add_product_to_zone(data: ZoneProductMap):
    zone_products = load_zone_products()
    if data.zoneName not in zone_products:
        zone_products[data.zoneName] = []
    
    if data.sku not in zone_products[data.zoneName]:
        zone_products[data.zoneName].append(data.sku)
        save_zone_products(zone_products)
        
    return {"status": "success", "zone_products": zone_products}

@router.delete("/api/zones/products/{zone_name}/{sku}")
def remove_product_from_zone(zone_name: str, sku: str):
    zone_products = load_zone_products()
    if zone_name in zone_products and sku in zone_products[zone_name]:
        zone_products[zone_name].remove(sku)
        save_zone_products(zone_products)
    return {"status": "success", "zone_products": zone_products}

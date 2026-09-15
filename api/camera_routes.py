from fastapi import APIRouter
from pydantic import BaseModel
import json
import os

router = APIRouter()

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "camera_mappings.json")

class MappingUpdate(BaseModel):
    cameraId: str
    zoneName: str

def load_mappings():
    if not os.path.exists(CONFIG_FILE):
        return {}
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def save_mappings(mappings):
    with open(CONFIG_FILE, "w") as f:
        json.dump(mappings, f, indent=4)

@router.get("/api/cameras/mapping")
def get_mappings():
    return load_mappings()

@router.post("/api/cameras/mapping")
def update_mapping(data: MappingUpdate):
    mappings = load_mappings()
    mappings[data.cameraId] = data.zoneName
    save_mappings(mappings)
    return {"status": "success", "mappings": mappings}

@router.get("/api/zones")
def get_zones():
    # Fetch from core config
    from core.config import OPERATIONAL_ZONES
    # Also add "Checkout" as it's typically handled separately but is a valid zone
    zones = list(OPERATIONAL_ZONES.keys())
    if "Checkout" not in zones:
        zones.append("Checkout")
    return {"zones": zones}

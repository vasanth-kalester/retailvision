import os

# === SYSTEM CONFIGURATION ===
RTSP_URL = os.environ.get("SA_RTSP_URL", "0") # Default to USB Camera 0 for MVP
GSTREAMER_PIPELINE = (
    f"rtspsrc location={RTSP_URL} latency=0 ! "
    "rtph264depay ! h264parse ! nvdec ! "
    "video/x-raw,format=BGRx ! videoconvert ! "
    "video/x-raw,format=BGR ! appsink drop=1"
)
ONNX_MODEL_PATH = os.environ.get("SA_ONNX_MODEL_PATH", "models/yolo26-nano.onnx")
ONNX_PROVIDERS = ['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']

# === TRACKER CONFIGURATION ===
TRACKER_HIGH_THRESH = 0.5
TRACKER_LOW_THRESH = 0.1
TRACKER_MATCH_THRESH = 0.8
TRACKER_MAX_TIME_LOST = 30
PRODUCT_CLASSES = [39, 41, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 63, 64, 65, 66, 67, 73, 76, 77, 78, 79]

# === HOMOGRAPHY (Calibration) ===
CALIBRATION_PIXELS = [(100, 150), (1180, 150), (1280, 700), (0, 700)]
CALIBRATION_WORLD = [(0, 0), (10, 0), (10, 8), (0, 8)]

# === ZONE POLYS & ENTRY/EXIT LINES ===
ENTRY_EXIT_LINE = ((300, 600), (900, 600))
MIN_CROSSING_VELOCITY = 5.0 

OPERATIONAL_ZONES = {
    "Produce": [(100, 100), (400, 100), (400, 300), (100, 300)],
    "Dairy": [(800, 100), (1200, 100), (1200, 300), (800, 300)],
    "Aisle_1": [(450, 350), (750, 350), (750, 650), (450, 650)]
}

PROMOTIONAL_DISPLAYS = {
    "Endcap_Promo_A": [(450, 200), (550, 200), (550, 300), (450, 300)]
}
DWELL_TIME_THRESHOLD_SEC = 5.0

INTERACTIVE_SHELVES = {
    "Produce_Shelf": [(100, 100), (400, 100), (400, 150), (100, 150)],
    "Dairy_Shelf": [(800, 100), (1200, 100), (1200, 150), (800, 150)],
}
PRODUCT_INTERACTION_THRESHOLD_SEC = 3.0

STAFF_INTERACTION_DIST_PIXELS = 150.0
STAFF_INTERACTION_TIME_SEC = 10.0

# === HEATMAP CONFIGURATION ===
HEATMAP_RESOLUTION = (720, 1280)
HEATMAP_DECAY_FACTOR = 0.95
HEATMAP_GAUSSIAN_SIGMA = 15

# === INVENTORY CONFIGURATION ===
MIN_STORE_STOCK = 5
WAREHOUSE_SAFETY_STOCK_DEFAULT = 20
REPLENISHMENT_ENGINE_INTERVAL = 10 # 10 seconds for MVP demo, in production 60 or more

# === DATABASE CONFIGURATION ===
DB_TYPE = os.getenv("DB_TYPE", "sqlite") # "sqlite" or "mongodb"

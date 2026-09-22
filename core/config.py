import os
import torch

# === SYSTEM CONFIGURATION ===
RTSP_URL = os.environ.get("SA_RTSP_URL", "0")  # Default to USB Camera 0 for MVP
GSTREAMER_PIPELINE = (
    f"rtspsrc location={RTSP_URL} latency=0 ! "
    "rtph264depay ! h264parse ! nvdec ! "
    "video/x-raw,format=BGRx ! videoconvert ! "
    "video/x-raw,format=BGR ! appsink drop=1"
)
ONNX_MODEL_PATH = os.environ.get("SA_ONNX_MODEL_PATH", "models/yolo11s.onnx")
ONNX_PROVIDERS = ['TensorrtExecutionProvider', 'CUDAExecutionProvider', 'CPUExecutionProvider']

# === YOLO / DETECTION CONFIGURATION (Accuracy-critical) ===
# conf=0.3 catches partially-occluded shoppers in dense retail scenes.
# Do NOT raise above 0.4 without re-evaluating missed detections.
YOLO_CONF_THRESHOLD = float(os.environ.get("SA_YOLO_CONF", "0.3"))
YOLO_IOU_THRESHOLD  = float(os.environ.get("SA_YOLO_IOU",  "0.45"))   # NMS IOU
YOLO_IMGSZ          = int(os.environ.get("SA_YOLO_IMGSZ", "640"))
YOLO_MAX_DET        = int(os.environ.get("SA_YOLO_MAX_DET", "100"))
# Auto-select GPU if available; set SA_YOLO_DEVICE=cpu to force CPU
YOLO_DEVICE = os.environ.get("SA_YOLO_DEVICE", "0" if torch.cuda.is_available() else "cpu")

# === TRACKER CONFIGURATION ===
TRACKER_HIGH_THRESH   = float(os.environ.get("SA_TRACKER_HIGH",  "0.5"))
TRACKER_LOW_THRESH    = float(os.environ.get("SA_TRACKER_LOW",   "0.1"))
TRACKER_MATCH_THRESH  = float(os.environ.get("SA_TRACKER_MATCH", "0.8"))
TRACKER_MAX_TIME_LOST = int(os.environ.get("SA_TRACKER_LOST", "30"))
PRODUCT_CLASSES = [39, 41, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 63, 64, 65, 66, 67, 73, 76, 77, 78, 79]

# === STAFF DETECTION (configurable per store) ===
# BGR format — change to match your store uniform colour.
# Deep-Red (Target-style): (0, 0, 200)  |  Blue (Walmart-style): (200, 0, 0)
_staff_color_env = os.environ.get("SA_STAFF_COLOR_BGR", "0,0,200")
STAFF_UNIFORM_COLOR_BGR = tuple(int(x) for x in _staff_color_env.split(","))
COLOR_TOLERANCE = int(os.environ.get("SA_STAFF_COLOR_TOL", "50"))

# === HOMOGRAPHY (Calibration) ===
CALIBRATION_PIXELS = [(100, 150), (1180, 150), (1280, 700), (0, 700)]
CALIBRATION_WORLD  = [(0, 0),    (10, 0),     (10, 8),     (0, 8)]

# Derived world bounds — used by HeatmapGenerator to avoid hardcoding
_world_xs = [p[0] for p in CALIBRATION_WORLD]
_world_ys = [p[1] for p in CALIBRATION_WORLD]
WORLD_WIDTH_M  = float(max(_world_xs) - min(_world_xs))   # default 10.0 m
WORLD_HEIGHT_M = float(max(_world_ys) - min(_world_ys))   # default  8.0 m

# === ZONE POLYS & ENTRY/EXIT LINES ===
ENTRY_EXIT_LINE = ((300, 600), (900, 600))
MIN_CROSSING_VELOCITY = 5.0

OPERATIONAL_ZONES = {
    "Produce":  [(100, 100), (400, 100), (400, 300), (100, 300)],
    "Dairy":    [(800, 100), (1200, 100), (1200, 300), (800, 300)],
    "Aisle_1":  [(450, 350), (750, 350), (750, 650), (450, 650)]
}

PROMOTIONAL_DISPLAYS = {
    "Endcap_Promo_A": [(450, 200), (550, 200), (550, 300), (450, 300)]
}
DWELL_TIME_THRESHOLD_SEC = 5.0

INTERACTIVE_SHELVES = {
    "Produce_Shelf": [(100, 100), (400, 100), (400, 150), (100, 150)],
    "Dairy_Shelf":   [(800, 100), (1200, 100), (1200, 150), (800, 150)],
}
PRODUCT_INTERACTION_THRESHOLD_SEC = 3.0

STAFF_INTERACTION_DIST_PIXELS = 150.0
STAFF_INTERACTION_TIME_SEC    = 10.0

# === HEATMAP CONFIGURATION ===
HEATMAP_RESOLUTION    = (720, 1280)
HEATMAP_DECAY_FACTOR  = 0.95
HEATMAP_GAUSSIAN_SIGMA = 15

# === ANALYTICS ACCURACY TUNING ===
# Subsample journey path: record 1 centroid every N frames (~0.5 s at 30 FPS)
JOURNEY_SAMPLE_EVERY_N_FRAMES = int(os.environ.get("SA_JOURNEY_SAMPLE", "15"))
# Throttle security alert DB writes — min seconds between alerts for the same track
SECURITY_ALERT_COOLDOWN_SEC = int(os.environ.get("SA_SEC_COOLDOWN", "60"))
# Demographics cache max entries (LRU eviction after this)
DEMOGRAPHICS_CACHE_MAX = int(os.environ.get("SA_DEMO_CACHE_MAX", "500"))

# === INVENTORY CONFIGURATION ===
MIN_STORE_STOCK = 5
WAREHOUSE_SAFETY_STOCK_DEFAULT = 20
REPLENISHMENT_ENGINE_INTERVAL = 10  # seconds

# === DATABASE CONFIGURATION ===
DB_TYPE = os.getenv("DB_TYPE", "sqlite")  # "sqlite" or "mongodb"
DB_WRITE_QUEUE_MAXSIZE = int(os.environ.get("SA_DB_QUEUE_MAX", "1000"))

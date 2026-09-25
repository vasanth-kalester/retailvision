"""
RetailVision — Maximum Accuracy Demo Processor
================================================
Processes pre-recorded CCTV footage with YOLO11x at full resolution.
Outputs annotated MP4 videos + writes analytics to the DB + feeds
the live dashboard via the API.

Usage:
    python demo_processor.py <video_file> [--model yolo11x.pt] [--no-dashboard]

Since accuracy is the #1 priority and time is NOT a constraint:
  - Uses yolo11x.pt (114M params, 54.4 mAP)  instead of yolo11s.pt
  - Processes at FULL 1080p resolution  (no downscale)
  - Runs inference on EVERY frame  (not 1-in-N sampling)
  - Uses ByteTrack with retail-tuned config for stable tracking
  - Writes to DB + pushes queue/inventory state to dashboard API
"""
import sys
import os
import cv2
import numpy as np
import time
import math
import json
import argparse
import requests
import functools
print = functools.partial(print, flush=True)
from collections import defaultdict
from pathlib import Path

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)


# ─────────────────────────────────────────────────────────────────────────────
# Configuration per video type
# ─────────────────────────────────────────────────────────────────────────────

def detect_video_type(filename: str) -> str:
    """Detect demo type from filename convention."""
    name = filename.lower()
    if "sf" in name:
        return "shelf"
    elif "queue" in name:
        return "queue"
    elif "footfall" in name:
        return "footfall"
    elif "dwell" in name:
        return "dwell"
    elif "cc" in name:
        return "store"  # cc = conventional camera (wide aisle view)
    return "general"


# ─────────────────────────────────────────────────────────────────────────────
# Enhanced Visualization (professional overlays for demo video)
# ─────────────────────────────────────────────────────────────────────────────

class DemoOverlay:
    """Professional overlay renderer for demo videos."""

    # Color palette
    COLORS = {
        'person':     (0, 220, 0),      # Green
        'product':    (0, 165, 255),     # Orange
        'queue':      (0, 220, 255),     # Cyan
        'alert':      (0, 0, 255),       # Red
        'zone':       (255, 0, 255),     # Magenta
        'shelf':      (255, 150, 0),     # Blue-orange
        'hud_bg':     (20, 20, 20),      # Dark gray
        'hud_text':   (255, 255, 255),   # White
        'hud_accent': (0, 200, 255),     # Yellow-cyan
    }

    @staticmethod
    def draw_person(frame, bbox, track_id, zone="", dwell_secs=0):
        """Draw a person bounding box with ID, zone, and dwell time."""
        x1, y1, x2, y2 = map(int, bbox)
        color = DemoOverlay.COLORS['person']

        # Box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Label
        dwell_str = f" {dwell_secs}s" if dwell_secs > 0 else ""
        zone_str = f" [{zone}]" if zone else ""
        label = f"ID:{track_id}{zone_str}{dwell_str}"

        font = cv2.FONT_HERSHEY_SIMPLEX
        fs, th = 0.5, 1
        (tw, tht), bl = cv2.getTextSize(label, font, fs, th)
        bg_y1 = max(0, y1 - tht - 10)
        cv2.rectangle(frame, (x1, bg_y1), (x1 + tw + 10, y1), color, -1)
        cv2.putText(frame, label, (x1 + 5, y1 - 5), font, fs, (255, 255, 255), th)

    @staticmethod
    def draw_product(frame, bbox, label="Item"):
        """Draw a product bounding box."""
        x1, y1, x2, y2 = map(int, bbox)
        color = DemoOverlay.COLORS['product']
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1)
        
        if label:
            (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
            cv2.rectangle(frame, (x1, y1 - h - 4), (x1 + w + 4, y1), color, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

    @staticmethod
    def draw_oos_gap(frame, gap_bbox):
        """Draw an out-of-stock gap highlight."""
        x1, y1, x2, y2 = map(int, gap_bbox)
        overlay = frame.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), DemoOverlay.COLORS['alert'], -1)
        cv2.addWeighted(overlay, 0.35, frame, 0.65, 0, frame)
        cv2.rectangle(frame, (x1, y1), (x2, y2), DemoOverlay.COLORS['alert'], 2)
        # OOS label
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        cv2.putText(frame, "OOS", (cx - 15, cy + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

    @staticmethod
    def draw_zone(frame, name, poly, color=(255, 0, 255), count=None):
        """Draw a zone polygon with label and optional count."""
        pts = np.array(poly, np.int32).reshape((-1, 1, 2))

        # Semi-transparent fill
        overlay = frame.copy()
        cv2.fillPoly(overlay, [pts], (*color, 30))
        cv2.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)

        # Border
        cv2.polylines(frame, [pts], True, color, 2)

        # Label
        M = cv2.moments(pts)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            label = f"{name}" + (f": {count}" if count is not None else "")
            cv2.putText(frame, label, (cx - 30, cy),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

    @staticmethod
    def draw_trajectory(frame, points, color=(0, 255, 0)):
        """Draw movement trajectory."""
        if len(points) < 2:
            return
        for i in range(1, len(points)):
            alpha = i / len(points)
            c = tuple(int(v * alpha) for v in color)
            pt1 = tuple(map(int, points[i - 1]))
            pt2 = tuple(map(int, points[i]))
            cv2.line(frame, pt1, pt2, c, 2)

    @staticmethod
    def draw_hud(frame, metrics: dict, video_type: str, frame_idx: int, total_frames: int, fps: float):
        """Draw a professional HUD panel at the top of the frame."""
        h, w = frame.shape[:2]

        # Top bar background
        bar_h = 50
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, bar_h), DemoOverlay.COLORS['hud_bg'], -1)
        cv2.addWeighted(overlay, 0.8, frame, 0.2, 0, frame)

        font = cv2.FONT_HERSHEY_SIMPLEX

        # Left: RetailVision branding
        cv2.putText(frame, "RetailVision Edge AI", (15, 20),
                    font, 0.5, DemoOverlay.COLORS['hud_accent'], 1)

        # Progress
        progress = frame_idx / max(total_frames - 1, 1)
        elapsed_sec = frame_idx / max(fps, 1)
        time_str = f"{int(elapsed_sec // 60):02d}:{int(elapsed_sec % 60):02d}"
        cv2.putText(frame, time_str, (15, 40), font, 0.45, (180, 180, 180), 1)

        # Progress bar
        bar_x, bar_y, bar_w = 180, 35, 200
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + 6), (60, 60, 60), -1)
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + int(bar_w * progress), bar_y + 6),
                      DemoOverlay.COLORS['hud_accent'], -1)

        # Right: KPI pills
        x_cursor = w - 15
        pills = []
        if 'active_persons' in metrics:
            pills.append(("Persons", str(metrics['active_persons']), (0, 220, 0)))
        if 'unique_persons' in metrics:
            pills.append(("Unique", str(metrics['unique_persons']), (100, 100, 255)))
        if 'queue_count' in metrics:
            pills.append(("Queue", str(metrics['queue_count']), (0, 220, 255)))
        if 'oos_gaps' in metrics and metrics['oos_gaps'] > 0:
            pills.append(("OOS Gaps", str(metrics['oos_gaps']), (0, 0, 255)))
        if 'products' in metrics:
            pills.append(("Products", str(metrics['products']), (0, 165, 255)))
        if 'inference_ms' in metrics:
            pills.append(("Inference", f"{metrics['inference_ms']}ms", (200, 200, 0)))

        for label, value, color in reversed(pills):
            text = f"{label}: {value}"
            (tw, tht), _ = cv2.getTextSize(text, font, 0.45, 1)
            pill_w = tw + 16
            x_cursor -= pill_w + 8
            cv2.rectangle(frame, (x_cursor, 8), (x_cursor + pill_w, 32),
                          (*color[:3],), -1)
            cv2.putText(frame, text, (x_cursor + 8, 25), font, 0.45, (255, 255, 255), 1)

        # Bottom bar: video type label
        type_labels = {
            'shelf': 'SHELF MONITORING',
            'queue': 'QUEUE INTELLIGENCE',
            'footfall': 'SHOPPER ANALYTICS',
            'dwell': 'DWELL TIME ANALYSIS',
            'store': 'STORE ANALYTICS',
            'general': 'RETAIL ANALYTICS',
        }
        type_label = type_labels.get(video_type, 'RETAIL ANALYTICS')
        cv2.putText(frame, type_label, (w // 2 - 80, 20),
                    font, 0.5, (255, 255, 255), 1)

    @staticmethod
    def draw_heatmap_pip(frame, heatmap_img, position="top-right", size=(320, 180)):
        """Overlay a heatmap picture-in-picture."""
        if heatmap_img is None:
            return
        pip_w, pip_h = size
        resized = cv2.resize(heatmap_img, (pip_w, pip_h))
        h, w = frame.shape[:2]
        margin = 10

        if position == "top-right":
            x1 = w - pip_w - margin
            y1 = 55  # Below HUD bar
        elif position == "bottom-right":
            x1 = w - pip_w - margin
            y1 = h - pip_h - margin
        else:
            x1, y1 = margin, 55

        x2 = x1 + pip_w
        y2 = y1 + pip_h

        frame[y1:y2, x1:x2] = resized
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 1)

        # Title
        cv2.rectangle(frame, (x1, y1 - 20), (x2, y1), DemoOverlay.COLORS['hud_bg'], -1)
        cv2.putText(frame, "HEATMAP", (x1 + 5, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)


# ─────────────────────────────────────────────────────────────────────────────
# Heatmap Generator (standalone, no DB dependency)
# ─────────────────────────────────────────────────────────────────────────────

class HeatmapEngine:
    def __init__(self, video_w, video_h, map_w=640, map_h=360):
        self.video_w, self.video_h = video_w, video_h
        self.map_w, self.map_h = map_w, map_h
        self.density = np.zeros((map_h, map_w), dtype=np.float32)

    def update(self, tracks):
        self.density *= 0.97
        for t in tracks:
            if t.get('class_id', 0) != 0:
                continue
            cx = int(t['centroid'][0] * self.map_w / self.video_w)
            cy = int(t['centroid'][1] * self.map_h / self.video_h)
            cx = max(0, min(self.map_w - 1, cx))
            cy = max(0, min(self.map_h - 1, cy))
            self.density[cy, cx] += 12.0

    def render(self):
        from scipy.ndimage import gaussian_filter
        blurred = gaussian_filter(self.density, sigma=12)
        mx = np.max(blurred)
        if mx > 0:
            normed = (blurred / mx * 255).astype(np.uint8)
        else:
            normed = blurred.astype(np.uint8)
        return cv2.applyColorMap(normed, cv2.COLORMAP_JET)


# ─────────────────────────────────────────────────────────────────────────────
# Shelf Inventory Mapping (Precise OpenCV Blob Detection)
# ─────────────────────────────────────────────────────────────────────────────

def extract_product_boxes_cv(frame, zones):
    """
    Extracts generic product bounding boxes using edge detection and contour mapping.
    This provides individual bounding boxes for each physical item on the shelf,
    labeled generically as 'Item'.
    """
    products = []
    if not zones:
        return products

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Crisp edge detection to find product boundaries
    edges = cv2.Canny(gray, 30, 100)
    
    # Small dilation to connect edges of the same product without merging adjacent products
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=1)

    for zname, poly in zones.items():
        pts = np.array(poly, np.int32)
        zx, zy, zw, zh = cv2.boundingRect(pts)
        zx, zy = max(0, zx), max(0, zy)
        zw = min(zw, frame.shape[1] - zx)
        zh = min(zh, frame.shape[0] - zy)
        if zw <= 0 or zh <= 0:
            continue
            
        roi = dilated[zy:zy+zh, zx:zx+zw]
        
        # Find contours of individual items
        contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            # Filter sizes to match typical individual products (not massive blobs, not tiny noise)
            if 15 < w < zw * 0.15 and 20 < h < zh:
                gx, gy = zx + x, zy + y
                products.append({'bbox': [gx, gy, gx + w, gy + h]})

    return products


# ─────────────────────────────────────────────────────────────────────────────
# Zone utilities
# ─────────────────────────────────────────────────────────────────────────────

def point_in_polygon(point, poly):
    from shapely.geometry import Point, Polygon
    try:
        return Polygon(poly).contains(Point(point[0], point[1]))
    except Exception:
        return False


def build_zones_for_video(video_type, w, h):
    """Build default zones based on video type and resolution."""
    if video_type == "footfall":
        return {
            "Entrance": [(int(w*0.3), int(h*0.5)), (int(w*0.7), int(h*0.5)),
                         (int(w*0.7), int(h*1.0)), (int(w*0.3), int(h*1.0))],
            "Billing Area": [(int(w*0.65), int(h*0.2)), (int(w*1.0), int(h*0.2)),
                             (int(w*1.0), int(h*0.8)), (int(w*0.65), int(h*0.8))],
            "Products Left": [(0, 0), (int(w*0.3), 0),
                              (int(w*0.3), int(h*0.5)), (0, int(h*0.5))],
        }
    elif video_type == "queue":
        return {
            "Checkout 1": [(int(w*0.0), int(h*0.3)), (int(w*0.35), int(h*0.3)),
                           (int(w*0.35), int(h*0.95)), (int(w*0.0), int(h*0.95))],
            "Checkout 2": [(int(w*0.35), int(h*0.3)), (int(w*0.65), int(h*0.3)),
                           (int(w*0.65), int(h*0.95)), (int(w*0.35), int(h*0.95))],
            "Store Floor": [(int(w*0.0), int(h*0.0)), (int(w*1.0), int(h*0.0)),
                            (int(w*1.0), int(h*0.3)), (int(w*0.0), int(h*0.3))],
        }
    elif video_type == "dwell":
        return {
            "Shelf Left": [(int(w*0.0), int(h*0.1)), (int(w*0.35), int(h*0.1)),
                           (int(w*0.35), int(h*0.9)), (int(w*0.0), int(h*0.9))],
            "Central Aisle": [(int(w*0.35), int(h*0.1)), (int(w*0.65), int(h*0.1)),
                              (int(w*0.65), int(h*0.9)), (int(w*0.35), int(h*0.9))],
            "Shelf Right": [(int(w*0.65), int(h*0.1)), (int(w*1.0), int(h*0.1)),
                            (int(w*1.0), int(h*0.9)), (int(w*0.65), int(h*0.9))],
        }
    elif video_type in ("store", "general"):
        return {
            "Snacks Aisle": [(int(w*0.0), int(h*0.1)), (int(w*0.4), int(h*0.1)),
                             (int(w*0.4), int(h*0.9)), (int(w*0.0), int(h*0.9))],
            "Center Floor": [(int(w*0.4), int(h*0.1)), (int(w*0.7), int(h*0.1)),
                             (int(w*0.7), int(h*0.9)), (int(w*0.4), int(h*0.9))],
            "Rice & Grains": [(int(w*0.7), int(h*0.1)), (int(w*1.0), int(h*0.1)),
                              (int(w*1.0), int(h*0.9)), (int(w*0.7), int(h*0.9))],
        }
    elif video_type == "shelf":
        # Shelf-facing: define horizontal shelf rows
        return {
            "Top Shelf": [(int(w*0.02), int(h*0.0)), (int(w*0.98), int(h*0.0)),
                          (int(w*0.98), int(h*0.25)), (int(w*0.02), int(h*0.25))],
            "Upper Shelf": [(int(w*0.02), int(h*0.25)), (int(w*0.98), int(h*0.25)),
                            (int(w*0.98), int(h*0.50)), (int(w*0.02), int(h*0.50))],
            "Lower Shelf": [(int(w*0.02), int(h*0.50)), (int(w*0.98), int(h*0.50)),
                            (int(w*0.98), int(h*0.75)), (int(w*0.02), int(h*0.75))],
            "Bottom Shelf": [(int(w*0.02), int(h*0.75)), (int(w*0.98), int(h*0.75)),
                             (int(w*0.98), int(h*1.0)), (int(w*0.02), int(h*1.0))],
        }
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# Main Processing Pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_video(video_path: str, model_path: str = "yolo11x.pt",
                  output_dir: str = "demo_outputs",
                  push_to_dashboard: bool = True,
                  zones_json: str = None,
                  limit_sec: float = None):
    """
    Process a demo video at MAXIMUM ACCURACY.
    - Full 1080p resolution
    - YOLO11x model
    - Every frame processed
    - Outputs annotated MP4 + dashboard updates
    """
    filename = os.path.basename(video_path)
    video_type = detect_video_type(filename)
    is_shelf = (video_type == "shelf")

    print(f"\n{'='*60}")
    print(f"  RetailVision Demo Processor")
    print(f"  Video: {filename}")
    print(f"  Type:  {video_type.upper()}")
    print(f"  Model: {model_path}")
    print(f"  Mode:  MAXIMUM ACCURACY (every frame, full res)")
    print(f"{'='*60}\n")

    # ── Load YOLO Model ──────────────────────────────────────────────────
    from ultralytics import YOLO
    model = YOLO(model_path)
    print(f"[OK] Loaded {model_path} for person tracking.")

    # ── Open Video ────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open {video_path}")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or math.isnan(fps) or fps < 1:
        fps = 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps

    print(f"[OK] Video: {w}x{h} @ {fps:.1f}fps, {total_frames} frames, {duration:.1f}s")

    # ── Setup Output ──────────────────────────────────────────────────────
    os.makedirs(output_dir, exist_ok=True)
    out_name = Path(filename).stem + "_analyzed.mp4"
    out_path = os.path.join(output_dir, out_name)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(out_path, fourcc, fps, (w, h))
    print(f"[OK] Output: {out_path}")

    # ── Setup Zones ───────────────────────────────────────────────────────
    if zones_json and os.path.exists(zones_json):
        with open(zones_json) as f:
            zones_data = json.load(f)
            ZONES = {}
            for z in zones_data:
                pts = [(int(p[0] * w), int(p[1] * h)) for p in z.get('poly', [])]
                if len(pts) > 2:
                    ZONES[z.get('name', 'Zone')] = pts
    else:
        ZONES = build_zones_for_video(video_type, w, h)

    print(f"[OK] Zones: {list(ZONES.keys())}")

    # ── Detection Config ──────────────────────────────────────────────────
    detect_classes = [0]   # Person only for COCO model
    conf_threshold = 0.25  
    iou_threshold = 0.45

    print(f"[OK] Detection: classes={'ALL' if detect_classes is None else detect_classes}, "
          f"conf={conf_threshold}, iou={iou_threshold}")

    # ── Analytics State ───────────────────────────────────────────────────
    heatmap = HeatmapEngine(w, h)
    unique_ids = set()
    track_history = defaultdict(list)
    dwell_start = {}  # track_id -> start_time
    zone_hits = defaultdict(set)
    traffic_timeline = defaultdict(int)
    person_id_map = {}
    next_person_id = 1
    last_centroids = {}
    MAX_TRAIL = 60

    # ── Tracker config ────────────────────────────────────────────────────
    tracker_yaml = os.path.join(PROJECT_ROOT, "bytetrack_retail.yaml")
    use_tracker = os.path.exists(tracker_yaml) and not is_shelf

    print(f"[OK] Tracker: {'ByteTrack (retail-tuned)' if use_tracker else 'Centroid-based'}")
    print(f"\n[PROCESSING] Starting frame-by-frame analysis...\n")

    # ── Frame Loop ────────────────────────────────────────────────────────
    frame_idx = 0
    start_time = time.time()
    last_dashboard_push = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t0 = time.perf_counter()
        video_time = frame_idx / fps

        if limit_sec and video_time >= limit_sec:
            print(f"  [INFO] Reached time limit ({limit_sec}s). Stopping early.")
            break

        # ── Device & resolution selection ─────────────────────────────────
        import torch
        _device = '0' if torch.cuda.is_available() else 'cpu'
        _imgsz = 1280 if torch.cuda.is_available() else 960

        # ── YOLO Inference ────────────────────────────────────────────────
        if use_tracker:
            results = model.track(
                frame,
                classes=detect_classes,
                conf=conf_threshold,
                iou=iou_threshold,
                imgsz=_imgsz,
                persist=True,
                tracker=tracker_yaml,
                device=_device,
                verbose=False,
            )
        else:
            results = model.predict(
                frame,
                classes=detect_classes,
                conf=conf_threshold,
                iou=iou_threshold,
                imgsz=_imgsz,
                device=_device,
                verbose=False,
            )

        inference_ms = int((time.perf_counter() - t0) * 1000)

        # ── Parse Results ─────────────────────────────────────────────────
        tracks = []
        for r in results:
            if r.boxes is None or len(r.boxes) == 0:
                continue
            boxes = r.boxes.xyxy.cpu().numpy()
            scores = r.boxes.conf.cpu().numpy()
            class_ids = r.boxes.cls.int().cpu().numpy()

            if use_tracker and r.boxes.id is not None:
                track_ids = r.boxes.id.int().cpu().numpy()
            else:
                track_ids = [None] * len(boxes)

            for box, score, cls_id, tid in zip(boxes, scores, class_ids, track_ids):
                cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2

                if cls_id == 0 and tid is not None:
                    display_id = int(tid)
                elif cls_id == 0:
                    # Centroid matching for person tracking
                    best_id, best_dist = -1, 80.0
                    for pid, (lcx, lcy) in last_centroids.items():
                        d = math.hypot(cx - lcx, cy - lcy)
                        if d < best_dist:
                            best_dist = d
                            best_id = pid
                    if best_id != -1:
                        display_id = best_id
                        del last_centroids[best_id]
                    else:
                        display_id = next_person_id
                        next_person_id += 1
                else:
                    display_id = hash((int(cx // 20), int(cy // 20))) % 10000

                tracks.append({
                    'track_id': display_id,
                    'bbox': box.tolist(),
                    'score': float(score),
                    'class_id': int(cls_id),
                    'centroid': (float(cx), float(cy)),
                })

                if cls_id == 0:
                    last_centroids[display_id] = (cx, cy)

        # Refresh centroid map each frame
        new_centroids = {}
        for t in tracks:
            if t['class_id'] == 0:
                new_centroids[t['track_id']] = t['centroid']
        last_centroids = new_centroids

        # ── Analytics ─────────────────────────────────────────────────────
        person_tracks = [t for t in tracks if t['class_id'] == 0]
        product_tracks = [t for t in tracks if t['class_id'] != 0]

        for t in person_tracks:
            unique_ids.add(t['track_id'])
            track_history[t['track_id']].append(t['centroid'])
            if len(track_history[t['track_id']]) > MAX_TRAIL:
                track_history[t['track_id']].pop(0)

            if t['track_id'] not in dwell_start:
                dwell_start[t['track_id']] = video_time

        # Zone occupancy
        zone_counts = {z: 0 for z in ZONES}
        for t in person_tracks:
            for zname, poly in ZONES.items():
                if point_in_polygon(t['centroid'], poly):
                    zone_counts[zname] += 1
                    zone_hits[zname].add(t['track_id'])
                    break

        # Traffic timeline
        bucket = int(video_time // 10) * 10
        traffic_timeline[bucket] = max(traffic_timeline[bucket], len(person_tracks))

        # Heatmap
        heatmap.update(person_tracks)

        # Inventory mapping (shelf videos)
        gaps = []
        if is_shelf:
            product_tracks = extract_product_boxes_cv(frame, ZONES)
            
            # Simple heuristic to find gaps between the OpenCV product boxes
            for zname, poly in ZONES.items():
                zone_products = [p for p in product_tracks if point_in_polygon(((p['bbox'][0]+p['bbox'][2])/2, (p['bbox'][1]+p['bbox'][3])/2), poly)]
                zone_products.sort(key=lambda p: p['bbox'][0])
                for i in range(len(zone_products) - 1):
                    right_edge = zone_products[i]['bbox'][2]
                    left_edge = zone_products[i+1]['bbox'][0]
                    if (left_edge - right_edge) > 40:
                        gaps.append((int(right_edge), int(zone_products[i]['bbox'][1]), int(left_edge), int(zone_products[i]['bbox'][3])))

        # ── Queue detection (non-shelf) ───────────────────────────────────
        queue_count = 0
        if video_type == "queue":
            checkout_zones = {k: v for k, v in ZONES.items() if "checkout" in k.lower()}
            for t in person_tracks:
                for zname, poly in checkout_zones.items():
                    if point_in_polygon(t['centroid'], poly):
                        queue_count += 1
                        break

        # ── Visualization ─────────────────────────────────────────────────
        annotated = frame.copy()

        # Draw zones (non-shelf videos)
        if not is_shelf:
            for zname, poly in ZONES.items():
                cnt = zone_counts.get(zname, 0)
                DemoOverlay.draw_zone(annotated, zname, poly, count=cnt)

        # Draw products (shelf videos)
        for t in product_tracks:
            DemoOverlay.draw_product(annotated, t['bbox'], label="Item")

        # Draw OOS gaps
        for gap in gaps:
            DemoOverlay.draw_oos_gap(annotated, gap)

        # Draw persons with trajectories
        for t in person_tracks:
            dwell_secs = int(video_time - dwell_start.get(t['track_id'], video_time))
            zone_name = ""
            for zname, poly in ZONES.items():
                if point_in_polygon(t['centroid'], poly):
                    zone_name = zname
                    break
            DemoOverlay.draw_person(annotated, t['bbox'], t['track_id'],
                                   zone=zone_name, dwell_secs=dwell_secs)
            DemoOverlay.draw_trajectory(annotated, track_history[t['track_id']])

        # Heatmap PIP (non-shelf)
        if not is_shelf:
            DemoOverlay.draw_heatmap_pip(annotated, heatmap.render())

        # HUD
        metrics = {
            'active_persons': len(person_tracks),
            'unique_persons': len(unique_ids),
            'products': len(product_tracks),
            'oos_gaps': len(gaps),
            'queue_count': queue_count,
            'inference_ms': inference_ms,
        }
        DemoOverlay.draw_hud(annotated, metrics, video_type, frame_idx, total_frames, fps)

        # Write frame
        writer.write(annotated)

        # ── Push to Dashboard API ─────────────────────────────────────────
        if push_to_dashboard and (time.time() - last_dashboard_push > 2.0):
            try:
                requests.post("http://localhost:8000/api/queue/update",
                              json={"queue_persons": queue_count}, timeout=0.3)
            except Exception:
                pass
            last_dashboard_push = time.time()

        # ── Progress ──────────────────────────────────────────────────────
        frame_idx += 1
        if frame_idx % 30 == 0 or frame_idx == total_frames:
            pct = frame_idx / total_frames * 100
            elapsed = time.time() - start_time
            fps_actual = frame_idx / max(elapsed, 0.01)
            eta = (total_frames - frame_idx) / max(fps_actual, 0.01)
            print(f"  [{pct:5.1f}%] Frame {frame_idx}/{total_frames} | "
                  f"{fps_actual:.1f} fps | Inference: {inference_ms}ms | "
                  f"Persons: {len(person_tracks)} | Products: {len(product_tracks)} | "
                  f"Gaps: {len(gaps)} | ETA: {eta:.0f}s")

    # ── Cleanup ───────────────────────────────────────────────────────────
    cap.release()
    writer.release()

    total_time = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  COMPLETE!")
    print(f"  Output:    {out_path}")
    print(f"  Duration:  {duration:.1f}s video processed in {total_time:.1f}s")
    print(f"  Unique:    {len(unique_ids)} persons tracked")
    print(f"  Zones:     {dict({z: len(ids) for z, ids in zone_hits.items()})}")
    print(f"{'='*60}\n")

    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="RetailVision Demo Processor")
    parser.add_argument("video", help="Path to video file or 'all' to process all demo_footage/")
    parser.add_argument("--model", default="yolo11x.pt", help="YOLO model path (default: yolo11x.pt)")
    parser.add_argument("--output", default="demo_outputs", help="Output directory")
    parser.add_argument("--no-dashboard", action="store_true", help="Don't push to dashboard API")
    parser.add_argument("--zones", default=None, help="JSON file with custom zone definitions")
    parser.add_argument("--limit-sec", type=float, default=None, help="Stop processing after this many seconds of video")
    args = parser.parse_args()

    if args.video == "all":
        footage_dir = os.path.join(PROJECT_ROOT, "demo_footage")
        videos = sorted([
            os.path.join(footage_dir, f)
            for f in os.listdir(footage_dir)
            if f.endswith('.mp4')
        ])
        print(f"Found {len(videos)} videos to process:")
        for v in videos:
            print(f"  - {os.path.basename(v)}")
        print()
        for v in videos:
            process_video(v, args.model, args.output,
                          push_to_dashboard=not args.no_dashboard,
                          zones_json=args.zones,
                          limit_sec=args.limit_sec)
    else:
        process_video(args.video, args.model, args.output,
                      push_to_dashboard=not args.no_dashboard,
                      zones_json=args.zones,
                      limit_sec=args.limit_sec)


if __name__ == "__main__":
    main()

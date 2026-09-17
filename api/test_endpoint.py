import sys
import os
import cv2
import numpy as np
import tempfile
import base64
import uuid
import asyncio
import math
import time
from collections import defaultdict
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from concurrent.futures import ThreadPoolExecutor

# Adjust path so we can import from core/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

router = APIRouter()

# Dedicated thread pool for CPU-heavy video work (keeps event loop free)
_executor = ThreadPoolExecutor(max_workers=2)

CHUNK_SIZE = 1024 * 1024  # 1 MB chunks for streaming upload read

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def encode_frame_to_base64(frame: np.ndarray) -> str:
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 78])
    return base64.b64encode(buffer).decode('utf-8')


# ─────────────────────────────────────────────────────────────────────────────
# Isolated analytics (no DB, fresh state per request)
# ─────────────────────────────────────────────────────────────────────────────

class _LocalTracker:
    """Lightweight tracker isolated per request (never touches global state)."""

    def __init__(self, yolo_model):
        self.model = yolo_model
        self.person_id_map = {}
        self.next_person_id = 1

    def infer_and_track(self, frame) -> list[dict]:
        from core.config import PRODUCT_CLASSES
        # Use BoT-SORT for robust ReID, so the same person keeps the same ascending ID
        results = self.model.track(frame, classes=[0] + PRODUCT_CLASSES, conf=0.5, persist=True, tracker="botsort.yaml", verbose=False)
        active_tracks = []
        for r in results:
            if r.boxes.id is None:
                continue
            boxes = r.boxes.xyxy.cpu().numpy()
            track_ids = r.boxes.id.int().cpu().numpy()
            scores = r.boxes.conf.cpu().numpy()
            class_ids = r.boxes.cls.int().cpu().numpy()
            
            for box, raw_t_id, score, cls_id in zip(boxes, track_ids, scores, class_ids):
                display_id = raw_t_id
                if cls_id == 0:
                    if raw_t_id not in self.person_id_map:
                        self.person_id_map[raw_t_id] = self.next_person_id
                        self.next_person_id += 1
                    display_id = self.person_id_map[raw_t_id]
                    
                active_tracks.append({
                    'track_id': int(display_id),
                    'bbox': box.tolist(),
                    'score': float(score),
                    'class_id': int(cls_id),
                    'centroid': ((box[0] + box[2])/2, (box[1] + box[3])/2),
                })
        return active_tracks


class _LocalHeatmap:
    """Heatmap generator with no external dependencies."""
    def __init__(self, video_w: int, video_h: int, w=640, h=360):
        self.video_w = video_w
        self.video_h = video_h
        self.w, self.h = w, h
        self.mat = np.zeros((h, w), dtype=np.float32)

    def update(self, tracks):
        self.mat *= 0.97
        for t in tracks:
            # Scale from actual video coordinates to heatmap coordinates
            cx = int(((t['bbox'][0] + t['bbox'][2]) / 2) * self.w / self.video_w)
            cy = int((t['bbox'][3]) * self.h / self.video_h)
            cx = max(0, min(self.w - 1, cx))
            cy = max(0, min(self.h - 1, cy))
            self.mat[cy, cx] += 12.0

    def render(self, bg_frame=None) -> np.ndarray:
        from scipy.ndimage import gaussian_filter
        blurred = gaussian_filter(self.mat, sigma=12)
        mx = np.max(blurred)
        normed = (blurred / mx * 255).astype(np.uint8) if mx > 0 else blurred.astype(np.uint8)
        color_map = cv2.applyColorMap(normed, cv2.COLORMAP_JET)
        
        if bg_frame is not None:
            mask = normed > 15
            h, w = self.h, self.w
            if bg_frame.shape[:2] != (h, w):
                bg_frame = cv2.resize(bg_frame, (w, h))
            blended = bg_frame.copy()
            if np.any(mask):
                blended[mask] = cv2.addWeighted(bg_frame[mask], 0.4, color_map[mask], 0.6, 0)
            return blended
            
        return color_map


# ─────────────────────────────────────────────────────────────────────────────
# Core processing (runs in thread pool so event loop stays free)
# ─────────────────────────────────────────────────────────────────────────────

def _process_video(tmp_path: str, original_filename: str, custom_zones: str = None) -> dict:
    """
    Synchronous heavy lifting — called via run_in_executor.
    Returns the full result dict or raises on error.
    """
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8s.pt")
    except Exception as e:
        raise RuntimeError(f"Could not load YOLO model: {e}")

    cap = cv2.VideoCapture(tmp_path)
    if not cap.isOpened():
        raise RuntimeError("OpenCV could not open the video file.")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or math.isnan(fps) or fps < 1 or fps > 120:
        fps = 30.0
        
    orig_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Scale down to max 640 width to drastically improve YOLO & encoding speed
    width, height = orig_width, orig_height
    if width > 640:
        scale = 640 / width
        width = int(width * scale)
        height = int(height * scale)

    # Process ~2 fps regardless of source FPS (faster analysis)
    process_every_n = max(1, int(fps // 2))

    tracker = _LocalTracker(model)
    heatmap_gen = _LocalHeatmap(video_w=width, video_h=height, w=640, h=360)

    # Rich analytics accumulators
    unique_ids: set[int] = set()
    traffic_timeline: dict[int, int] = defaultdict(int)
    zone_hits: dict[str, set[int]] = defaultdict(set)

    # Setup Zones
    ZONES = {}
    if custom_zones:
        import json
        try:
            parsed_zones = json.loads(custom_zones)
            for z in parsed_zones:
                name = z.get('name', 'Zone')
                # assume points are 0-1 relative
                pts = [(int(pt[0] * width), int(pt[1] * height)) for pt in z.get('poly', [])]
                if len(pts) > 2:
                    ZONES[name] = pts
        except:
            pass
    if not ZONES:
        ZONES = {
            "Zone A (Left)":   [(int(width*0.1), int(height*0.2)), (int(width*0.4), int(height*0.2)), (int(width*0.4), int(height*0.8)), (int(width*0.1), int(height*0.8))],
            "Zone B (Center)": [(int(width*0.4), int(height*0.2)), (int(width*0.6), int(height*0.2)), (int(width*0.6), int(height*0.8)), (int(width*0.4), int(height*0.8))],
            "Zone C (Right)":  [(int(width*0.6), int(height*0.2)), (int(width*0.9), int(height*0.2)), (int(width*0.9), int(height*0.8)), (int(width*0.6), int(height*0.8))],
        }

    def _in_zone(cx, cy, poly):
        from shapely.geometry import Point, Polygon
        try:
            return Polygon(poly).contains(Point(cx, cy))
        except Exception:
            return False

    keyframes: list[str] = []
    video_frames: list[str] = []
    frame_idx = 0
    last_tracks: list[dict] = []
    frames_analyzed = 0

    video_start_time = 0.0  # simulated time in video (sec)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Resize to match our processing dimensions
        if orig_width > 640:
            frame = cv2.resize(frame, (width, height))

        video_time_sec = frame_idx / fps

        if frame_idx % process_every_n == 0:
            last_tracks = tracker.infer_and_track(frame)
            heatmap_gen.update(last_tracks)
            frames_analyzed += 1

            # Unique persons
            for t in last_tracks:
                unique_ids.add(t['track_id'])

            # Traffic timeline (10-second buckets)
            bucket = int(video_time_sec // 10) * 10
            if len(last_tracks) > traffic_timeline[bucket]:
                traffic_timeline[bucket] = len(last_tracks)

            # Zone occupancy
            for t in last_tracks:
                cx, cy = t['centroid']
                for zone_name, poly in ZONES.items():
                    if _in_zone(cx, cy, poly):
                        zone_hits[zone_name].add(t['track_id'])

        from core.visualization import (
            detect_staff_heuristic, draw_bounding_box_with_label,
            draw_queue_metrics, overlay_heatmap_pip, overlay_zones
        )

        # Annotate frame
        active_shoppers = 0
        staff_count = 0
        # frame = overlay_zones(frame, ZONES)

        for t in last_tracks:
            bbox = t['bbox']
            t_id = t['track_id']
            class_id = t.get('class_id', 0)
            cx, cy = t['centroid']

            if class_id != 0:
                label = f"Item {t_id}"
                draw_bounding_box_with_label(frame, bbox, label, is_product=True)
            else:
                is_staff = detect_staff_heuristic(frame, bbox)
                if is_staff:
                    staff_count += 1
                    label = f"ID:{t_id} Staff"
                else:
                    active_shoppers += 1
                    current_zone = "Browsing"
                    for zone_name, poly in ZONES.items():
                        if _in_zone(cx, cy, poly):
                            current_zone = f"{zone_name}"
                            break
                    label = f"ID:{t_id}"
                    
                draw_bounding_box_with_label(frame, bbox, label, is_staff=is_staff)

        # Heatmap is now returned separately, no longer overlaying PiP
        pass

        # Store the frame for the frontend player (scaled proportionally)
        if frame_idx % process_every_n == 0:
            h, w = frame.shape[:2]
            scale = min(640 / w, 640 / h)
            new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
            resized_for_web = cv2.resize(frame, (new_w, new_h))
            video_frames.append(encode_frame_to_base64(resized_for_web))

        # Capture up to 8 keyframes evenly distributed
        kf_interval = max(1, total_frames // 8)
        if len(keyframes) < 8 and frame_idx % kf_interval == 0:
            h, w = frame.shape[:2]
            scale = min(640 / w, 640 / h)
            new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
            resized_kf = cv2.resize(frame, (new_w, new_h))
            keyframes.append(encode_frame_to_base64(resized_kf))

        frame_idx += 1

    cap.release()

    # Render heatmap
    heatmap_img = heatmap_gen.render()
    heatmap_b64 = encode_frame_to_base64(heatmap_img)

    duration_sec = round(total_frames / fps, 1)

    peak_concurrent = max(traffic_timeline.values()) if traffic_timeline else 0
    avg_ppm = round((len(unique_ids) / max(duration_sec / 60, 0.01)), 1)
    traffic_curve = [{"time_sec": k * 10, "count": v} for k, v in sorted(traffic_timeline.items())]
    zone_summary = [{"zone": z, "unique_visitors": len(ids)} for z, ids in zone_hits.items() if len(ids) > 0]
    
    insights = []
    total_persons = len(unique_ids)
    if total_persons == 0:
        insights.append("No shoppers detected in this video segment.")
    else:
        insights.append(f"Analyzed {total_persons} unique shoppers over {duration_sec} seconds. Peak concurrency was {peak_concurrent} shoppers.")
        
        if zone_summary:
            sorted_zones = sorted(zone_summary, key=lambda x: x['unique_visitors'], reverse=True)
            top_zone = sorted_zones[0]
            insights.append(f"'{top_zone['zone']}' was the most highly trafficked area, capturing {top_zone['unique_visitors']} visitors. Consider prioritizing premium product placements here.")
            
            if len(sorted_zones) > 1:
                bottom_zone = sorted_zones[-1]
                insights.append(f"'{bottom_zone['zone']}' had the lowest engagement ({bottom_zone['unique_visitors']} visitors). Review promotional displays to increase draw to this area.")

    try:
        from database.store_db import db
        db.log_video_analysis(original_filename, duration_sec, total_persons, insights)
    except Exception as e:
        print(f"Failed to log video analysis: {e}")

    return {
        "status": "success",
        "video_info": {
            "filename": original_filename,
            "total_frames": total_frames,
            "fps": round(fps, 1),
            "duration_sec": duration_sec,
            "frames_analyzed": frames_analyzed,
            "resolution": f"{width}x{height}",
        },
        "analytics": {
            "unique_persons_detected": len(unique_ids),
            "active_tracks_at_end": len(last_tracks),
            "dwell_events": len(last_tracks),
            "peak_concurrent_persons": peak_concurrent,
            "avg_persons_per_minute": avg_ppm,
            "traffic_curve": traffic_curve,
            "zone_breakdown": zone_summary,
            "insights": insights,
        },
        "heatmap_b64": heatmap_b64,
        "keyframes": keyframes,
        "video_frames": video_frames,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import Form, Query

@router.get("/api/test/list-cameras")
def list_cameras():
    """Auto-detect all readable cameras and return their indices."""
    available = []
    for i in range(8):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            # Warm up — some virtual cameras (DroidCam) need a few frames
            for _ in range(5):
                cap.read()
            ret, frame = cap.read()
            if ret and frame is not None and frame.sum() > 0:
                available.append({"index": i, "label": f"Camera {i}"})
            cap.release()
    return JSONResponse({"cameras": available})


@router.get("/api/test/snapshot")
async def get_snapshot(source: str = Query("0")):
    try:
        video_source = int(source) if source.isdigit() else source
    except:
        video_source = source

    cap = cv2.VideoCapture(video_source)

    if not cap.isOpened():
        raise HTTPException(status_code=400, detail=f"Could not open camera {video_source}. Make sure DroidCam is running.")

    # Warm up the camera — virtual cameras like DroidCam need a few frames before returning content
    for _ in range(10):
        cap.read()

    ret, frame = cap.read()
    cap.release()

    if not ret or frame is None:
        raise HTTPException(status_code=400, detail=f"Camera {video_source} opened but could not read a frame.")

    h, w = frame.shape[:2]
    scale = min(1280 / w, 720 / h)
    new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
    frame = cv2.resize(frame, (new_w, new_h))

    b64 = encode_frame_to_base64(frame)
    return JSONResponse({"snapshot": b64, "width": new_w, "height": new_h})


@router.post("/api/test/analyze-video")
async def analyze_video(file: UploadFile = File(...), zones: str = Form(None)):
    # Validate file type
    allowed = ('.mp4', '.avi', '.mov', '.mkv', '.webm')
    if not file.filename.lower().endswith(allowed):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed)}"
        )

    tmp_path = None
    try:
        # ── Stream upload to disk in chunks (avoids memory lock on large files) ──
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                tmp.write(chunk)

        # ── Run CPU-heavy processing off the event loop ──
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            _executor,
            _process_video,
            tmp_path,
            file.filename,
            zones,
        )

        return JSONResponse(result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

@router.websocket("/api/test/stream")
async def stream_video(websocket: WebSocket, source: str = "0", zones: str = None):
    await websocket.accept()

    try:
        video_source = int(source) if source.isdigit() else source
    except:
        video_source = source

    try:
        from ultralytics import YOLO
        model = YOLO("yolov8s.pt")
    except Exception as e:
        await websocket.send_json({"error": f"Could not load YOLO model: {e}"})
        await asyncio.sleep(0.1)
        await websocket.close()
        return

    cap = cv2.VideoCapture(video_source)

    if not cap.isOpened():
        await websocket.send_json({"error": f"Could not open camera {video_source}. Make sure DroidCam is running and the index is correct."})
        await asyncio.sleep(0.1)
        await websocket.close()
        return

    # Warm up — virtual cameras like DroidCam need several frames before producing content
    for _ in range(10):
        cap.read()

    orig_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    width, height = orig_width, orig_height
    if width > 1280:
        scale = 1280 / width
        width = int(width * scale)
        height = int(height * scale)

    tracker = _LocalTracker(model)
    heatmap_gen = _LocalHeatmap(video_w=width, video_h=height, w=640, h=360)

    # ── Real analytics engine instances (writes to DB) ─────────────────────
    from core.analytics import FootfallCounter, TrendAggregator, DwellTimeEngine, SecurityEngine
    footfall_counter = FootfallCounter()
    trend_aggregator = TrendAggregator()
    dwell_engine = DwellTimeEngine()
    security_engine = SecurityEngine()

    from api.camera_routes import load_mappings
    mappings = load_mappings()
    mapped_zone = mappings.get(str(source))

    # ── Zone definitions ───────────────────────────────────────────────────
    if mapped_zone:
        # Treat the entire camera view as the mapped zone
        ZONES = {
            mapped_zone: [(0, 0), (width, 0), (width, height), (0, height)]
        }
        if mapped_zone == "Checkout":
            CHECKOUT_ZONE = [(0, 0), (width, 0), (width, height), (0, height)]
        else:
            # Move checkout zone off-screen so it doesn't trigger if this is purely a Produce camera
            CHECKOUT_ZONE = [(-10, -10), (-5, -10), (-5, -5), (-10, -5)]
    else:
        ZONES = {
            "Zone A (Left)":   [(int(width*0.05), int(height*0.15)), (int(width*0.38), int(height*0.15)), (int(width*0.38), int(height*0.85)), (int(width*0.05), int(height*0.85))],
            "Zone B (Center)": [(int(width*0.38), int(height*0.15)), (int(width*0.62), int(height*0.15)), (int(width*0.62), int(height*0.85)), (int(width*0.38), int(height*0.85))],
            "Zone C (Right)":  [(int(width*0.62), int(height*0.15)), (int(width*0.95), int(height*0.15)), (int(width*0.95), int(height*0.85)), (int(width*0.62), int(height*0.85))],
        }
        # Checkout zone: bottom-center strip — persons here counted as queue
        CHECKOUT_ZONE = [
            (int(width*0.2), int(height*0.65)),
            (int(width*0.8), int(height*0.65)),
            (int(width*0.8), int(height*1.0)),
            (int(width*0.2), int(height*1.0)),
        ]

    def _in_zone(cx, cy, poly):
        from shapely.geometry import Point, Polygon
        try:
            return Polygon(poly).contains(Point(cx, cy))
        except Exception:
            return False

    # Session-level KPI accumulators
    session_unique_ids: set = set()
    last_inv_update = 0.0

    loop = asyncio.get_event_loop()
    target_fps = 5
    frame_delay = 1.0 / target_fps

    # Import queue state updater
    from api.queue_routes import update_queue_state, mark_camera_inactive

    try:
        while True:
            start_time = time.time()

            ret, frame = await loop.run_in_executor(None, cap.read)
            if not ret:
                break

            if orig_width > 1280:
                frame = cv2.resize(frame, (width, height))

            h, w = frame.shape[:2]
            scale = min(640 / w, 640 / h)
            new_w, new_h = max(1, int(w * scale)), max(1, int(h * scale))
            orig_resized = cv2.resize(frame, (new_w, new_h))
            orig_b64 = encode_frame_to_base64(orig_resized)

            def process_single_frame(f, last_inv_update):
                tracks = tracker.infer_and_track(f)
                heatmap_gen.update(tracks)

                # ── Feed into real analytics engines ───────────────────
                person_tracks = [t for t in tracks if t.get('class_id', 0) == 0]
                product_tracks = [t for t in tracks if t.get('class_id', 0) != 0]
                footfall_counter.update(person_tracks)
                trend_aggregator.update(person_tracks)
                dwell_engine.update(person_tracks)
                security_engine.update(person_tracks)

                for t in person_tracks:
                    session_unique_ids.add(t['track_id'])

                queue_persons = sum(
                    1 for t in person_tracks
                    if _in_zone(t['centroid'][0], t['centroid'][1], CHECKOUT_ZONE)
                )
                update_queue_state(queue_persons)

                zone_counts = {z: 0 for z in ZONES}
                for t in person_tracks:
                    cx, cy = t['centroid']
                    for zname, poly in ZONES.items():
                        if _in_zone(cx, cy, poly):
                            zone_counts[zname] += 1
                            break

                # ── Annotate frame ─────────────────────────────────────
                from core.visualization import (
                    detect_staff_heuristic, draw_bounding_box_with_label,
                    draw_queue_metrics, overlay_zones
                )
                from core.config import INTERACTIVE_SHELVES
                from core.inventory import update_store_stock

                annotated = f.copy()
                annotated = overlay_zones(annotated, ZONES)
                
                # Draw Interactive Shelves
                for shelf_name, poly in INTERACTIVE_SHELVES.items():
                    pts = np.array(poly, dtype=np.int32)
                    cv2.polylines(annotated, [pts], isClosed=True, color=(255, 150, 0), thickness=2)
                    
                # Inventory logic
                SHELF_SKU_MAP = {
                    "Produce_Shelf": "SKU_PRODUCE",
                    "Dairy_Shelf": "SKU_DAIRY"
                }
                
                shelf_counts = {shelf: 0 for shelf in INTERACTIVE_SHELVES}
                
                for t in product_tracks:
                    cx, cy = t['centroid']
                    for shelf_name, poly in INTERACTIVE_SHELVES.items():
                        if _in_zone(cx, cy, poly):
                            shelf_counts[shelf_name] += 1
                            break
                            
                # Update DB every 5 seconds
                current_time = time.time()
                if current_time - last_inv_update > 5.0:
                    for shelf_name, count in shelf_counts.items():
                        sku = SHELF_SKU_MAP.get(shelf_name)
                        if sku:
                            update_store_stock("STORE_001", sku, count)
                    last_inv_update = current_time

                # Draw counts on shelves
                for shelf_name, poly in INTERACTIVE_SHELVES.items():
                    count = shelf_counts[shelf_name]
                    cv2.putText(
                        annotated, f"{shelf_name}: {count} items",
                        (poly[0][0], poly[0][1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 150, 0), 2
                    )

                # Draw checkout zone in cyan
                checkout_pts = np.array(CHECKOUT_ZONE, dtype=np.int32)
                cv2.polylines(annotated, [checkout_pts], isClosed=True, color=(0, 220, 255), thickness=2)
                cv2.putText(
                    annotated, f"Checkout ({queue_persons} in queue)",
                    (CHECKOUT_ZONE[0][0] + 5, CHECKOUT_ZONE[0][1] - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 255), 2
                )

                active_shoppers = 0
                staff_count = 0
                live_agents = []

                for t in tracks:
                    bbox = t['bbox']
                    t_id = t['track_id']
                    class_id = t.get('class_id', 0)
                    cx, cy = t['centroid']

                    if class_id != 0:
                        draw_bounding_box_with_label(annotated, bbox, f"Item {t_id}", is_product=True)
                    else:
                        is_staff = detect_staff_heuristic(annotated, bbox)
                        if is_staff:
                            staff_count += 1
                            label = f"ID:{t_id} Staff"
                        else:
                            active_shoppers += 1
                            current_zone = "Floor"
                            for zone_name, poly in ZONES.items():
                                if _in_zone(cx, cy, poly):
                                    current_zone = zone_name
                                    break
                            if _in_zone(cx, cy, CHECKOUT_ZONE):
                                current_zone = "Checkout"
                            label = f"ID:{t_id}"
                        
                        f_h, f_w = f.shape[:2]
                        live_agents.append({
                            "id": t_id,
                            "type": "staff" if is_staff else "shopper",
                            "zone": current_zone if not is_staff else "Floor",
                            "x": cx / f_w,
                            "y": cy / f_h
                        })
                        draw_bounding_box_with_label(annotated, bbox, label, is_staff=is_staff)

                heatmap_img = heatmap_gen.render(orig_resized)
                annotated_resized = cv2.resize(annotated, (new_w, new_h))
                heatmap_resized = cv2.resize(heatmap_img, (new_w, new_h))

                return (
                    encode_frame_to_base64(annotated_resized),
                    encode_frame_to_base64(heatmap_resized),
                    len(person_tracks),
                    active_shoppers,
                    staff_count,
                    queue_persons,
                    zone_counts,
                    live_agents,
                    last_inv_update,
                )

            proc_b64, hm_b64, total_persons, shoppers, staff, queue_count, zone_counts, live_agents, last_inv_update = \
                await loop.run_in_executor(_executor, process_single_frame, frame, last_inv_update)

            await websocket.send_json({
                "original": orig_b64,
                "processed": proc_b64,
                "heatmap": hm_b64,
                "kpis": {
                    "total_persons": total_persons,
                    "shoppers": shoppers,
                    "staff": staff,
                    "queue_count": queue_count,
                    "session_unique": len(session_unique_ids),
                    "zone_counts": zone_counts,
                },
                "live_agents": live_agents
            })

            elapsed = time.time() - start_time
            sleep_time = frame_delay - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS error: {e}")
    finally:
        cap.release()
        mark_camera_inactive()


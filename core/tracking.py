import cv2
import numpy as np
from collections import deque, OrderedDict
import threading
import time
import os
from typing import List, Dict, Any

from .config import (
    GSTREAMER_PIPELINE, RTSP_URL, PRODUCT_CLASSES,
    YOLO_CONF_THRESHOLD, YOLO_IOU_THRESHOLD, YOLO_IMGSZ,
    YOLO_MAX_DET, YOLO_DEVICE, DEMOGRAPHICS_CACHE_MAX
)

class VideoStreamBuffer:
    def __init__(self, use_gstreamer=False):
        self.frame_buffer = deque(maxlen=30)
        self.running = False
        self.capture_thread = None
        self.use_gstreamer = use_gstreamer

    def start(self):
        self.running = True
        self.capture_thread = threading.Thread(target=self._update, daemon=True)
        self.capture_thread.start()

    def _update(self):
        # BUG-FIX: `source` was undefined. Now correctly reads RTSP_URL from config
        # and converts to int for USB camera indices (e.g. "1" -> 1).
        raw = RTSP_URL
        source = int(raw) if raw.isdigit() else raw

        # Choose backend: CAP_DSHOW works best for USB cameras on Windows
        if isinstance(source, int):
            api_pref = cv2.CAP_DSHOW
        else:
            api_pref = cv2.CAP_GSTREAMER if self.use_gstreamer else cv2.CAP_FFMPEG

        cap = cv2.VideoCapture(source, api_pref)
        if not cap.isOpened():
            print(f"[Error] Could not open video stream: {source}")
            self.running = False
            return

        # Warm up — virtual cameras need a few frames before producing content
        for _ in range(5):
            cap.read()

        while self.running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue
            self.frame_buffer.append(frame)
        cap.release()

    def get_latest_frame(self):
        if self.frame_buffer:
            return self.frame_buffer[-1]
        return None

    def stop(self):
        self.running = False
        if self.capture_thread:
            self.capture_thread.join(timeout=3.0)


class _LRUCache:
    """Fixed-size LRU cache to prevent unbounded memory growth in demographics."""

    def __init__(self, maxsize=500):
        self._cache = OrderedDict()
        self.maxsize = maxsize

    def get(self, key, default=None):
        if key not in self._cache:
            return default
        self._cache.move_to_end(key)
        return self._cache[key]

    def __contains__(self, key):
        return key in self._cache

    def __setitem__(self, key, value):
        if key in self._cache:
            self._cache.move_to_end(key)
        self._cache[key] = value
        if len(self._cache) > self.maxsize:
            self._cache.popitem(last=False)

    def __getitem__(self, key):
        return self.get(key)

import os
from database.store_db import db

class DemographicsEngine:
    """Infers age/gender from the FACE region (top 30%) of a detected person."""

    def __init__(self):
        self.age_net     = None
        self.gender_net  = None
        self.age_list    = ['(0-2)', '(4-6)', '(8-12)', '(15-20)',
                            '(25-32)', '(38-43)', '(48-53)', '(60-100)']
        self.gender_list = ['Male', 'Female']
        self.load_models()
        # LRU cache — bounded to DEMOGRAPHICS_CACHE_MAX entries
        self.cache = _LRUCache(maxsize=DEMOGRAPHICS_CACHE_MAX)

    def load_models(self):
        age_proto = "models/age_deploy.prototxt"
        age_model = "models/age_net.caffemodel"
        gender_proto = "models/gender_deploy.prototxt"
        gender_model = "models/gender_net.caffemodel"
        if os.path.exists(age_proto) and os.path.exists(age_model):
            try:
                self.age_net = cv2.dnn.readNetFromCaffe(age_proto, age_model)
                self.gender_net = cv2.dnn.readNetFromCaffe(gender_proto, gender_model)
                print("[Info] Loaded OpenCV DNN Demographics models.")
            except Exception as e:
                print(f"[Warning] Failed to load demographics models: {e}")
        else:
            print("[Warning] Demographics models not found in models/ directory.")

    def infer(self, frame, bbox, track_id):
        if track_id in self.cache:
            return self.cache[track_id]
            
        if self.age_net is None or self.gender_net is None:
            return "Unknown", "Unknown"
            
        x1, y1, x2, y2 = [int(v) for v in bbox]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)

        # BUG-FIX: Crop only the TOP 30% of the person bbox as the face region.
        # Age/gender models expect a face image — the full body gives near-random
        # predictions. Top-30% is a reliable face heuristic for standing persons.
        h_person  = y2 - y1
        face_y2   = y1 + max(30, int(h_person * 0.30))  # at least 30px tall
        face_crop = frame[y1:face_y2, x1:x2]
        if face_crop.size == 0:
            return "Unknown", "Unknown"
            
        blob = cv2.dnn.blobFromImage(face_crop, 1.0, (227, 227), (78.4263377603, 87.7689143744, 114.895847746), swapRB=False)
        
        self.gender_net.setInput(blob)
        gender_preds = self.gender_net.forward()
        gender = self.gender_list[gender_preds[0].argmax()]
        
        self.age_net.setInput(blob)
        age_preds = self.age_net.forward()
        age = self.age_list[age_preds[0].argmax()]
        
        self.cache[track_id] = (age, gender)
        db.log_demographics(track_id, age, gender)
        return age, gender

class Tracker:
    """
    YOLO11s + ByteTrack (retail-tuned) inference and tracking wrapper.

    Accuracy settings (production-optimised):
      conf=0.3   -> catches partially-occluded shoppers in dense retail scenes
      iou=0.45   -> balanced NMS to avoid merging nearby people
      imgsz=640  -> optimal YOLO11s input resolution
      tracker    -> bytetrack_retail.yaml tuned for slow indoor movement
      device     -> GPU if available, else CPU (auto-detected)
    """

    def __init__(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO("yolo11s.pt")
            print(f"[Info] Loaded YOLO11s (47.0 mAP COCO) on device={YOLO_DEVICE}.")
            print(f"[Info] Detection: conf={YOLO_CONF_THRESHOLD}, "
                  f"iou={YOLO_IOU_THRESHOLD}, imgsz={YOLO_IMGSZ}, max_det={YOLO_MAX_DET}")
        except ImportError:
            print("[Warning] ultralytics not installed. Tracking won't work.")
            self.model = None

        self.demographics   = DemographicsEngine()
        self.person_id_map  = {}    # raw tracker id -> sequential display id
        self.next_person_id = 1

        # Resolve tracker config — prefer retail-tuned yaml if present
        _retail_yaml = os.path.join(
            os.path.dirname(__file__), "..", "bytetrack_retail.yaml"
        )
        self._tracker_cfg = (
            os.path.abspath(_retail_yaml)
            if os.path.exists(_retail_yaml)
            else "bytetrack.yaml"
        )
        print(f"[Info] Using tracker config: {self._tracker_cfg}")

    def infer_and_track(self, frame) -> List[Dict[str, Any]]:
        if self.model is None:
            return []
            
        results = self.model.track(
            frame,
            classes=[0] + PRODUCT_CLASSES,
            conf=YOLO_CONF_THRESHOLD,
            iou=YOLO_IOU_THRESHOLD,
            imgsz=YOLO_IMGSZ,
            max_det=YOLO_MAX_DET,
            device=YOLO_DEVICE,
            persist=True,
            tracker=self._tracker_cfg,
            verbose=False,
        )

        active_tracks = []
        for r in results:
            if r.boxes.id is None:
                continue
            boxes     = r.boxes.xyxy.cpu().numpy()
            track_ids = r.boxes.id.int().cpu().numpy()
            scores    = r.boxes.conf.cpu().numpy()
            class_ids = r.boxes.cls.int().cpu().numpy()

            for box, raw_t_id, score, cls_id in zip(boxes, track_ids, scores, class_ids):
                display_id = int(raw_t_id)

                age, gender = "N/A", "N/A"
                if cls_id == 0:  # person
                    if raw_t_id not in self.person_id_map:
                        self.person_id_map[raw_t_id] = self.next_person_id
                        self.next_person_id += 1
                    display_id = self.person_id_map[raw_t_id]
                    age, gender = self.demographics.infer(frame, box, display_id)

                cx = float((box[0] + box[2]) / 2)
                cy = float((box[1] + box[3]) / 2)

                active_tracks.append({
                    'track_id': display_id,
                    'bbox':     box.tolist(),
                    'score':    float(score),
                    'class_id': int(cls_id),
                    'centroid': (cx, cy),
                    'age':      age,
                    'gender':   gender,
                })

        return active_tracks

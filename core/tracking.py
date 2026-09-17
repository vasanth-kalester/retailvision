import cv2
import numpy as np
from collections import deque
import threading
import time
from typing import List, Dict, Any

from .config import GSTREAMER_PIPELINE, RTSP_URL, PRODUCT_CLASSES

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
        # Choose appropriate backend: CAP_DSHOW works best for USB cameras on Windows
        if isinstance(source, int):
            api_pref = cv2.CAP_DSHOW
        else:
            api_pref = cv2.CAP_GSTREAMER if self.use_gstreamer else cv2.CAP_FFMPEG
        cap = cv2.VideoCapture(source, api_pref)
        if not cap.isOpened():
            print(f"[Error] Could not open video stream: {source}")
            self.running = False
            return
            
        while self.running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue
            self.frame_buffer.append(frame)
        cap.release()

    def get_latest_frame(self):
        if len(self.frame_buffer) > 0:
            return self.frame_buffer[-1]
        return None

    def stop(self):
        self.running = False
        if self.capture_thread:
            self.capture_thread.join()

import os
from database.store_db import db

class DemographicsEngine:
    def __init__(self):
        self.age_net = None
        self.gender_net = None
        self.age_list = ['(0-2)', '(4-6)', '(8-12)', '(15-20)', '(25-32)', '(38-43)', '(48-53)', '(60-100)']
        self.gender_list = ['Male', 'Female']
        self.load_models()
        self.cache = {} # track_id -> (age, gender)

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
        face_crop = frame[y1:y2, x1:x2]
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
    def __init__(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO("yolov8s.pt")
            print("[Info] Loaded Ultralytics YOLOv8s for live MVP.")
        except ImportError:
            print("[Warning] ultralytics not installed. Tracking won't work.")
            self.model = None
        self.demographics = DemographicsEngine()
        self.person_id_map = {}
        self.next_person_id = 1

    def infer_and_track(self, frame) -> List[Dict[str, Any]]:
        if self.model is None:
            return []
            
        # Use YOLOv8's native BoT-SORT for better ReID to keep IDs unique per person
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
                
                # Infer demographics for humans (class 0)
                age, gender = "N/A", "N/A"
                if cls_id == 0:
                    if raw_t_id not in self.person_id_map:
                        self.person_id_map[raw_t_id] = self.next_person_id
                        self.next_person_id += 1
                    display_id = self.person_id_map[raw_t_id]
                    age, gender = self.demographics.infer(frame, box, display_id)
                
                active_tracks.append({
                    'track_id': int(display_id),
                    'bbox': box.tolist(),
                    'score': float(score),
                    'class_id': int(cls_id),
                    'centroid': ((box[0] + box[2])/2, (box[1] + box[3])/2),
                    'age': age,
                    'gender': gender
                })
                
        return active_tracks

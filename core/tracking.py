import cv2
import numpy as np
from collections import deque
import threading
import time
from typing import List, Dict, Any

from .config import GSTREAMER_PIPELINE, RTSP_URL

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
        source = GSTREAMER_PIPELINE if self.use_gstreamer else RTSP_URL
        if isinstance(source, str) and source.isdigit():
            source = int(source)
            api_pref = cv2.CAP_ANY
        else:
            api_pref = cv2.CAP_GSTREAMER if self.use_gstreamer else cv2.CAP_FFMPEG
            
        cap = cv2.VideoCapture(source, api_pref)
        if not cap.isOpened():
            print(f"[Error] Could not open video stream: {source}")
            cap = cv2.VideoCapture(0)
            
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

class TrackState:
    _id_count = 0
    def __init__(self, bbox, score):
        # State space mock for ByteTrack (simplified for live MVP without heavy filterpy dependency)
        TrackState._id_count += 1
        self.track_id = TrackState._id_count
        self.score = score
        self.time_since_update = 0
        self.bbox = bbox

    def predict(self):
        self.time_since_update += 1

    def update(self, bbox, score):
        self.time_since_update = 0
        self.score = score
        self.bbox = bbox

class Tracker:
    def __init__(self):
        try:
            from ultralytics import YOLO
            self.model = YOLO("yolov8n.pt")
            print("[Info] Loaded Ultralytics YOLOv8n for live MVP.")
        except ImportError:
            print("[Warning] ultralytics not installed. Tracking won't work.")
            self.model = None
        self.tracks: List[TrackState] = []

    def infer_and_track(self, frame) -> List[Dict[str, Any]]:
        if self.model is None:
            return []
            
        results = self.model(frame, classes=[0], verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                score = box.conf[0].cpu().item()
                detections.append([x1, y1, x2, y2, score, 0])
                
        # Basic matching logic (simplified ByteTrack association)
        # In a real edge scenario, we use full IoU matrix. For this refactor MVP:
        active_tracks = []
        for det in detections:
            bbox = det[:4]
            # Find closest track based on centroid distance (rough association)
            cx, cy = (bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2
            matched = False
            for t in self.tracks:
                tcx, tcy = (t.bbox[0]+t.bbox[2])/2, (t.bbox[1]+t.bbox[3])/2
                if abs(cx - tcx) < 100 and abs(cy - tcy) < 100 and t.time_since_update < 5:
                    t.update(bbox, det[4])
                    matched = True
                    break
            if not matched:
                new_t = TrackState(bbox, det[4])
                self.tracks.append(new_t)

        for t in self.tracks:
            t.predict()
            
        self.tracks = [t for t in self.tracks if t.time_since_update <= 10]
        
        for t in self.tracks:
            if t.time_since_update == 0:
                active_tracks.append({
                    'track_id': t.track_id,
                    'bbox': t.bbox,
                    'score': t.score,
                    'centroid': ((t.bbox[0] + t.bbox[2])/2, (t.bbox[1] + t.bbox[3])/2)
                })
        return active_tracks

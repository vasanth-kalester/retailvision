import math
import time
import numpy as np
import cv2
from scipy.ndimage import gaussian_filter
from collections import defaultdict
from shapely.geometry import Point, Polygon
from typing import Dict, Any, List, Tuple

from .config import (
    ENTRY_EXIT_LINE, MIN_CROSSING_VELOCITY, OPERATIONAL_ZONES, 
    PROMOTIONAL_DISPLAYS, DWELL_TIME_THRESHOLD_SEC,
    HEATMAP_RESOLUTION, HEATMAP_DECAY_FACTOR, HEATMAP_GAUSSIAN_SIGMA,
    CALIBRATION_PIXELS, CALIBRATION_WORLD
)
from database.store_db import db

# --- Geometry Utilities ---
def vector_cross_product(A, B, P) -> float:
    return (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0])

def is_point_in_polygon(point, poly_coords) -> bool:
    if len(poly_coords) < 3: return False
    return Polygon(poly_coords).contains(Point(point[0], point[1]))

def compute_homography(src, dst):
    H, _ = cv2.findHomography(np.array(src, dtype=np.float32), np.array(dst, dtype=np.float32))
    return H

def project_point(H, x, y):
    pt = np.dot(H, np.array([x, y, 1.0]))
    w = pt[2]
    return (float(pt[0]/w), float(pt[1]/w)) if w != 0 else (0.0, 0.0)

# --- Analytics Engines ---

class FootfallCounter:
    def __init__(self):
        self.history = {}
        self.line_A, self.line_B = ENTRY_EXIT_LINE

    def update(self, tracks):
        current_time = time.time()
        active_ids = set()

        for track in tracks:
            t_id, curr_pos = track['track_id'], track['centroid']
            active_ids.add(t_id)

            if t_id not in self.history:
                cross = vector_cross_product(self.line_A, self.line_B, curr_pos)
                self.history[t_id] = {'last_pos': curr_pos, 'last_cross': 1 if cross > 0 else -1, 'last_time': current_time, 'counted': False}
                continue

            prev = self.history[t_id]
            dt = current_time - prev['last_time']
            velocity = math.hypot(curr_pos[0] - prev['last_pos'][0], curr_pos[1] - prev['last_pos'][1]) / dt if dt > 0 else 0

            curr_cross = 1 if vector_cross_product(self.line_A, self.line_B, curr_pos) > 0 else -1

            if curr_cross != prev['last_cross'] and not prev['counted'] and velocity >= MIN_CROSSING_VELOCITY:
                direction = "ENTRY" if prev['last_cross'] < 0 else "EXIT"
                print(f"[Analytics] {direction} recorded for ID {t_id}")
                db.log_footfall(t_id, direction)
                self.history[t_id]['counted'] = True

            self.history[t_id].update({'last_pos': curr_pos, 'last_cross': curr_cross, 'last_time': current_time})

        for t_id in list(self.history.keys()):
            if t_id not in active_ids and current_time - self.history[t_id]['last_time'] > 5.0:
                del self.history[t_id]

class TrendAggregator:
    def __init__(self):
        self.interval_sec = 15 * 60
        self.current_bucket = self._get_bucket(time.time())
        self.zone_occupancy = defaultdict(lambda: defaultdict(set))

    def _get_bucket(self, ts):
        return (int(ts) // self.interval_sec) * self.interval_sec

    def update(self, tracks):
        now = time.time()
        bucket = self._get_bucket(now)

        if bucket > self.current_bucket:
            self._flush_bucket(self.current_bucket)
            self.current_bucket = bucket

        for track in tracks:
            for zone_name, poly in OPERATIONAL_ZONES.items():
                if is_point_in_polygon(track['centroid'], poly):
                    self.zone_occupancy[bucket][zone_name].add(track['track_id'])
                    break

    def _flush_bucket(self, bucket_ts):
        if bucket_ts in self.zone_occupancy:
            for zone_name, unique_ids in self.zone_occupancy[bucket_ts].items():
                db.log_zone_metrics(zone_name, len(unique_ids))
            del self.zone_occupancy[bucket_ts]

class DwellTimeEngine:
    def __init__(self):
        self.active_dwells = {}

    def update(self, tracks):
        now, active_ids = time.time(), set()

        for track in tracks:
            t_id, centroid = track['track_id'], track['centroid']
            active_ids.add(t_id)
            if t_id not in self.active_dwells: self.active_dwells[t_id] = {}

            for zone_name, poly in PROMOTIONAL_DISPLAYS.items():
                in_zone = is_point_in_polygon(centroid, poly)
                if in_zone and zone_name not in self.active_dwells[t_id]:
                    self.active_dwells[t_id][zone_name] = now
                elif not in_zone and zone_name in self.active_dwells[t_id]:
                    entry_time = self.active_dwells[t_id].pop(zone_name)
                    duration = now - entry_time
                    if duration >= DWELL_TIME_THRESHOLD_SEC:
                        db.log_dwell_time(t_id, zone_name, entry_time, now, duration)

        for t_id in list(self.active_dwells.keys()):
            if t_id not in active_ids:
                for zone_name, entry_time in self.active_dwells[t_id].items():
                    duration = now - entry_time
                    if duration >= DWELL_TIME_THRESHOLD_SEC:
                        db.log_dwell_time(t_id, zone_name, entry_time, now, duration)
                del self.active_dwells[t_id]

class HeatmapGenerator:
    def __init__(self):
        self.h, self.w = HEATMAP_RESOLUTION
        self.density_matrix = np.zeros((self.h, self.w), dtype=np.float32)
        self.H = compute_homography(CALIBRATION_PIXELS, CALIBRATION_WORLD)

    def update(self, tracks):
        self.density_matrix *= HEATMAP_DECAY_FACTOR
        for track in tracks:
            u, v = (track['bbox'][0] + track['bbox'][2]) / 2, track['bbox'][3]
            X, Y = project_point(self.H, u, v)
            map_x, map_y = int((X / 10.0) * self.w), int((Y / 8.0) * self.h)
            if 0 <= map_x < self.w and 0 <= map_y < self.h:
                self.density_matrix[map_y, map_x] += 10.0

    def get_heatmap_image(self) -> np.ndarray:
        blurred = gaussian_filter(self.density_matrix, sigma=HEATMAP_GAUSSIAN_SIGMA)
        max_val = np.max(blurred)
        return cv2.applyColorMap(np.clip(normalized, 0, 255).astype(np.uint8), cv2.COLORMAP_JET)

class SecurityEngine:
    """Detects suspicious behavior (loitering) based on global dwell time."""
    def __init__(self, loiter_threshold_sec: float = 45.0):
        self.track_start_times = {}
        self.loiter_threshold_sec = loiter_threshold_sec

    def update(self, tracks):
        now = time.time()
        active_ids = set()

        for track in tracks:
            t_id = track['track_id']
            active_ids.add(t_id)

            if t_id not in self.track_start_times:
                self.track_start_times[t_id] = now
            else:
                duration = now - self.track_start_times[t_id]
                if duration > self.loiter_threshold_sec:
                    # Emit alert to DB (this is picked up by security_routes)
                    db.log_security_alert(t_id, duration)

        # Cleanup lost tracks
        for t_id in list(self.track_start_times.keys()):
            if t_id not in active_ids:
                del self.track_start_times[t_id]

class AnalyticsOrchestrator:
    def __init__(self):
        self.footfall = FootfallCounter()
        self.trend = TrendAggregator()
        self.dwell = DwellTimeEngine()
        self.heatmap = HeatmapGenerator()
        self.security = SecurityEngine()

    def process(self, tracks):
        self.footfall.update(tracks)
        self.trend.update(tracks)
        self.dwell.update(tracks)
        self.heatmap.update(tracks)
        self.security.update(tracks)

    def get_heatmap(self):
        return self.heatmap.get_heatmap_image()

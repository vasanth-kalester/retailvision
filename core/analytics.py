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
    CALIBRATION_PIXELS, CALIBRATION_WORLD, WORLD_WIDTH_M, WORLD_HEIGHT_M,
    INTERACTIVE_SHELVES, PRODUCT_INTERACTION_THRESHOLD_SEC,
    STAFF_INTERACTION_DIST_PIXELS, STAFF_INTERACTION_TIME_SEC,
    SECURITY_ALERT_COOLDOWN_SEC, JOURNEY_SAMPLE_EVERY_N_FRAMES
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
                side = 1 if cross > 0 else -1
                self.history[t_id] = {
                    'last_pos': curr_pos, 'last_cross': side,
                    'original_cross': side,  # track which side they started on
                    'last_time': current_time, 'counted': False
                }
                continue

            prev = self.history[t_id]
            dt = current_time - prev['last_time']
            velocity = math.hypot(curr_pos[0] - prev['last_pos'][0], curr_pos[1] - prev['last_pos'][1]) / dt if dt > 0 else 0

            curr_cross = 1 if vector_cross_product(self.line_A, self.line_B, curr_pos) > 0 else -1

            if curr_cross != prev['last_cross'] and velocity >= MIN_CROSSING_VELOCITY:
                if not prev['counted']:
                    direction = "ENTRY" if prev['last_cross'] < 0 else "EXIT"
                    print(f"[Analytics] {direction} recorded for ID {t_id}")
                    db.log_footfall(t_id, direction)
                    self.history[t_id]['counted'] = True
                # BUG-FIX: Reset counted flag when person returns to original side
                # so re-entry is counted correctly on next crossing.
            elif curr_cross == self.history[t_id].get('original_cross', curr_cross):
                self.history[t_id]['counted'] = False

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
            # BUG-FIX: Use dynamic world bounds from config (WORLD_WIDTH_M/WORLD_HEIGHT_M)
            # instead of hardcoded 10.0/8.0 which would be wrong for any other store layout.
            map_x = int((X / max(WORLD_WIDTH_M,  1.0)) * self.w)
            map_y = int((Y / max(WORLD_HEIGHT_M, 1.0)) * self.h)
            if 0 <= map_x < self.w and 0 <= map_y < self.h:
                self.density_matrix[map_y, map_x] += 10.0

    def get_heatmap_image(self) -> np.ndarray:
        blurred = gaussian_filter(self.density_matrix, sigma=HEATMAP_GAUSSIAN_SIGMA)
        max_val = np.max(blurred)
        normalized = (blurred / max(max_val, 1e-5)) * 255.0
        return cv2.applyColorMap(np.clip(normalized, 0, 255).astype(np.uint8), cv2.COLORMAP_JET)

class SecurityEngine:
    """Detects suspicious behavior (loitering) based on global dwell time."""

    def __init__(self, loiter_threshold_sec: float = 45.0):
        self.track_start_times = {}
        self.last_alert_times  = {}   # track_id -> last alert timestamp
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
                    # BUG-FIX: Throttle DB writes to once per SECURITY_ALERT_COOLDOWN_SEC.
                    # Previously fired on EVERY frame (~30x/sec) once threshold exceeded,
                    # flooding the security_alerts table.
                    last_alert = self.last_alert_times.get(t_id, 0)
                    if now - last_alert >= SECURITY_ALERT_COOLDOWN_SEC:
                        db.log_security_alert(t_id, duration)
                        self.last_alert_times[t_id] = now

        # Cleanup lost tracks
        for t_id in list(self.track_start_times.keys()):
            if t_id not in active_ids:
                del self.track_start_times[t_id]
                self.last_alert_times.pop(t_id, None)

class JourneyEngine:
    """Records shopper paths. Subsamples to avoid memory bloat in long sessions."""

    def __init__(self):
        self.active_journeys = {}   # track_id -> list of centroids
        self._frame_counter  = {}   # track_id -> frame count since last sample

    def update(self, tracks):
        active_ids = set()
        for track in tracks:
            t_id     = track['track_id']
            centroid = track['centroid']
            active_ids.add(t_id)

            if t_id not in self.active_journeys:
                self.active_journeys[t_id] = [centroid]
                self._frame_counter[t_id]  = 0
            else:
                # BUG-FIX: Subsample — only record every JOURNEY_SAMPLE_EVERY_N_FRAMES
                # frames. Without this, a 4-hour session with 200 shoppers at 30 FPS
                # would accumulate 3.6M centroid tuples in RAM.
                self._frame_counter[t_id] += 1
                if self._frame_counter[t_id] >= JOURNEY_SAMPLE_EVERY_N_FRAMES:
                    self.active_journeys[t_id].append(centroid)
                    self._frame_counter[t_id] = 0

        for t_id in list(self.active_journeys.keys()):
            if t_id not in active_ids:
                # Track ended, flush journey
                if len(self.active_journeys[t_id]) > 5:  # Only log meaningful journeys
                    db.log_journey(t_id, self.active_journeys[t_id])
                del self.active_journeys[t_id]
                self._frame_counter.pop(t_id, None)

class StaffServiceEngine:
    def __init__(self):
        self.interaction_states = {} # (staff_id, shopper_id) -> start_time

    def update(self, tracks, staff_ids):
        now = time.time()
        active_pairs = set()
        
        shoppers = [t for t in tracks if t['track_id'] not in staff_ids]
        staff = [t for t in tracks if t['track_id'] in staff_ids]
        
        for s in staff:
            for sh in shoppers:
                dist = math.hypot(s['centroid'][0] - sh['centroid'][0], s['centroid'][1] - sh['centroid'][1])
                if dist < STAFF_INTERACTION_DIST_PIXELS:
                    pair = (s['track_id'], sh['track_id'])
                    active_pairs.add(pair)
                    if pair not in self.interaction_states:
                        self.interaction_states[pair] = now
                    else:
                        duration = now - self.interaction_states[pair]
                        if duration > STAFF_INTERACTION_TIME_SEC:
                            db.log_staff_interaction(pair[0], pair[1], duration)
                            # Reset to avoid spamming the DB every frame for the same interaction
                            self.interaction_states[pair] = now
                            
        for pair in list(self.interaction_states.keys()):
            if pair not in active_pairs:
                del self.interaction_states[pair]

class ProductInteractionEngine:
    def __init__(self):
        self.active_interactions = {}

    def update(self, tracks):
        now, active_ids = time.time(), set()

        for track in tracks:
            t_id, bbox = track['track_id'], track['bbox']
            active_ids.add(t_id)
            if t_id not in self.active_interactions: self.active_interactions[t_id] = {}

            # Create a point from the bottom center of the bounding box (hands/reach area approximation)
            reach_point = ((bbox[0] + bbox[2]) / 2, bbox[3] - (bbox[3]-bbox[1])*0.3)

            for shelf_name, poly in INTERACTIVE_SHELVES.items():
                in_zone = is_point_in_polygon(reach_point, poly) or is_point_in_polygon(track['centroid'], poly)
                if in_zone and shelf_name not in self.active_interactions[t_id]:
                    self.active_interactions[t_id][shelf_name] = now
                elif not in_zone and shelf_name in self.active_interactions[t_id]:
                    entry_time = self.active_interactions[t_id].pop(shelf_name)
                    duration = now - entry_time
                    if duration >= PRODUCT_INTERACTION_THRESHOLD_SEC:
                        # Re-use dwell time logging for product interaction for MVP, or log it
                        db.log_dwell_time(t_id, shelf_name, entry_time, now, duration)

        for t_id in list(self.active_interactions.keys()):
            if t_id not in active_ids:
                for shelf_name, entry_time in self.active_interactions[t_id].items():
                    duration = now - entry_time
                    if duration >= PRODUCT_INTERACTION_THRESHOLD_SEC:
                        db.log_dwell_time(t_id, shelf_name, entry_time, now, duration)
                del self.active_interactions[t_id]

class AnalyticsOrchestrator:
    def __init__(self):
        self.footfall = FootfallCounter()
        self.trend = TrendAggregator()
        self.dwell = DwellTimeEngine()
        self.heatmap = HeatmapGenerator()
        self.security = SecurityEngine()
        self.journey = JourneyEngine()
        self.staff_service = StaffServiceEngine()
        self.product_interaction = ProductInteractionEngine()

    def process(self, tracks, staff_ids):
        self.footfall.update(tracks)
        self.trend.update(tracks)
        self.dwell.update(tracks)
        self.heatmap.update(tracks)
        self.security.update(tracks)
        self.journey.update(tracks)
        self.staff_service.update(tracks, staff_ids)
        self.product_interaction.update(tracks)

    def get_heatmap(self):
        return self.heatmap.get_heatmap_image()

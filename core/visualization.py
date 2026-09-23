import cv2
import numpy as np
from .config import STAFF_UNIFORM_COLOR_BGR, COLOR_TOLERANCE


def draw_bounding_box_with_label(frame, bbox, label, is_staff=False, is_product=False):
    """
    Draws a clean bounding box with a background-filled label above it.
    """
    x1, y1, x2, y2 = map(int, bbox)
    
    # Colors
    if is_product:
        box_color = (0, 165, 255) # Orange for products
    else:
        box_color = (0, 255, 0) # Green for shopper
        
    text_color = (255, 255, 255)
    
    # Draw BBox
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
    
    # Calculate Text Size
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.5
    thickness = 1
    (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    
    # Draw Background Rect for Text
    bg_y1 = max(0, y1 - text_height - 10)
    cv2.rectangle(frame, (x1, bg_y1), (x1 + text_width + 10, y1), box_color, -1)
    
    # Draw Text
    cv2.putText(frame, label, (x1 + 5, y1 - 5), font, font_scale, text_color, thickness)

def draw_queue_metrics(frame, bbox, wait_time_str):
    """
    Draws an overlay indicating wait time for a person in a queue.
    """
    x1, y1, x2, y2 = map(int, bbox)
    
    label = f"Wait: {wait_time_str}"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.5
    thickness = 1
    
    (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
    
    # Position text inside top of bounding box
    text_x = x1 + (x2 - x1) // 2 - text_width // 2
    text_y = y1 + text_height + 5
    
    # Dark semi-transparent background
    overlay = frame.copy()
    cv2.rectangle(overlay, (text_x - 5, text_y - text_height - 5), (text_x + text_width + 5, text_y + 5), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    
    cv2.putText(frame, label, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)

def overlay_heatmap_pip(frame, heatmap_img, active_shoppers, _unused=0):
    """
    Overlays the heatmap as a Picture-in-Picture in the top right corner.
    """
    if heatmap_img is None:
        return frame
        
    pip_w, pip_h = 320, 180
    resized_heatmap = cv2.resize(heatmap_img, (pip_w, pip_h))
    
    h, w, _ = frame.shape
    margin = 20
    
    # PIP Coordinates
    x1 = w - pip_w - margin
    y1 = margin
    x2 = w - margin
    y2 = margin + pip_h
    
    # Add a border and title to PIP
    frame[y1:y2, x1:x2] = resized_heatmap
    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 2)
    
    # Draw PIP Title background
    cv2.rectangle(frame, (x1, y1 - 40), (x2, y1), (0, 0, 0), -1)
    
    # Draw Text
    cv2.putText(frame, "SAFEWATCH AI TRACKING:", (x1 + 5, y1 - 25), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    cv2.putText(frame, f"{active_shoppers} Active Shoppers", (x1 + 5, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
    
    return frame

def overlay_zones(frame, zones_dict):
    """
    Draws the configured zones onto the frame.
    """
    overlay = frame.copy()
    for name, poly in zones_dict.items():
        pts = np.array(poly, np.int32).reshape((-1, 1, 2))
        cv2.polylines(frame, [pts], isClosed=True, color=(255, 0, 255), thickness=2)
        
        # Calculate centroid to put label
        M = cv2.moments(pts)
        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            cv2.putText(frame, name, (cX - 20, cY), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)
            
    return frame

def draw_trajectory(frame, history_pts, color=(0, 255, 0), thickness=2):
    """
    Draws a line connecting the history of points for a single track.
    """
    if len(history_pts) < 2:
        return
        
    for i in range(1, len(history_pts)):
        pt1 = tuple(map(int, history_pts[i-1]))
        pt2 = tuple(map(int, history_pts[i]))
        cv2.line(frame, pt1, pt2, color, thickness)

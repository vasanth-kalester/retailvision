import cv2
import numpy as np
from ultralytics import YOLO
from scipy.ndimage import gaussian_filter
import os
import argparse

def generate_heatmap_video(video_path, output_path, model_path="yolo11s.pt", limit_frames=None):
    if not os.path.exists(video_path):
        print(f"Error: Video file '{video_path}' not found!")
        return

    print(f"Generating heatmap for {video_path}...")
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))
    
    print(f"Loading model {model_path}...")
    model = YOLO(model_path)
    
    # Use a smaller map for density to speed up gaussian filter, then resize
    map_w, map_h = w // 2, h // 2
    density = np.zeros((map_h, map_w), dtype=np.float32)
    
    frame_count = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if limit_frames and frame_count >= limit_frames:
            break
            
        # Optional: resize frame for faster inference if needed, but keeping original for now
        results = model.predict(frame, classes=[0], verbose=False, imgsz=640) 
        
        # Decay density over time (temporal heatmap)
        density *= 0.98 
        
        for r in results:
            boxes = r.boxes.xyxy.cpu().numpy()
            for box in boxes:
                cx = int((box[0] + box[2]) / 4) # scaled down
                feet_y = int(box[3] / 2)        # scaled down (using feet for footfall)
                if 0 <= cx < map_w and 0 <= feet_y < map_h:
                    density[feet_y, cx] += 15.0
                    
        blurred = gaussian_filter(density, sigma=12)
        mx = np.max(blurred)
        if mx > 0:
            normed = (blurred / mx * 255).astype(np.uint8)
        else:
            normed = blurred.astype(np.uint8)
            
        heatmap_color = cv2.applyColorMap(normed, cv2.COLORMAP_JET)
        
        # Resize heatmap back to original frame size
        heatmap_color_full = cv2.resize(heatmap_color, (w, h))
        
        # Write the pure heatmap (full blue background) directly
        out.write(heatmap_color_full)
        
        frame_count += 1
        if frame_count % 30 == 0:
            print(f"Processed {frame_count}/{total_frames} frames ({(frame_count/total_frames*100):.1f}%)")

    cap.release()
    out.release()
    print(f"\nHeatmap video successfully saved to: {os.path.abspath(output_path)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", default="demo_footage/footfall.mp4", help="Path to input video")
    parser.add_argument("--output", default="demo_outputs/heatmap_video.mp4", help="Path to output video")
    parser.add_argument("--frames", type=int, default=None, help="Limit number of frames to process")
    args = parser.parse_args()
    
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    generate_heatmap_video(args.video, args.output, limit_frames=args.frames)

import concurrent.futures
from ultralytics import YOLO

def test():
    print("Loading YOLO...")
    model = YOLO("yolov8n.pt")
    print("YOLO loaded!")
    return model

if __name__ == "__main__":
    e = concurrent.futures.ThreadPoolExecutor(1)
    f = e.submit(test)
    print("Result:", f.result(timeout=10))

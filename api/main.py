from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from .database import fetch_footfall_summary, fetch_zone_trends, fetch_dwell_times
from .test_endpoint import router as test_router

# Ensure outputs directory exists
os.makedirs(os.path.join(os.path.dirname(__file__), "outputs"), exist_ok=True)

# No body-size cap — large video uploads are streamed to disk in chunks
app = FastAPI(title="Shopper Analytics API")

# Mount outputs for processed videos
app.mount("/outputs", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "outputs")), name="outputs")

# Allow frontend to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev: allow all. Restrict in production.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(test_router)

@app.get("/api/metrics/footfall")
def get_footfall():
    return fetch_footfall_summary()

@app.get("/api/metrics/trends")
def get_trends():
    return fetch_zone_trends()

@app.get("/api/metrics/dwell")
def get_dwell():
    return fetch_dwell_times()

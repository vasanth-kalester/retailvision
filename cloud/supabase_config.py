"""
Supabase Cloud Configuration
Loaded from environment variables or .env file.
"""
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed — rely on real env vars

# Supabase project credentials
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")  # anon (public) key

# Store identifier for multi-store support
STORE_ID = os.getenv("STORE_ID", "store_104")

# Sync interval in seconds (default: 2 hours)
SYNC_INTERVAL_SECONDS = int(os.getenv("SYNC_INTERVAL_SECONDS", "7200"))

# Local data retention window in seconds (default: 24 hours)
LOCAL_RETENTION_SECONDS = int(os.getenv("LOCAL_RETENTION_SECONDS", "86400"))

def is_cloud_configured() -> bool:
    """Check if Supabase credentials are set."""
    return bool(SUPABASE_URL and SUPABASE_KEY)

-- RetailVision Cloud Schema (Supabase / Postgres)
-- Run this in the Supabase SQL Editor to create the required tables.

-- Hourly footfall rollup
CREATE TABLE IF NOT EXISTS hourly_footfall (
    id BIGSERIAL PRIMARY KEY,
    store_id TEXT DEFAULT 'store_104',
    hour_start TIMESTAMPTZ NOT NULL,
    entries INTEGER DEFAULT 0,
    exits INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, hour_start)
);

-- Hourly queue stats
CREATE TABLE IF NOT EXISTS hourly_queue_stats (
    id BIGSERIAL PRIMARY KEY,
    store_id TEXT DEFAULT 'store_104',
    hour_start TIMESTAMPTZ NOT NULL,
    avg_queue_depth REAL DEFAULT 0,
    peak_queue INTEGER DEFAULT 0,
    avg_wait_minutes REAL DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, hour_start)
);

-- Inventory snapshots (latest state per SKU)
CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id BIGSERIAL PRIMARY KEY,
    store_id TEXT DEFAULT 'store_104',
    sku TEXT NOT NULL,
    product_name TEXT,
    total_units INTEGER DEFAULT 0,
    safety_stock INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, sku)
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id BIGSERIAL PRIMARY KEY,
    store_id TEXT DEFAULT 'store_104',
    alert_type TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for mobile app queries
CREATE INDEX IF NOT EXISTS idx_footfall_store_hour ON hourly_footfall(store_id, hour_start DESC);
CREATE INDEX IF NOT EXISTS idx_queue_store_hour ON hourly_queue_stats(store_id, hour_start DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory_snapshots(store_id);
CREATE INDEX IF NOT EXISTS idx_alerts_store_created ON alert_history(store_id, created_at DESC);

-- Row Level Security (optional — enable if you want per-user access)
-- ALTER TABLE hourly_footfall ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hourly_queue_stats ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

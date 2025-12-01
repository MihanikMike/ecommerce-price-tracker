-- Migration: Add tracked_products table
-- Created: 2025-11-26
-- Description: Moves product URLs from hardcoded arrays to database for dynamic management

CREATE TABLE IF NOT EXISTS tracked_products (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    site TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    check_interval_minutes INTEGER DEFAULT 60,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    next_check_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for finding enabled products
CREATE INDEX IF NOT EXISTS idx_tracked_products_enabled 
ON tracked_products(enabled) WHERE enabled = true;

-- Index for scheduling: find products that need to be checked
CREATE INDEX IF NOT EXISTS idx_tracked_products_next_check 
ON tracked_products(next_check_at) WHERE enabled = true;

-- Index for finding products by site
CREATE INDEX IF NOT EXISTS idx_tracked_products_site 
ON tracked_products(site);

-- Composite index for efficient scheduling queries
CREATE INDEX IF NOT EXISTS idx_tracked_products_enabled_next_check 
ON tracked_products(enabled, next_check_at) WHERE enabled = true;

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_tracked_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trg_tracked_products_updated_at ON tracked_products;
CREATE TRIGGER trg_tracked_products_updated_at
    BEFORE UPDATE ON tracked_products
    FOR EACH ROW
    EXECUTE FUNCTION update_tracked_products_updated_at();

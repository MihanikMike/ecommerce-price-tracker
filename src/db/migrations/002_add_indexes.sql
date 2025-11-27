-- Migration: Add performance indexes and missing columns
-- Created: 2025-11-26
-- Description: Adds missing columns to products table and creates indexes for performance

-- Add missing columns to products table if they don't exist
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS site TEXT,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- For time-series queries on price history
CREATE INDEX IF NOT EXISTS idx_price_history_captured_at 
ON price_history(captured_at DESC);

-- For latest price lookup (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_price_history_product_captured 
ON price_history(product_id, captured_at DESC);

-- For filtering products by site
CREATE INDEX IF NOT EXISTS idx_products_site 
ON products(site);

-- For finding stale products that haven't been checked recently
CREATE INDEX IF NOT EXISTS idx_products_last_seen 
ON products(last_seen_at);

-- Composite index for active product queries
CREATE INDEX IF NOT EXISTS idx_products_site_last_seen 
ON products(site, last_seen_at) WHERE site IS NOT NULL;

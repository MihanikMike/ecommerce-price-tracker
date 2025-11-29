-- Migration: Add search-based product tracking
-- Created: 2025-11-28
-- Description: Adds support for dynamic product search instead of fixed URLs
-- The system can now search for products by name/keywords and match the best result

-- Add new columns to tracked_products
ALTER TABLE tracked_products 
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS search_keywords TEXT[],
ADD COLUMN IF NOT EXISTS tracking_mode TEXT DEFAULT 'url' CHECK (tracking_mode IN ('url', 'search')),
ADD COLUMN IF NOT EXISTS last_found_url TEXT,
ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS search_failures INTEGER DEFAULT 0;

-- Make url nullable for search-based tracking
ALTER TABLE tracked_products ALTER COLUMN url DROP NOT NULL;

-- Add constraint: either url OR product_name must be provided
ALTER TABLE tracked_products 
ADD CONSTRAINT chk_url_or_product_name 
CHECK (url IS NOT NULL OR product_name IS NOT NULL);

-- Index for search-based products
CREATE INDEX IF NOT EXISTS idx_tracked_products_tracking_mode 
ON tracked_products(tracking_mode) WHERE enabled = true;

-- Index for finding products by name (case-insensitive search)
CREATE INDEX IF NOT EXISTS idx_tracked_products_product_name 
ON tracked_products(LOWER(product_name));

-- Full-text search index on product_name and search_keywords
CREATE INDEX IF NOT EXISTS idx_tracked_products_search_keywords_gin 
ON tracked_products USING GIN(search_keywords);

-- Comments for documentation
COMMENT ON COLUMN tracked_products.product_name IS 'Human-readable product name used for search';
COMMENT ON COLUMN tracked_products.search_keywords IS 'Additional keywords to improve search accuracy';
COMMENT ON COLUMN tracked_products.tracking_mode IS 'url = use fixed URL, search = dynamically search for product';
COMMENT ON COLUMN tracked_products.last_found_url IS 'Most recent URL found via search (cached)';
COMMENT ON COLUMN tracked_products.match_confidence IS 'Confidence score (0-100) of the last product match';
COMMENT ON COLUMN tracked_products.search_failures IS 'Count of consecutive search failures';

-- Update existing records to have tracking_mode = 'url'
UPDATE tracked_products SET tracking_mode = 'url' WHERE tracking_mode IS NULL;

-- Remove the unique constraint on url since it's now nullable
-- First drop the old unique constraint
ALTER TABLE tracked_products DROP CONSTRAINT IF EXISTS tracked_products_url_key;

-- Add a partial unique index on url (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_products_url_unique 
ON tracked_products(url) WHERE url IS NOT NULL;

-- Add unique constraint on product_name + site combination for search-based products
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_products_name_site_unique 
ON tracked_products(product_name, site) WHERE tracking_mode = 'search' AND product_name IS NOT NULL;

-- ============================================================
-- New table: search_results - Store search results for comparison
-- ============================================================

CREATE TABLE IF NOT EXISTS search_results (
    id SERIAL PRIMARY KEY,
    tracked_product_id INTEGER REFERENCES tracked_products(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    result_url TEXT NOT NULL,
    result_title TEXT,
    site_name TEXT,
    price DECIMAL(12, 2),
    currency TEXT DEFAULT 'USD',
    availability TEXT,
    match_score DECIMAL(5, 2),
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_best_match BOOLEAN DEFAULT false,
    raw_data JSONB,
    
    CONSTRAINT unique_search_result UNIQUE (tracked_product_id, result_url)
);

-- Indexes for search_results
CREATE INDEX IF NOT EXISTS idx_search_results_tracked_product 
ON search_results(tracked_product_id);

CREATE INDEX IF NOT EXISTS idx_search_results_site 
ON search_results(site_name);

CREATE INDEX IF NOT EXISTS idx_search_results_price 
ON search_results(price) WHERE price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_search_results_best_match 
ON search_results(tracked_product_id, is_best_match) WHERE is_best_match = true;

COMMENT ON TABLE search_results IS 'Stores scraped results from product searches for price comparison';

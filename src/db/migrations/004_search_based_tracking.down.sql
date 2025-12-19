-- Rollback for 004_search_based_tracking.sql
-- WARNING: This will remove search-based tracking support!

-- Drop search_results table
DROP TABLE IF EXISTS search_results;

-- Drop unique indexes
DROP INDEX IF EXISTS idx_tracked_products_name_site_unique;
DROP INDEX IF EXISTS idx_tracked_products_url_unique;

-- Drop search-related indexes
DROP INDEX IF EXISTS idx_tracked_products_search_keywords_gin;
DROP INDEX IF EXISTS idx_tracked_products_product_name;
DROP INDEX IF EXISTS idx_tracked_products_tracking_mode;

-- Drop constraint
ALTER TABLE tracked_products DROP CONSTRAINT IF EXISTS chk_url_or_product_name;

-- Make url NOT NULL again (this may fail if search-based products exist)
-- First, update any NULL urls with a placeholder
UPDATE tracked_products SET url = 'placeholder://' || id WHERE url IS NULL;

-- Re-add NOT NULL constraint
ALTER TABLE tracked_products ALTER COLUMN url SET NOT NULL;

-- Re-add original unique constraint
ALTER TABLE tracked_products ADD CONSTRAINT tracked_products_url_key UNIQUE (url);

-- Drop columns
ALTER TABLE tracked_products 
DROP COLUMN IF EXISTS search_failures,
DROP COLUMN IF EXISTS match_confidence,
DROP COLUMN IF EXISTS last_found_url,
DROP COLUMN IF EXISTS tracking_mode,
DROP COLUMN IF EXISTS search_keywords,
DROP COLUMN IF EXISTS product_name;

-- Rollback for 003_tracked_products.sql
-- WARNING: This will delete ALL tracked product data!

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trg_tracked_products_updated_at ON tracked_products;
DROP FUNCTION IF EXISTS update_tracked_products_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_tracked_products_enabled_next_check;
DROP INDEX IF EXISTS idx_tracked_products_site;
DROP INDEX IF EXISTS idx_tracked_products_next_check;
DROP INDEX IF EXISTS idx_tracked_products_enabled;

-- Drop table
DROP TABLE IF EXISTS tracked_products;

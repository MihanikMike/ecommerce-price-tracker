-- Rollback for 001_init.sql
-- WARNING: This will delete ALL product data!

DROP INDEX IF EXISTS idx_price_history_product_id;
DROP INDEX IF EXISTS idx_products_url;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS products;

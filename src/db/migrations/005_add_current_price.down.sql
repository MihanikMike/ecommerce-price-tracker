-- Rollback for 005_add_current_price.sql
-- Removes the price column from products table

DROP INDEX IF EXISTS idx_products_price;
ALTER TABLE products DROP COLUMN IF EXISTS price;

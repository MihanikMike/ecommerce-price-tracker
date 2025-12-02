-- Add current_price column to products table for quick access
-- This stores the latest scraped price directly on the product
ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

-- Update existing products with their latest price
UPDATE products p
SET price = (
    SELECT ph.price
    FROM price_history ph
    WHERE ph.product_id = p.id
    ORDER BY ph.captured_at DESC
    LIMIT 1
)
WHERE p.price IS NULL;

-- Add index for price queries
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

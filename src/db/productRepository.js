import { pool } from "./connect-pg.js";
import logger from "../utils/logger.js";
import { validateScrapedData, logValidationErrors } from "../utils/validation.js";

/**
 * Insert or update product and add price history entry
 */
export async function upsertProductAndHistory({ url, site, title, price, currency = 'USD' }) {
    // Validate input data
    const validation = validateScrapedData({ url, site, title, price, currency });
    if (!validation.valid) {
        logValidationErrors('upsertProductAndHistory', validation.errors);
        throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }
    
    // Use sanitized data
    const data = validation.sanitized;
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Insert or update product (including current price)
        const productResult = await client.query(
            `INSERT INTO products (url, site, title, price, last_seen_at) 
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (url) 
             DO UPDATE SET 
                title = EXCLUDED.title,
                site = EXCLUDED.site,
                price = EXCLUDED.price,
                last_seen_at = NOW()
             RETURNING id`,
            [data.url, data.site, data.title, data.price]
        );
        
        const productId = productResult.rows[0].id;
        
        // Check if we already have a price entry within the last 5 minutes with the same price
        // This prevents duplicate entries from retries or rapid successive calls
        const recentPriceCheck = await client.query(
            `SELECT id FROM price_history 
             WHERE product_id = $1 
               AND price = $2 
               AND captured_at > NOW() - INTERVAL '5 minutes'
             LIMIT 1`,
            [productId, data.price]
        );
        
        // Only insert price history if no recent duplicate exists
        if (recentPriceCheck.rows.length === 0) {
            await client.query(
                `INSERT INTO price_history (product_id, price, currency, captured_at) 
                 VALUES ($1, $2, $3, NOW())`,
                [productId, data.price, data.currency]
            );
            logger.debug({ productId, url: data.url, price: data.price }, 'Price history entry added');
        } else {
            logger.debug({ productId, url: data.url, price: data.price }, 'Skipped duplicate price entry (same price within 5 min)');
        }
        
        await client.query('COMMIT');
        
        logger.debug({ productId, url: data.url, price: data.price }, 'Product and price history saved');
        
        return productId;
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error, url: data?.url || url }, 'Failed to save product');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get all products with latest price
 */
export async function getAllProductsWithLatestPrice() {
    const result = await pool.query(`
        SELECT 
            p.*,
            ph.price as latest_price,
            ph.currency,
            ph.captured_at as price_captured_at
        FROM products p
        LEFT JOIN LATERAL (
            SELECT price, currency, captured_at
            FROM price_history
            WHERE product_id = p.id
            ORDER BY captured_at DESC
            LIMIT 1
        ) ph ON true
        ORDER BY p.last_seen_at DESC
    `);
    return result.rows;
}

/**
 * Get price history for a product
 */
export async function getPriceHistory(productId, limit = 100) {
    // Validate product ID
    const { validateProductId } = await import('../utils/validation.js');
    const validation = validateProductId(productId);
    if (!validation.valid) {
        throw new Error(`Invalid product ID: ${validation.errors.join('; ')}`);
    }
    
    // Validate limit
    const sanitizedLimit = Math.max(1, Math.min(1000, parseInt(limit, 10) || 100));
    
    const result = await pool.query(
        `SELECT * FROM price_history 
         WHERE product_id = $1 
         ORDER BY captured_at DESC 
         LIMIT $2`,
        [validation.sanitized, sanitizedLimit]
    );
    return result.rows;
}
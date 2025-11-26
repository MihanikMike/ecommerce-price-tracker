import { pool } from "./connect-pg.js";
import logger from "../utils/logger.js";

/**
 * Insert or update product and add price history entry
 */
export async function upsertProductAndHistory({ url, site, title, price, currency = 'USD' }) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Insert or update product
        const productResult = await client.query(
            `INSERT INTO products (url, site, title, last_seen_at) 
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (url) 
             DO UPDATE SET 
                title = EXCLUDED.title,
                site = EXCLUDED.site,
                last_seen_at = NOW()
             RETURNING id`,
            [url, site, title]
        );
        
        const productId = productResult.rows[0].id;
        
        // Insert price history
        await client.query(
            `INSERT INTO price_history (product_id, price, currency, captured_at) 
             VALUES ($1, $2, $3, NOW())`,
            [productId, price, currency]
        );
        
        await client.query('COMMIT');
        
        logger.debug({ productId, url, price }, 'Product and price history saved');
        
        return productId;
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error, url }, 'Failed to save product');
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
    const result = await pool.query(
        `SELECT * FROM price_history 
         WHERE product_id = $1 
         ORDER BY captured_at DESC 
         LIMIT $2`,
        [productId, limit]
    );
    return result.rows;
}
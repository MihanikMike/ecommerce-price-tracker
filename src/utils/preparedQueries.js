/**
 * Prepared Statements Registry
 * 
 * Pre-defines SQL queries for frequently executed operations.
 * Using named prepared statements improves performance by:
 * - Reducing query parsing overhead
 * - Enabling query plan caching
 * - Reducing SQL injection risk
 * 
 * @module utils/preparedQueries
 */

/**
 * Prepared query definitions
 * Each query has a unique name and SQL text
 */
export const preparedQueries = {
    // Product queries
    upsertProduct: {
        name: 'upsert_product',
        text: `
            INSERT INTO products (url, site, title, price, last_seen_at) 
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (url) 
            DO UPDATE SET 
                title = EXCLUDED.title,
                site = EXCLUDED.site,
                price = EXCLUDED.price,
                last_seen_at = NOW()
            RETURNING id
        `
    },
    
    checkRecentPrice: {
        name: 'check_recent_price',
        text: `
            SELECT id FROM price_history 
            WHERE product_id = $1 
              AND price = $2 
              AND captured_at > NOW() - INTERVAL '5 minutes'
            LIMIT 1
        `
    },
    
    insertPriceHistory: {
        name: 'insert_price_history',
        text: `
            INSERT INTO price_history (product_id, price, currency, captured_at) 
            VALUES ($1, $2, $3, NOW())
        `
    },
    
    getAllProductsWithPrice: {
        name: 'get_all_products_with_price',
        text: `
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
        `
    },
    
    getPriceHistory: {
        name: 'get_price_history',
        text: `
            SELECT * FROM price_history 
            WHERE product_id = $1 
            ORDER BY captured_at DESC 
            LIMIT $2
        `
    },
    
    // Tracked products queries
    getProductsDueForCheck: {
        name: 'get_products_due_for_check',
        text: `
            SELECT * FROM tracked_products
            WHERE enabled = true
              AND (next_check_at IS NULL OR next_check_at <= NOW())
            ORDER BY next_check_at NULLS FIRST
            LIMIT $1
        `
    },
    
    lockProductForUpdate: {
        name: 'lock_product_for_update',
        text: `
            SELECT check_interval_minutes FROM tracked_products 
            WHERE id = $1 
            FOR UPDATE
        `
    },
    
    updateProductCheckTime: {
        name: 'update_product_check_time',
        text: `
            UPDATE tracked_products 
            SET last_checked_at = NOW(),
                next_check_at = $1
            WHERE id = $2
        `
    },
    
    getEnabledTrackedProducts: {
        name: 'get_enabled_tracked_products',
        text: `
            SELECT * FROM tracked_products 
            WHERE enabled = true 
            ORDER BY id
        `
    },
    
    getTrackedProductById: {
        name: 'get_tracked_product_by_id',
        text: `
            SELECT * FROM tracked_products WHERE id = $1
        `
    },
    
    // Health check
    healthCheck: {
        name: 'health_check',
        text: 'SELECT NOW()'
    }
};

/**
 * Execute a prepared query
 * @param {import('pg').Pool|import('pg').PoolClient} clientOrPool - Database client or pool
 * @param {Object} queryDef - Query definition from preparedQueries
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function executePrepared(clientOrPool, queryDef, params = []) {
    return clientOrPool.query({
        name: queryDef.name,
        text: queryDef.text,
        values: params
    });
}

export default preparedQueries;

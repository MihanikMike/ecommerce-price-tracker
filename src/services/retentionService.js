/**
 * Data Retention Service
 * Manages automatic cleanup of old data to prevent database bloat
 */

import { pool } from "../db/connect-pg.js";
import logger from "../utils/logger.js";
import config from "../config/index.js";

// Default retention settings (can be overridden in config)
const DEFAULT_RETENTION = {
    // Keep price history for this many days
    priceHistoryDays: 90,
    // Keep at least this many price records per product (even if older than retention)
    minPriceRecordsPerProduct: 10,
    // Remove products not seen for this many days
    staleProductDays: 180,
    // Remove search results older than this many days
    searchResultDays: 30,
    // Batch size for delete operations (to avoid long locks)
    deleteBatchSize: 1000,
    // Keep daily price samples for historical analysis (after detailed data is purged)
    keepDailySamples: true,
};

/**
 * Get retention settings from config or use defaults
 */
function getRetentionSettings() {
    return {
        ...DEFAULT_RETENTION,
        ...(config.retention || {}),
    };
}

/**
 * Create daily price samples table if it doesn't exist
 * This stores one price per day per product for long-term historical analysis
 */
export async function ensureDailySamplesTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS price_history_daily (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
            price NUMERIC(10,2),
            min_price NUMERIC(10,2),
            max_price NUMERIC(10,2),
            currency TEXT,
            sample_date DATE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(product_id, sample_date)
        );
        
        CREATE INDEX IF NOT EXISTS idx_price_history_daily_product 
        ON price_history_daily(product_id, sample_date DESC);
        
        CREATE INDEX IF NOT EXISTS idx_price_history_daily_date 
        ON price_history_daily(sample_date DESC);
    `);
    
    logger.debug('Daily samples table ensured');
}

/**
 * Archive detailed price history to daily samples before deletion
 * @param {number} olderThanDays - Archive records older than this
 */
export async function archiveToDailySamples(olderThanDays) {
    const settings = getRetentionSettings();
    
    if (!settings.keepDailySamples) {
        return { archived: 0 };
    }
    
    await ensureDailySamplesTable();
    
    // Insert daily aggregates for data that's about to be purged
    const result = await pool.query(`
        INSERT INTO price_history_daily (product_id, price, min_price, max_price, currency, sample_date)
        SELECT 
            product_id,
            -- Use the last price of the day as the representative price
            (ARRAY_AGG(price ORDER BY captured_at DESC))[1] as price,
            MIN(price) as min_price,
            MAX(price) as max_price,
            -- Use the most common currency
            MODE() WITHIN GROUP (ORDER BY currency) as currency,
            DATE(captured_at) as sample_date
        FROM price_history
        WHERE captured_at < NOW() - INTERVAL '${olderThanDays} days'
        GROUP BY product_id, DATE(captured_at)
        ON CONFLICT (product_id, sample_date) DO NOTHING
    `);
    
    logger.info({ archived: result.rowCount, olderThanDays }, 'Archived price history to daily samples');
    
    return { archived: result.rowCount };
}

/**
 * Delete old price history records
 * Keeps at least minPriceRecordsPerProduct per product
 */
export async function cleanupPriceHistory() {
    const settings = getRetentionSettings();
    const { priceHistoryDays, minPriceRecordsPerProduct, deleteBatchSize } = settings;
    
    // First archive to daily samples
    await archiveToDailySamples(priceHistoryDays);
    
    let totalDeleted = 0;
    let batchDeleted = 0;
    
    do {
        // Delete old records, but keep at least N records per product
        const result = await pool.query(`
            WITH ranked_history AS (
                SELECT 
                    id,
                    product_id,
                    captured_at,
                    ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY captured_at DESC) as rn
                FROM price_history
            ),
            deletable AS (
                SELECT id
                FROM ranked_history
                WHERE captured_at < NOW() - INTERVAL '${priceHistoryDays} days'
                  AND rn > $1
                LIMIT $2
            )
            DELETE FROM price_history
            WHERE id IN (SELECT id FROM deletable)
        `, [minPriceRecordsPerProduct, deleteBatchSize]);
        
        batchDeleted = result.rowCount;
        totalDeleted += batchDeleted;
        
        if (batchDeleted > 0) {
            logger.debug({ batchDeleted, totalDeleted }, 'Price history cleanup batch');
        }
        
    } while (batchDeleted === deleteBatchSize); // Continue if we hit the limit
    
    if (totalDeleted > 0) {
        logger.info({ 
            totalDeleted, 
            retentionDays: priceHistoryDays,
            minRecordsKept: minPriceRecordsPerProduct 
        }, 'Price history cleanup completed');
    }
    
    return { deleted: totalDeleted };
}

/**
 * Delete stale products that haven't been seen recently
 * (Products will cascade delete their price history)
 */
export async function cleanupStaleProducts() {
    const settings = getRetentionSettings();
    const { staleProductDays } = settings;
    
    // First, check what will be deleted
    const countResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM products
        WHERE last_seen_at < NOW() - INTERVAL '${staleProductDays} days'
    `);
    
    const toDelete = parseInt(countResult.rows[0].count);
    
    if (toDelete === 0) {
        return { deleted: 0 };
    }
    
    // Log the products being deleted
    const productsToDelete = await pool.query(`
        SELECT id, url, site, title, last_seen_at
        FROM products
        WHERE last_seen_at < NOW() - INTERVAL '${staleProductDays} days'
        LIMIT 100
    `);
    
    for (const product of productsToDelete.rows) {
        logger.warn({
            productId: product.id,
            url: product.url,
            site: product.site,
            lastSeen: product.last_seen_at,
        }, 'Deleting stale product');
    }
    
    // Delete stale products (price_history will cascade delete)
    const result = await pool.query(`
        DELETE FROM products
        WHERE last_seen_at < NOW() - INTERVAL '${staleProductDays} days'
    `);
    
    logger.info({ 
        deleted: result.rowCount,
        staleProductDays 
    }, 'Stale products cleanup completed');
    
    return { deleted: result.rowCount };
}

/**
 * Delete old search results
 */
export async function cleanupSearchResults() {
    const settings = getRetentionSettings();
    const { searchResultDays, deleteBatchSize } = settings;
    
    // Check if search_results table exists
    const tableExists = await pool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'search_results'
        )
    `);
    
    if (!tableExists.rows[0].exists) {
        return { deleted: 0, reason: 'table_not_exists' };
    }
    
    let totalDeleted = 0;
    let batchDeleted = 0;
    
    do {
        const result = await pool.query(`
            DELETE FROM search_results
            WHERE id IN (
                SELECT id FROM search_results
                WHERE scraped_at < NOW() - INTERVAL '${searchResultDays} days'
                LIMIT $1
            )
        `, [deleteBatchSize]);
        
        batchDeleted = result.rowCount;
        totalDeleted += batchDeleted;
        
    } while (batchDeleted === deleteBatchSize);
    
    if (totalDeleted > 0) {
        logger.info({ 
            deleted: totalDeleted,
            retentionDays: searchResultDays 
        }, 'Search results cleanup completed');
    }
    
    return { deleted: totalDeleted };
}

/**
 * Get database size statistics
 */
export async function getDatabaseStats() {
    const result = await pool.query(`
        SELECT 
            (SELECT COUNT(*) FROM products) as product_count,
            (SELECT COUNT(*) FROM price_history) as price_history_count,
            (SELECT COUNT(*) FROM tracked_products) as tracked_products_count,
            (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size,
            (SELECT pg_size_pretty(pg_total_relation_size('price_history'))) as price_history_size,
            (SELECT pg_size_pretty(pg_total_relation_size('products'))) as products_size,
            (SELECT MIN(captured_at) FROM price_history) as oldest_price,
            (SELECT MAX(captured_at) FROM price_history) as newest_price
    `);
    
    // Check if daily samples table exists
    const dailyExists = await pool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'price_history_daily'
        )
    `);
    
    let dailySamplesCount = 0;
    if (dailyExists.rows[0].exists) {
        const dailyResult = await pool.query(`SELECT COUNT(*) as count FROM price_history_daily`);
        dailySamplesCount = parseInt(dailyResult.rows[0].count);
    }
    
    return {
        ...result.rows[0],
        daily_samples_count: dailySamplesCount,
    };
}

/**
 * Run all cleanup operations
 */
export async function runRetentionCleanup() {
    const startTime = Date.now();
    logger.info('Starting data retention cleanup');
    
    const results = {
        priceHistory: await cleanupPriceHistory(),
        staleProducts: await cleanupStaleProducts(),
        searchResults: await cleanupSearchResults(),
    };
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.info({
        duration: `${duration}s`,
        priceHistoryDeleted: results.priceHistory.deleted,
        staleProductsDeleted: results.staleProducts.deleted,
        searchResultsDeleted: results.searchResults.deleted,
    }, 'Data retention cleanup completed');
    
    // Optionally run VACUUM ANALYZE after cleanup
    try {
        await pool.query('VACUUM ANALYZE price_history');
        await pool.query('VACUUM ANALYZE products');
        logger.debug('Vacuum analyze completed');
    } catch (error) {
        // VACUUM can fail in some contexts, that's ok
        logger.debug({ error: error.message }, 'Vacuum analyze skipped');
    }
    
    return results;
}

/**
 * Get retention policy summary
 */
export function getRetentionPolicy() {
    return getRetentionSettings();
}

export default {
    cleanupPriceHistory,
    cleanupStaleProducts,
    cleanupSearchResults,
    runRetentionCleanup,
    getDatabaseStats,
    getRetentionPolicy,
    archiveToDailySamples,
    ensureDailySamplesTable,
};

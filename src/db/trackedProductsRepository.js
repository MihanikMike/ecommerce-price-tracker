import { pool } from './connect-pg.js';
import logger from '../utils/logger.js';
import { validateTrackedProduct, validateProductId, logValidationErrors } from '../utils/validation.js';

/**
 * Get all enabled products that need to be checked
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of products to check
 */
export async function getProductsToCheck(limit = 100) {
    try {
        const result = await pool.query(`
            SELECT id, url, site, check_interval_minutes, last_checked_at
            FROM tracked_products 
            WHERE enabled = true 
            AND url IS NOT NULL
            AND tracking_mode = 'url'
            AND (next_check_at IS NULL OR next_check_at <= NOW())
            ORDER BY last_checked_at ASC NULLS FIRST
            LIMIT $1
        `, [limit]);
        
        return result.rows;
    } catch (error) {
        logger.error({ error }, 'Failed to get products to check');
        throw error;
    }
}

/**
 * Update product check timestamp and schedule next check
 * @param {number} productId - Product ID
 * @param {boolean} success - Whether the check was successful
 */
export async function updateProductCheckTime(productId, success = true) {
    // Validate product ID
    const validation = validateProductId(productId);
    if (!validation.valid) {
        throw new Error(`Invalid product ID: ${validation.errors.join('; ')}`);
    }
    
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get the check interval
            const product = await client.query(
                'SELECT check_interval_minutes FROM tracked_products WHERE id = $1',
                [validation.sanitized]
            );

            if (product.rows.length === 0) {
                throw new Error(`Product ${productId} not found`);
            }

            const intervalMinutes = product.rows[0].check_interval_minutes;
            const nextCheck = new Date(Date.now() + intervalMinutes * 60 * 1000);

            await client.query(`
                UPDATE tracked_products 
                SET last_checked_at = NOW(),
                    next_check_at = $1
                WHERE id = $2
            `, [nextCheck, validation.sanitized]);

            await client.query('COMMIT');
            
            logger.debug({ productId, nextCheck, success }, 'Updated product check time');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error({ error, productId }, 'Failed to update product check time');
        throw error;
    }
}

/**
 * Add a new product to track
 * @param {Object} productData - Product information
 * @returns {Promise<number>} The ID of the created product
 */
export async function addTrackedProduct({ url, site, enabled = true, checkIntervalMinutes = 60 }) {
    // Validate input
    const validation = validateTrackedProduct({ url, site, enabled, checkIntervalMinutes });
    if (!validation.valid) {
        logValidationErrors('addTrackedProduct', validation.errors);
        throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
    }
    
    const data = validation.sanitized;
    
    try {
        const result = await pool.query(
            `INSERT INTO tracked_products (url, site, enabled, check_interval_minutes, tracking_mode)
             VALUES ($1, $2, $3, $4, 'url')
             ON CONFLICT (url) WHERE url IS NOT NULL DO UPDATE 
             SET enabled = EXCLUDED.enabled, check_interval_minutes = EXCLUDED.check_interval_minutes, updated_at = NOW()
             RETURNING id`,
            [data.url, data.site, data.enabled, data.checkIntervalMinutes]
        );
        
        logger.info({ id: result.rows[0].id, url: data.url, site: data.site }, 'Added tracked product');
        return result.rows[0].id;
    } catch (error) {
        logger.error({ error, url: data?.url || url }, 'Failed to add tracked product');
        throw error;
    }
}

/**
 * Enable or disable a tracked product
 * @param {number} productId - Product ID
 * @param {boolean} enabled - Enable or disable
 */
export async function setProductEnabled(productId, enabled) {
    // Validate product ID
    const idValidation = validateProductId(productId);
    if (!idValidation.valid) {
        throw new Error(`Invalid product ID: ${idValidation.errors.join('; ')}`);
    }
    
    // Validate enabled flag
    if (typeof enabled !== 'boolean') {
        throw new Error('Enabled must be a boolean value');
    }
    
    try {
        const result = await pool.query(
            'UPDATE tracked_products SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
            [enabled, idValidation.sanitized]
        );
        
        if (result.rows.length === 0) {
            throw new Error(`Product ${productId} not found`);
        }
        
        logger.info({ productId, enabled }, 'Updated product enabled status');
    } catch (error) {
        logger.error({ error, productId }, 'Failed to update product enabled status');
        throw error;
    }
}

/**
 * Get all tracked products
 * @returns {Promise<Array>} All tracked products
 */
export async function getAllTrackedProducts() {
    try {
        const result = await pool.query(`
            SELECT * FROM tracked_products 
            ORDER BY created_at DESC
        `);
        
        return result.rows;
    } catch (error) {
        logger.error({ error }, 'Failed to get all tracked products');
        throw error;
    }
}

/**
 * Delete a tracked product
 * @param {number} productId - Product ID
 */
export async function deleteTrackedProduct(productId) {
    // Validate product ID
    const validation = validateProductId(productId);
    if (!validation.valid) {
        throw new Error(`Invalid product ID: ${validation.errors.join('; ')}`);
    }
    
    try {
        const result = await pool.query('DELETE FROM tracked_products WHERE id = $1 RETURNING id', [validation.sanitized]);
        
        if (result.rows.length === 0) {
            throw new Error(`Product ${productId} not found`);
        }
        
        logger.info({ productId: validation.sanitized }, 'Deleted tracked product');
    } catch (error) {
        logger.error({ error, productId }, 'Failed to delete tracked product');
        throw error;
    }
}

// ============================================================
// SEARCH-BASED TRACKING FUNCTIONS
// ============================================================

/**
 * Add a search-based tracked product (no URL required)
 * @param {Object} productData - Product information
 * @returns {Promise<number>} The ID of the created product
 */
export async function addSearchBasedProduct({ 
    productName, 
    site = 'any',
    keywords = [],
    enabled = true, 
    checkIntervalMinutes = 60 
}) {
    if (!productName || typeof productName !== 'string') {
        throw new Error('Product name is required for search-based tracking');
    }
    
    try {
        const result = await pool.query(
            `INSERT INTO tracked_products 
             (product_name, site, search_keywords, tracking_mode, enabled, check_interval_minutes)
             VALUES ($1, $2, $3, 'search', $4, $5)
             ON CONFLICT (product_name, site) WHERE tracking_mode = 'search' AND product_name IS NOT NULL
             DO UPDATE SET 
                search_keywords = $3,
                enabled = $4, 
                check_interval_minutes = $5, 
                updated_at = NOW()
             RETURNING id`,
            [productName.trim(), site, keywords, enabled, checkIntervalMinutes]
        );
        
        logger.info({ 
            id: result.rows[0].id, 
            productName, 
            site,
            keywords 
        }, 'Added search-based tracked product');
        
        return result.rows[0].id;
    } catch (error) {
        logger.error({ error, productName }, 'Failed to add search-based product');
        throw error;
    }
}

/**
 * Get all search-based products that need to be checked
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of search-based products to check
 */
export async function getSearchProductsToCheck(limit = 50) {
    try {
        const result = await pool.query(`
            SELECT id, product_name, site, search_keywords, 
                   last_found_url, match_confidence, search_failures,
                   check_interval_minutes, last_checked_at
            FROM tracked_products 
            WHERE enabled = true 
            AND tracking_mode = 'search'
            AND (next_check_at IS NULL OR next_check_at <= NOW())
            ORDER BY last_checked_at ASC NULLS FIRST
            LIMIT $1
        `, [limit]);
        
        return result.rows;
    } catch (error) {
        logger.error({ error }, 'Failed to get search products to check');
        throw error;
    }
}

/**
 * Update search result for a tracked product
 * @param {number} productId - Product ID
 * @param {Object} searchResult - Search result data
 */
export async function updateSearchResult(productId, { 
    lastFoundUrl, 
    matchConfidence, 
    success = true 
}) {
    try {
        const product = await pool.query(
            'SELECT check_interval_minutes, search_failures FROM tracked_products WHERE id = $1',
            [productId]
        );

        if (product.rows.length === 0) {
            throw new Error(`Product ${productId} not found`);
        }

        const intervalMinutes = product.rows[0].check_interval_minutes;
        const currentFailures = product.rows[0].search_failures || 0;
        const nextCheck = new Date(Date.now() + intervalMinutes * 60 * 1000);
        
        // Reset failures on success, increment on failure
        const newFailures = success ? 0 : currentFailures + 1;

        await pool.query(`
            UPDATE tracked_products 
            SET last_checked_at = NOW(),
                next_check_at = $1,
                last_found_url = COALESCE($2, last_found_url),
                match_confidence = COALESCE($3, match_confidence),
                search_failures = $4
            WHERE id = $5
        `, [nextCheck, lastFoundUrl, matchConfidence, newFailures, productId]);
        
        logger.debug({ productId, lastFoundUrl, matchConfidence, success }, 'Updated search result');
    } catch (error) {
        logger.error({ error, productId }, 'Failed to update search result');
        throw error;
    }
}

/**
 * Save search results for price comparison
 * @param {number} trackedProductId - Tracked product ID
 * @param {string} searchQuery - The search query used
 * @param {Array} products - Array of scraped product data
 */
export async function saveSearchResults(trackedProductId, searchQuery, products) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Clear old results for this product
        await client.query(
            'DELETE FROM search_results WHERE tracked_product_id = $1',
            [trackedProductId]
        );
        
        // Insert new results
        for (const product of products) {
            const isBestMatch = product.matchScore && product.matchScore >= 60;
            
            await client.query(`
                INSERT INTO search_results 
                (tracked_product_id, search_query, result_url, result_title, 
                 site_name, price, currency, availability, match_score, 
                 is_best_match, raw_data)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (tracked_product_id, result_url) 
                DO UPDATE SET
                    result_title = $4,
                    price = $6,
                    currency = $7,
                    availability = $8,
                    match_score = $9,
                    is_best_match = $10,
                    scraped_at = NOW(),
                    raw_data = $11
            `, [
                trackedProductId,
                searchQuery,
                product.url,
                product.title,
                product.site,
                product.price,
                product.currency || 'USD',
                product.availability,
                product.matchScore,
                isBestMatch,
                JSON.stringify(product)
            ]);
        }
        
        await client.query('COMMIT');
        
        logger.info({ 
            trackedProductId, 
            resultsCount: products.length 
        }, 'Saved search results');
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error, trackedProductId }, 'Failed to save search results');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get search results for a tracked product
 * @param {number} trackedProductId - Tracked product ID
 * @returns {Promise<Array>} Search results sorted by match score
 */
export async function getSearchResults(trackedProductId) {
    try {
        const result = await pool.query(`
            SELECT * FROM search_results 
            WHERE tracked_product_id = $1
            ORDER BY match_score DESC NULLS LAST, price ASC
        `, [trackedProductId]);
        
        return result.rows;
    } catch (error) {
        logger.error({ error, trackedProductId }, 'Failed to get search results');
        throw error;
    }
}

/**
 * Get best match for a tracked product
 * @param {number} trackedProductId - Tracked product ID
 * @returns {Promise<Object|null>} Best matching result or null
 */
export async function getBestMatch(trackedProductId) {
    try {
        const result = await pool.query(`
            SELECT * FROM search_results 
            WHERE tracked_product_id = $1 AND is_best_match = true
            ORDER BY match_score DESC
            LIMIT 1
        `, [trackedProductId]);
        
        return result.rows[0] || null;
    } catch (error) {
        logger.error({ error, trackedProductId }, 'Failed to get best match');
        throw error;
    }
}

/**
 * Get price comparison for a tracked product
 * @param {number} trackedProductId - Tracked product ID
 * @returns {Promise<Object>} Price comparison data
 */
export async function getPriceComparison(trackedProductId) {
    try {
        const result = await pool.query(`
            SELECT 
                MIN(price) as lowest_price,
                MAX(price) as highest_price,
                AVG(price) as average_price,
                COUNT(*) as total_results,
                COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as priced_results
            FROM search_results 
            WHERE tracked_product_id = $1 AND price IS NOT NULL
        `, [trackedProductId]);
        
        const stats = result.rows[0];
        
        // Get the source with lowest price
        const lowestPriceResult = await pool.query(`
            SELECT site_name, price, result_url, result_title
            FROM search_results 
            WHERE tracked_product_id = $1 AND price IS NOT NULL
            ORDER BY price ASC
            LIMIT 1
        `, [trackedProductId]);
        
        return {
            lowestPrice: parseFloat(stats.lowest_price),
            highestPrice: parseFloat(stats.highest_price),
            averagePrice: parseFloat(stats.average_price),
            priceRange: parseFloat(stats.highest_price) - parseFloat(stats.lowest_price),
            totalResults: parseInt(stats.total_results),
            bestDeal: lowestPriceResult.rows[0] || null,
        };
    } catch (error) {
        logger.error({ error, trackedProductId }, 'Failed to get price comparison');
        throw error;
    }
}

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
            `INSERT INTO tracked_products (url, site, enabled, check_interval_minutes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (url) DO UPDATE 
             SET enabled = $3, check_interval_minutes = $4, updated_at = NOW()
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

/**
 * Price Change Detection Service
 * Detects significant price changes and can trigger alerts
 */

import { pool } from "../db/connect-pg.js";
import logger from "../utils/logger.js";
import { recordPriceChange } from "../utils/metrics.js";
import config from "../config/index.js";

// Default thresholds (can be overridden in config)
const DEFAULT_THRESHOLDS = {
    // Minimum absolute price change to consider significant (in currency units)
    minAbsoluteChange: 1.00,
    // Minimum percentage change to consider significant
    minPercentChange: 5,
    // Price drop threshold for alerts (percentage)
    alertDropThreshold: 10,
    // Price increase threshold for alerts (percentage)
    alertIncreaseThreshold: 20,
};

/**
 * Get thresholds from config or use defaults
 */
function getThresholds() {
    return {
        ...DEFAULT_THRESHOLDS,
        ...(config.priceChange || {}),
    };
}

/**
 * Calculate price change statistics
 * @param {number} oldPrice - Previous price
 * @param {number} newPrice - Current price
 * @returns {Object} Change statistics
 */
export function calculatePriceChange(oldPrice, newPrice) {
    if (oldPrice === null || oldPrice === undefined || oldPrice === 0) {
        return {
            absoluteChange: 0,
            percentChange: 0,
            direction: 'none',
            isSignificant: false,
            isNewPrice: true,
        };
    }

    const absoluteChange = newPrice - oldPrice;
    const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
    const direction = absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'none';

    const thresholds = getThresholds();
    const isSignificant = 
        Math.abs(absoluteChange) >= thresholds.minAbsoluteChange &&
        Math.abs(percentChange) >= thresholds.minPercentChange;

    return {
        absoluteChange: Math.round(absoluteChange * 100) / 100,
        percentChange: Math.round(percentChange * 100) / 100,
        direction,
        isSignificant,
        isNewPrice: false,
    };
}

/**
 * Check if price change should trigger an alert
 * @param {Object} change - Change statistics from calculatePriceChange
 * @returns {Object} Alert info
 */
export function shouldAlert(change) {
    const thresholds = getThresholds();

    if (!change.isSignificant) {
        return { shouldAlert: false, reason: null };
    }

    if (change.direction === 'down' && Math.abs(change.percentChange) >= thresholds.alertDropThreshold) {
        return {
            shouldAlert: true,
            reason: 'price_drop',
            severity: Math.abs(change.percentChange) >= thresholds.alertDropThreshold * 2 ? 'high' : 'medium',
        };
    }

    if (change.direction === 'up' && change.percentChange >= thresholds.alertIncreaseThreshold) {
        return {
            shouldAlert: true,
            reason: 'price_increase',
            severity: change.percentChange >= thresholds.alertIncreaseThreshold * 2 ? 'high' : 'medium',
        };
    }

    return { shouldAlert: false, reason: null };
}

/**
 * Get the previous price for a product
 * @param {number} productId - Product ID
 * @returns {Promise<Object|null>} Previous price record or null
 */
export async function getPreviousPrice(productId) {
    const result = await pool.query(
        `SELECT price, currency, captured_at
         FROM price_history
         WHERE product_id = $1
         ORDER BY captured_at DESC
         LIMIT 1 OFFSET 1`,
        [productId]
    );
    return result.rows[0] || null;
}

/**
 * Get the latest price for a product
 * @param {number} productId - Product ID
 * @returns {Promise<Object|null>} Latest price record or null
 */
export async function getLatestPrice(productId) {
    const result = await pool.query(
        `SELECT price, currency, captured_at
         FROM price_history
         WHERE product_id = $1
         ORDER BY captured_at DESC
         LIMIT 1`,
        [productId]
    );
    return result.rows[0] || null;
}

/**
 * Detect price change for a product after new price is recorded
 * @param {number} productId - Product ID
 * @param {string} site - Site name for metrics
 * @returns {Promise<Object>} Detection result
 */
export async function detectPriceChange(productId, site = 'unknown') {
    const [latest, previous] = await Promise.all([
        getLatestPrice(productId),
        getPreviousPrice(productId),
    ]);

    if (!latest) {
        return { detected: false, reason: 'no_price_data' };
    }

    if (!previous) {
        logger.debug({ productId, price: latest.price }, 'First price recorded for product');
        return { detected: false, reason: 'first_price', price: parseFloat(latest.price) };
    }

    const oldPrice = parseFloat(previous.price);
    const newPrice = parseFloat(latest.price);

    const change = calculatePriceChange(oldPrice, newPrice);

    if (change.isSignificant) {
        // Record in Prometheus metrics
        recordPriceChange(site, oldPrice, newPrice);

        const alertInfo = shouldAlert(change);

        logger.info({
            productId,
            oldPrice,
            newPrice,
            absoluteChange: change.absoluteChange,
            percentChange: `${change.percentChange}%`,
            direction: change.direction,
            shouldAlert: alertInfo.shouldAlert,
            alertReason: alertInfo.reason,
        }, `Significant price change detected: ${change.direction} ${Math.abs(change.percentChange).toFixed(1)}%`);

        return {
            detected: true,
            productId,
            oldPrice,
            newPrice,
            change,
            alert: alertInfo,
        };
    }

    logger.debug({
        productId,
        oldPrice,
        newPrice,
        percentChange: `${change.percentChange}%`,
    }, 'Price change below threshold');

    return { detected: false, reason: 'below_threshold', change };
}

/**
 * Get all significant price changes in the last N hours
 * @param {number} hours - Number of hours to look back
 * @returns {Promise<Array>} List of significant price changes
 */
export async function getRecentPriceChanges(hours = 24) {
    const thresholds = getThresholds();
    
    const result = await pool.query(`
        WITH price_pairs AS (
            SELECT 
                ph1.product_id,
                ph1.price as new_price,
                ph1.currency,
                ph1.captured_at as new_captured_at,
                LAG(ph1.price) OVER (PARTITION BY ph1.product_id ORDER BY ph1.captured_at) as old_price,
                LAG(ph1.captured_at) OVER (PARTITION BY ph1.product_id ORDER BY ph1.captured_at) as old_captured_at
            FROM price_history ph1
            WHERE ph1.captured_at >= NOW() - INTERVAL '${hours} hours'
        )
        SELECT 
            pp.product_id,
            p.url,
            p.site,
            p.title,
            pp.old_price,
            pp.new_price,
            pp.currency,
            pp.old_captured_at,
            pp.new_captured_at,
            ROUND(((pp.new_price - pp.old_price) / pp.old_price * 100)::numeric, 2) as percent_change,
            ROUND((pp.new_price - pp.old_price)::numeric, 2) as absolute_change,
            CASE WHEN pp.new_price > pp.old_price THEN 'up' ELSE 'down' END as direction
        FROM price_pairs pp
        JOIN products p ON p.id = pp.product_id
        WHERE pp.old_price IS NOT NULL
          AND ABS(pp.new_price - pp.old_price) >= $1
          AND ABS((pp.new_price - pp.old_price) / pp.old_price * 100) >= $2
        ORDER BY ABS(percent_change) DESC
    `, [thresholds.minAbsoluteChange, thresholds.minPercentChange]);

    return result.rows;
}

/**
 * Get price history summary for a product
 * @param {number} productId - Product ID
 * @param {number} days - Number of days to analyze
 * @returns {Promise<Object>} Price summary
 */
export async function getPriceSummary(productId, days = 30) {
    const result = await pool.query(`
        SELECT 
            MIN(price) as min_price,
            MAX(price) as max_price,
            AVG(price) as avg_price,
            COUNT(*) as data_points,
            (SELECT price FROM price_history 
             WHERE product_id = $1 
             ORDER BY captured_at DESC LIMIT 1) as current_price,
            (SELECT price FROM price_history 
             WHERE product_id = $1 
             AND captured_at >= NOW() - INTERVAL '${days} days'
             ORDER BY captured_at ASC LIMIT 1) as price_start_of_period
        FROM price_history
        WHERE product_id = $1
          AND captured_at >= NOW() - INTERVAL '${days} days'
    `, [productId]);

    const row = result.rows[0];
    
    if (!row || !row.data_points || row.data_points === 0) {
        return null;
    }

    const currentPrice = parseFloat(row.current_price);
    const startPrice = parseFloat(row.price_start_of_period);
    const periodChange = startPrice ? calculatePriceChange(startPrice, currentPrice) : null;

    return {
        productId,
        period: `${days} days`,
        minPrice: parseFloat(row.min_price),
        maxPrice: parseFloat(row.max_price),
        avgPrice: Math.round(parseFloat(row.avg_price) * 100) / 100,
        currentPrice,
        dataPoints: parseInt(row.data_points),
        periodChange,
        priceRange: parseFloat(row.max_price) - parseFloat(row.min_price),
        volatility: row.avg_price > 0 
            ? Math.round(((parseFloat(row.max_price) - parseFloat(row.min_price)) / parseFloat(row.avg_price)) * 100) 
            : 0,
    };
}

/**
 * Get products with the biggest price drops
 * @param {number} hours - Hours to look back
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Products with price drops
 */
export async function getBiggestPriceDrops(hours = 24, limit = 10) {
    const result = await pool.query(`
        WITH latest_prices AS (
            SELECT DISTINCT ON (product_id)
                product_id,
                price as new_price,
                captured_at as new_captured_at
            FROM price_history
            WHERE captured_at >= NOW() - INTERVAL '${hours} hours'
            ORDER BY product_id, captured_at DESC
        ),
        previous_prices AS (
            SELECT DISTINCT ON (ph.product_id)
                ph.product_id,
                ph.price as old_price,
                ph.captured_at as old_captured_at
            FROM price_history ph
            JOIN latest_prices lp ON lp.product_id = ph.product_id
            WHERE ph.captured_at < lp.new_captured_at
            ORDER BY ph.product_id, ph.captured_at DESC
        )
        SELECT 
            p.id as product_id,
            p.url,
            p.site,
            p.title,
            pp.old_price,
            lp.new_price,
            ROUND((lp.new_price - pp.old_price)::numeric, 2) as absolute_change,
            ROUND(((lp.new_price - pp.old_price) / pp.old_price * 100)::numeric, 2) as percent_change
        FROM latest_prices lp
        JOIN previous_prices pp ON pp.product_id = lp.product_id
        JOIN products p ON p.id = lp.product_id
        WHERE lp.new_price < pp.old_price
        ORDER BY percent_change ASC
        LIMIT $1
    `, [limit]);

    return result.rows;
}

export default {
    calculatePriceChange,
    shouldAlert,
    detectPriceChange,
    getPreviousPrice,
    getLatestPrice,
    getRecentPriceChanges,
    getPriceSummary,
    getBiggestPriceDrops,
};

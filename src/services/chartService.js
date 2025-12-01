/**
 * Chart Service
 * Prepares price history data for charting and visualization
 */

import { pool } from '../db/connect-pg.js';
import logger from '../utils/logger.js';

/**
 * Time range options for charts
 */
export const TIME_RANGES = {
    '24h': { hours: 24, label: 'Last 24 Hours' },
    '7d': { days: 7, label: 'Last 7 Days' },
    '30d': { days: 30, label: 'Last 30 Days' },
    '90d': { days: 90, label: 'Last 90 Days' },
    '1y': { days: 365, label: 'Last Year' },
    'all': { days: null, label: 'All Time' },
};

/**
 * Get price history formatted for Chart.js
 * @param {number} productId - Product ID
 * @param {string} range - Time range key (24h, 7d, 30d, 90d, 1y, all)
 * @returns {Object} Chart.js compatible data
 */
export async function getPriceChartData(productId, range = '30d') {
    const timeRange = TIME_RANGES[range] || TIME_RANGES['30d'];
    
    let whereClause = 'WHERE product_id = $1';
    const params = [productId];
    
    if (timeRange.hours) {
        whereClause += ` AND captured_at >= NOW() - INTERVAL '${timeRange.hours} hours'`;
    } else if (timeRange.days) {
        whereClause += ` AND captured_at >= NOW() - INTERVAL '${timeRange.days} days'`;
    }
    
    const result = await pool.query(`
        SELECT 
            price,
            currency,
            captured_at
        FROM price_history
        ${whereClause}
        ORDER BY captured_at ASC
    `, params);
    
    if (result.rows.length === 0) {
        return {
            labels: [],
            datasets: [{
                label: 'Price',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                fill: true,
                tension: 0.1,
            }],
            meta: {
                productId,
                range,
                rangeLabel: timeRange.label,
                dataPoints: 0,
                currency: 'USD',
            },
        };
    }
    
    const currency = result.rows[0].currency || 'USD';
    const labels = result.rows.map(row => row.captured_at.toISOString());
    const prices = result.rows.map(row => parseFloat(row.price));
    
    // Calculate statistics
    const stats = calculatePriceStats(prices);
    
    return {
        labels,
        datasets: [{
            label: `Price (${currency})`,
            data: prices,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: prices.length > 100 ? 0 : 3,
            pointHoverRadius: 5,
        }],
        meta: {
            productId,
            range,
            rangeLabel: timeRange.label,
            dataPoints: prices.length,
            currency,
            ...stats,
        },
    };
}

/**
 * Calculate price statistics
 * @param {number[]} prices - Array of prices
 * @returns {Object} Statistics
 */
export function calculatePriceStats(prices) {
    if (!prices || prices.length === 0) {
        return {
            min: null,
            max: null,
            avg: null,
            current: null,
            first: null,
            change: null,
            changePercent: null,
        };
    }
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const current = prices[prices.length - 1];
    const first = prices[0];
    const change = current - first;
    const changePercent = first !== 0 ? ((current - first) / first) * 100 : 0;
    
    return {
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        avg: Math.round(avg * 100) / 100,
        current: Math.round(current * 100) / 100,
        first: Math.round(first * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
    };
}

/**
 * Get price history for multiple products (comparison chart)
 * @param {number[]} productIds - Array of product IDs
 * @param {string} range - Time range key
 * @returns {Object} Chart.js compatible data with multiple datasets
 */
export async function getComparisonChartData(productIds, range = '30d') {
    if (!productIds || productIds.length === 0) {
        return {
            labels: [],
            datasets: [],
            meta: { range, productCount: 0 },
        };
    }
    
    const timeRange = TIME_RANGES[range] || TIME_RANGES['30d'];
    
    // Get product info
    const productsResult = await pool.query(`
        SELECT id, title, site FROM products WHERE id = ANY($1)
    `, [productIds]);
    
    const products = {};
    productsResult.rows.forEach(p => {
        products[p.id] = { title: p.title, site: p.site };
    });
    
    // Build time filter
    let timeFilter = '';
    if (timeRange.hours) {
        timeFilter = `AND captured_at >= NOW() - INTERVAL '${timeRange.hours} hours'`;
    } else if (timeRange.days) {
        timeFilter = `AND captured_at >= NOW() - INTERVAL '${timeRange.days} days'`;
    }
    
    // Get price history for all products
    const historyResult = await pool.query(`
        SELECT 
            product_id,
            price,
            currency,
            captured_at
        FROM price_history
        WHERE product_id = ANY($1)
        ${timeFilter}
        ORDER BY captured_at ASC
    `, [productIds]);
    
    // Group by product
    const productData = {};
    historyResult.rows.forEach(row => {
        if (!productData[row.product_id]) {
            productData[row.product_id] = [];
        }
        productData[row.product_id].push({
            price: parseFloat(row.price),
            captured_at: row.captured_at,
            currency: row.currency,
        });
    });
    
    // Create datasets with distinct colors
    const colors = [
        { border: 'rgb(75, 192, 192)', bg: 'rgba(75, 192, 192, 0.1)' },
        { border: 'rgb(255, 99, 132)', bg: 'rgba(255, 99, 132, 0.1)' },
        { border: 'rgb(54, 162, 235)', bg: 'rgba(54, 162, 235, 0.1)' },
        { border: 'rgb(255, 206, 86)', bg: 'rgba(255, 206, 86, 0.1)' },
        { border: 'rgb(153, 102, 255)', bg: 'rgba(153, 102, 255, 0.1)' },
        { border: 'rgb(255, 159, 64)', bg: 'rgba(255, 159, 64, 0.1)' },
        { border: 'rgb(199, 199, 199)', bg: 'rgba(199, 199, 199, 0.1)' },
    ];
    
    const datasets = [];
    let allLabels = new Set();
    
    Object.keys(productData).forEach((productId, index) => {
        const data = productData[productId];
        const product = products[productId] || { title: `Product ${productId}`, site: 'Unknown' };
        const color = colors[index % colors.length];
        
        data.forEach(d => allLabels.add(d.captured_at.toISOString()));
        
        datasets.push({
            label: `${product.title.substring(0, 40)}... (${product.site})`,
            data: data.map(d => ({ x: d.captured_at.toISOString(), y: d.price })),
            borderColor: color.border,
            backgroundColor: color.bg,
            fill: false,
            tension: 0.1,
            pointRadius: data.length > 50 ? 0 : 3,
        });
    });
    
    return {
        labels: Array.from(allLabels).sort(),
        datasets,
        meta: {
            range,
            rangeLabel: timeRange.label,
            productCount: productIds.length,
            products: Object.entries(products).map(([id, p]) => ({
                id: parseInt(id),
                title: p.title,
                site: p.site,
            })),
        },
    };
}

/**
 * Get daily aggregated price data (for long time ranges)
 * @param {number} productId - Product ID
 * @param {string} range - Time range key
 * @returns {Object} Chart.js compatible data with daily aggregates
 */
export async function getDailyPriceChartData(productId, range = '90d') {
    const timeRange = TIME_RANGES[range] || TIME_RANGES['90d'];
    
    let whereClause = 'WHERE product_id = $1';
    if (timeRange.days) {
        whereClause += ` AND captured_at >= NOW() - INTERVAL '${timeRange.days} days'`;
    }
    
    const result = await pool.query(`
        SELECT 
            DATE(captured_at) as date,
            MIN(price) as min_price,
            MAX(price) as max_price,
            AVG(price) as avg_price,
            (ARRAY_AGG(price ORDER BY captured_at DESC))[1] as close_price,
            (ARRAY_AGG(price ORDER BY captured_at ASC))[1] as open_price,
            COUNT(*) as data_points,
            MAX(currency) as currency
        FROM price_history
        ${whereClause}
        GROUP BY DATE(captured_at)
        ORDER BY date ASC
    `, [productId]);
    
    if (result.rows.length === 0) {
        return {
            labels: [],
            datasets: [],
            meta: { productId, range, dataPoints: 0 },
        };
    }
    
    const currency = result.rows[0].currency || 'USD';
    const labels = result.rows.map(row => row.date.toISOString().split('T')[0]);
    
    return {
        labels,
        datasets: [
            {
                label: `Average Price (${currency})`,
                data: result.rows.map(row => Math.round(parseFloat(row.avg_price) * 100) / 100),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                fill: true,
                tension: 0.1,
            },
            {
                label: `Min Price (${currency})`,
                data: result.rows.map(row => parseFloat(row.min_price)),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0,
            },
            {
                label: `Max Price (${currency})`,
                data: result.rows.map(row => parseFloat(row.max_price)),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0,
            },
        ],
        meta: {
            productId,
            range,
            rangeLabel: timeRange.label,
            days: result.rows.length,
            currency,
            totalDataPoints: result.rows.reduce((sum, row) => sum + parseInt(row.data_points), 0),
        },
    };
}

/**
 * Get product info with price summary for chart header
 * @param {number} productId - Product ID
 * @returns {Object} Product info with summary
 */
export async function getProductChartInfo(productId) {
    const result = await pool.query(`
        SELECT 
            p.id,
            p.url,
            p.site,
            p.title,
            p.last_seen_at,
            (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) as total_prices,
            (SELECT MIN(captured_at) FROM price_history WHERE product_id = p.id) as first_price_date,
            (SELECT price FROM price_history WHERE product_id = p.id ORDER BY captured_at DESC LIMIT 1) as current_price,
            (SELECT currency FROM price_history WHERE product_id = p.id ORDER BY captured_at DESC LIMIT 1) as currency,
            (SELECT MIN(price) FROM price_history WHERE product_id = p.id) as all_time_low,
            (SELECT MAX(price) FROM price_history WHERE product_id = p.id) as all_time_high
        FROM products p
        WHERE p.id = $1
    `, [productId]);
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const row = result.rows[0];
    return {
        id: row.id,
        url: row.url,
        site: row.site,
        title: row.title,
        lastSeen: row.last_seen_at,
        totalPrices: parseInt(row.total_prices),
        firstPriceDate: row.first_price_date,
        currentPrice: row.current_price ? parseFloat(row.current_price) : null,
        currency: row.currency || 'USD',
        allTimeLow: row.all_time_low ? parseFloat(row.all_time_low) : null,
        allTimeHigh: row.all_time_high ? parseFloat(row.all_time_high) : null,
    };
}

/**
 * Get all products with price data for chart selection
 * @returns {Array} Products with summary info
 */
export async function getProductsForChartSelection() {
    const result = await pool.query(`
        SELECT 
            p.id,
            p.site,
            p.title,
            (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) as price_count,
            (SELECT price FROM price_history WHERE product_id = p.id ORDER BY captured_at DESC LIMIT 1) as current_price,
            (SELECT currency FROM price_history WHERE product_id = p.id ORDER BY captured_at DESC LIMIT 1) as currency
        FROM products p
        WHERE EXISTS (SELECT 1 FROM price_history WHERE product_id = p.id)
        ORDER BY p.last_seen_at DESC
    `);
    
    return result.rows.map(row => ({
        id: row.id,
        site: row.site,
        title: row.title,
        priceCount: parseInt(row.price_count),
        currentPrice: row.current_price ? parseFloat(row.current_price) : null,
        currency: row.currency || 'USD',
    }));
}

export default {
    TIME_RANGES,
    getPriceChartData,
    calculatePriceStats,
    getComparisonChartData,
    getDailyPriceChartData,
    getProductChartInfo,
    getProductsForChartSelection,
};

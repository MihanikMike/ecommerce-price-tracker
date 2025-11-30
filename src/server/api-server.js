/**
 * REST API Server
 * Provides RESTful endpoints for accessing price tracker data
 */

import http from 'http';
import { URL } from 'url';
import logger from '../utils/logger.js';
import { pool } from '../db/connect-pg.js';
import * as productRepo from '../db/productRepository.js';
import * as trackedRepo from '../db/trackedProductsRepository.js';
import * as priceChangeService from '../services/priceChangeService.js';
import { getDatabaseStats } from '../services/retentionService.js';
import config from '../config/index.js';

const DEFAULT_PORT = parseInt(process.env.API_PORT, 10) || 3001;
const API_PREFIX = '/api';

let server = null;

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Limit body size to 1MB
            if (body.length > 1024 * 1024) {
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode);
    res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 */
function sendError(res, statusCode, message, details = null) {
    sendJSON(res, statusCode, {
        error: true,
        message,
        details,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Parse pagination parameters
 */
function getPagination(url) {
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 20));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

/**
 * Simple router implementation
 */
class Router {
    constructor() {
        this.routes = [];
    }

    add(method, pattern, handler) {
        // Convert pattern like /products/:id to regex
        const regex = new RegExp(
            '^' + pattern.replace(/:[^/]+/g, '([^/]+)') + '$'
        );
        const paramNames = [...pattern.matchAll(/:([^/]+)/g)].map(m => m[1]);
        this.routes.push({ method, pattern, regex, paramNames, handler });
    }

    get(pattern, handler) { this.add('GET', pattern, handler); }
    post(pattern, handler) { this.add('POST', pattern, handler); }
    put(pattern, handler) { this.add('PUT', pattern, handler); }
    patch(pattern, handler) { this.add('PATCH', pattern, handler); }
    delete(pattern, handler) { this.add('DELETE', pattern, handler); }

    async route(req, res, path) {
        for (const route of this.routes) {
            if (route.method !== req.method) continue;
            
            const match = path.match(route.regex);
            if (match) {
                const params = {};
                route.paramNames.forEach((name, i) => {
                    params[name] = match[i + 1];
                });
                await route.handler(req, res, params);
                return true;  // Handler was found and executed
            }
        }
        return false;
    }
}

const router = new Router();

// ============================================================
// PRODUCTS API
// ============================================================

/**
 * GET /api/products - List all products with latest prices
 */
router.get('/products', async (req, res, params) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const { page, limit, offset } = getPagination(url);
        const site = url.searchParams.get('site');
        
        let query = `
            SELECT 
                p.*,
                ph.price as latest_price,
                ph.currency,
                ph.captured_at as price_captured_at,
                (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) as price_count
            FROM products p
            LEFT JOIN LATERAL (
                SELECT price, currency, captured_at
                FROM price_history
                WHERE product_id = p.id
                ORDER BY captured_at DESC
                LIMIT 1
            ) ph ON true
        `;
        
        const queryParams = [];
        if (site) {
            query += ` WHERE p.site = $1`;
            queryParams.push(site);
        }
        
        query += ` ORDER BY p.last_seen_at DESC NULLS LAST`;
        query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, offset);
        
        const result = await pool.query(query, queryParams);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM products';
        if (site) {
            countQuery += ' WHERE site = $1';
        }
        const countResult = await pool.query(countQuery, site ? [site] : []);
        const total = parseInt(countResult.rows[0].count, 10);
        
        sendJSON(res, 200, {
            products: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error({ error }, 'API error: GET /products');
        sendError(res, 500, 'Failed to fetch products', error.message);
    }
});

/**
 * GET /api/products/:id - Get single product
 */
router.get('/products/:id', async (req, res, params) => {
    try {
        const productId = parseInt(params.id, 10);
        if (isNaN(productId)) {
            return sendError(res, 400, 'Invalid product ID');
        }
        
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
            WHERE p.id = $1
        `, [productId]);
        
        if (result.rows.length === 0) {
            return sendError(res, 404, 'Product not found');
        }
        
        // Get price summary
        const summary = await priceChangeService.getPriceSummary(productId);
        
        sendJSON(res, 200, {
            product: result.rows[0],
            priceSummary: summary,
        });
    } catch (error) {
        logger.error({ error, productId: params.id }, 'API error: GET /products/:id');
        sendError(res, 500, 'Failed to fetch product', error.message);
    }
});

/**
 * GET /api/products/:id/history - Get price history
 */
router.get('/products/:id/history', async (req, res, params) => {
    try {
        const productId = parseInt(params.id, 10);
        if (isNaN(productId)) {
            return sendError(res, 400, 'Invalid product ID');
        }
        
        const url = new URL(req.url, `http://${req.headers.host}`);
        const limit = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 100));
        const days = parseInt(url.searchParams.get('days'), 10) || null;
        
        let query = `
            SELECT id, price, currency, captured_at
            FROM price_history
            WHERE product_id = $1
        `;
        const queryParams = [productId];
        
        if (days) {
            query += ` AND captured_at >= NOW() - INTERVAL '${days} days'`;
        }
        
        query += ` ORDER BY captured_at DESC LIMIT $2`;
        queryParams.push(limit);
        
        const result = await pool.query(query, queryParams);
        
        if (result.rows.length === 0) {
            // Check if product exists
            const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
            if (productCheck.rows.length === 0) {
                return sendError(res, 404, 'Product not found');
            }
        }
        
        sendJSON(res, 200, {
            productId,
            history: result.rows,
            count: result.rows.length,
        });
    } catch (error) {
        logger.error({ error, productId: params.id }, 'API error: GET /products/:id/history');
        sendError(res, 500, 'Failed to fetch price history', error.message);
    }
});

/**
 * DELETE /api/products/:id - Delete a product
 */
router.delete('/products/:id', async (req, res, params) => {
    try {
        const productId = parseInt(params.id, 10);
        if (isNaN(productId)) {
            return sendError(res, 400, 'Invalid product ID');
        }
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Delete price history first
            await client.query('DELETE FROM price_history WHERE product_id = $1', [productId]);
            
            // Delete product
            const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [productId]);
            
            if (result.rows.length === 0) {
                await client.query('ROLLBACK');
                return sendError(res, 404, 'Product not found');
            }
            
            await client.query('COMMIT');
            
            logger.info({ productId }, 'Product deleted via API');
            sendJSON(res, 200, { success: true, productId });
        } finally {
            client.release();
        }
    } catch (error) {
        logger.error({ error, productId: params.id }, 'API error: DELETE /products/:id');
        sendError(res, 500, 'Failed to delete product', error.message);
    }
});

// ============================================================
// TRACKED PRODUCTS API
// ============================================================

/**
 * GET /api/tracked - List all tracked products
 */
router.get('/tracked', async (req, res, params) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const { page, limit, offset } = getPagination(url);
        const mode = url.searchParams.get('mode'); // 'url' or 'search'
        const enabled = url.searchParams.get('enabled');
        
        let query = 'SELECT * FROM tracked_products WHERE 1=1';
        const queryParams = [];
        let paramIndex = 1;
        
        if (mode) {
            query += ` AND tracking_mode = $${paramIndex++}`;
            queryParams.push(mode);
        }
        
        if (enabled !== null && enabled !== undefined) {
            query += ` AND enabled = $${paramIndex++}`;
            queryParams.push(enabled === 'true');
        }
        
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        queryParams.push(limit, offset);
        
        const result = await pool.query(query, queryParams);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM tracked_products WHERE 1=1';
        const countParams = [];
        let countIndex = 1;
        if (mode) {
            countQuery += ` AND tracking_mode = $${countIndex++}`;
            countParams.push(mode);
        }
        if (enabled !== null && enabled !== undefined) {
            countQuery += ` AND enabled = $${countIndex}`;
            countParams.push(enabled === 'true');
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count, 10);
        
        sendJSON(res, 200, {
            tracked: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error({ error }, 'API error: GET /tracked');
        sendError(res, 500, 'Failed to fetch tracked products', error.message);
    }
});

/**
 * GET /api/tracked/:id - Get single tracked product
 */
router.get('/tracked/:id', async (req, res, params) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return sendError(res, 400, 'Invalid tracked product ID');
        }
        
        const result = await pool.query('SELECT * FROM tracked_products WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return sendError(res, 404, 'Tracked product not found');
        }
        
        sendJSON(res, 200, { tracked: result.rows[0] });
    } catch (error) {
        logger.error({ error, id: params.id }, 'API error: GET /tracked/:id');
        sendError(res, 500, 'Failed to fetch tracked product', error.message);
    }
});

/**
 * POST /api/tracked - Add a new tracked product
 */
router.post('/tracked', async (req, res, params) => {
    try {
        const body = await parseBody(req);
        
        // Determine tracking mode
        const isSearchBased = !body.url && body.productName;
        
        let id;
        if (isSearchBased) {
            // Search-based tracking
            if (!body.productName) {
                return sendError(res, 400, 'productName is required for search-based tracking');
            }
            id = await trackedRepo.addSearchBasedProduct({
                productName: body.productName,
                site: body.site || 'any',
                keywords: body.keywords || [],
                enabled: body.enabled !== false,
                checkIntervalMinutes: body.checkIntervalMinutes || 60,
            });
        } else {
            // URL-based tracking
            if (!body.url) {
                return sendError(res, 400, 'url is required for URL-based tracking');
            }
            id = await trackedRepo.addTrackedProduct({
                url: body.url,
                site: body.site,
                enabled: body.enabled !== false,
                checkIntervalMinutes: body.checkIntervalMinutes || 60,
            });
        }
        
        const result = await pool.query('SELECT * FROM tracked_products WHERE id = $1', [id]);
        
        logger.info({ id, mode: isSearchBased ? 'search' : 'url' }, 'Tracked product added via API');
        sendJSON(res, 201, { 
            success: true, 
            tracked: result.rows[0],
        });
    } catch (error) {
        logger.error({ error }, 'API error: POST /tracked');
        // Return 400 for validation errors
        if (error.message && error.message.includes('Validation failed')) {
            return sendError(res, 400, 'Invalid request', error.message);
        }
        sendError(res, 500, 'Failed to add tracked product', error.message);
    }
});

/**
 * PATCH /api/tracked/:id - Update a tracked product
 */
router.patch('/tracked/:id', async (req, res, params) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return sendError(res, 400, 'Invalid tracked product ID');
        }
        
        const body = await parseBody(req);
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (body.enabled !== undefined) {
            updates.push(`enabled = $${paramIndex++}`);
            values.push(body.enabled);
        }
        if (body.checkIntervalMinutes !== undefined) {
            updates.push(`check_interval_minutes = $${paramIndex++}`);
            values.push(body.checkIntervalMinutes);
        }
        if (body.site !== undefined) {
            updates.push(`site = $${paramIndex++}`);
            values.push(body.site);
        }
        if (body.keywords !== undefined) {
            updates.push(`search_keywords = $${paramIndex++}`);
            values.push(body.keywords);
        }
        
        if (updates.length === 0) {
            return sendError(res, 400, 'No valid fields to update');
        }
        
        updates.push(`updated_at = NOW()`);
        values.push(id);
        
        const result = await pool.query(
            `UPDATE tracked_products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        
        if (result.rows.length === 0) {
            return sendError(res, 404, 'Tracked product not found');
        }
        
        logger.info({ id, updates: Object.keys(body) }, 'Tracked product updated via API');
        sendJSON(res, 200, { 
            success: true, 
            tracked: result.rows[0],
        });
    } catch (error) {
        logger.error({ error, id: params.id }, 'API error: PATCH /tracked/:id');
        sendError(res, 500, 'Failed to update tracked product', error.message);
    }
});

/**
 * DELETE /api/tracked/:id - Delete a tracked product
 */
router.delete('/tracked/:id', async (req, res, params) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return sendError(res, 400, 'Invalid tracked product ID');
        }
        
        await trackedRepo.deleteTrackedProduct(id);
        
        logger.info({ id }, 'Tracked product deleted via API');
        sendJSON(res, 200, { success: true, id });
    } catch (error) {
        if (error.message.includes('not found')) {
            return sendError(res, 404, 'Tracked product not found');
        }
        logger.error({ error, id: params.id }, 'API error: DELETE /tracked/:id');
        sendError(res, 500, 'Failed to delete tracked product', error.message);
    }
});

/**
 * POST /api/tracked/:id/enable - Enable a tracked product
 */
router.post('/tracked/:id/enable', async (req, res, params) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return sendError(res, 400, 'Invalid tracked product ID');
        }
        
        await trackedRepo.setProductEnabled(id, true);
        sendJSON(res, 200, { success: true, id, enabled: true });
    } catch (error) {
        logger.error({ error, id: params.id }, 'API error: POST /tracked/:id/enable');
        sendError(res, 500, 'Failed to enable tracked product', error.message);
    }
});

/**
 * POST /api/tracked/:id/disable - Disable a tracked product
 */
router.post('/tracked/:id/disable', async (req, res, params) => {
    try {
        const id = parseInt(params.id, 10);
        if (isNaN(id)) {
            return sendError(res, 400, 'Invalid tracked product ID');
        }
        
        await trackedRepo.setProductEnabled(id, false);
        sendJSON(res, 200, { success: true, id, enabled: false });
    } catch (error) {
        logger.error({ error, id: params.id }, 'API error: POST /tracked/:id/disable');
        sendError(res, 500, 'Failed to disable tracked product', error.message);
    }
});

// ============================================================
// PRICE CHANGES API
// ============================================================

/**
 * GET /api/price-changes - Get recent price changes
 */
router.get('/price-changes', async (req, res, params) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const hours = parseInt(url.searchParams.get('hours'), 10) || 24;
        const { limit } = getPagination(url);
        
        const changes = await priceChangeService.getRecentPriceChanges(hours, limit);
        
        sendJSON(res, 200, {
            priceChanges: changes,
            period: `${hours} hours`,
            count: changes.length,
        });
    } catch (error) {
        logger.error({ error }, 'API error: GET /price-changes');
        sendError(res, 500, 'Failed to fetch price changes', error.message);
    }
});

/**
 * GET /api/price-changes/drops - Get biggest price drops
 */
router.get('/price-changes/drops', async (req, res, params) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const days = parseInt(url.searchParams.get('days'), 10) || 7;
        const { limit } = getPagination(url);
        
        const drops = await priceChangeService.getBiggestPriceDrops(days, limit);
        
        sendJSON(res, 200, {
            priceDrops: drops,
            period: `${days} days`,
            count: drops.length,
        });
    } catch (error) {
        logger.error({ error }, 'API error: GET /price-changes/drops');
        sendError(res, 500, 'Failed to fetch price drops', error.message);
    }
});

// ============================================================
// STATS API
// ============================================================

/**
 * GET /api/stats - Get database statistics
 */
router.get('/stats', async (req, res, params) => {
    try {
        const stats = await getDatabaseStats();
        
        // Add some extra stats
        const trackedResult = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE enabled = true) as enabled,
                COUNT(*) FILTER (WHERE tracking_mode = 'url') as url_based,
                COUNT(*) FILTER (WHERE tracking_mode = 'search') as search_based
            FROM tracked_products
        `);
        
        sendJSON(res, 200, {
            database: stats,
            tracking: trackedResult.rows[0],
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({ error }, 'API error: GET /stats');
        sendError(res, 500, 'Failed to fetch stats', error.message);
    }
});

/**
 * GET /api/stats/config - Get current configuration
 */
router.get('/stats/config', async (req, res, params) => {
    // Return non-sensitive config options
    sendJSON(res, 200, {
        priceChange: config.priceChange,
        retention: config.retention,
        scraper: {
            useProxy: config.SCRAPER_USE_PROXY,
            browserPoolSize: config.BROWSER_POOL_SIZE,
        },
        version: process.env.npm_package_version || '1.0.0',
    });
});

// ============================================================
// SEARCH API
// ============================================================

/**
 * POST /api/search - Search for a product
 */
router.post('/search', async (req, res, params) => {
    try {
        const body = await parseBody(req);
        
        if (!body.query) {
            return sendError(res, 400, 'query is required');
        }
        
        // Import search module dynamically to avoid circular dependencies
        const { searchProduct } = await import('../search/search-engine.js');
        const { browserPool } = await import('../utils/BrowserPool.js');
        
        // Ensure browser pool is initialized
        await browserPool.initialize();
        
        const results = await searchProduct(body.query, {
            maxResults: body.maxResults || 10,
            sites: body.sites || null,
        });
        
        sendJSON(res, 200, {
            query: body.query,
            results,
            count: results.length,
        });
    } catch (error) {
        logger.error({ error }, 'API error: POST /search');
        sendError(res, 500, 'Search failed', error.message);
    }
});

// ============================================================
// API SERVER
// ============================================================

/**
 * Handle API requests
 */
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Only handle /api routes
    if (!path.startsWith(API_PREFIX)) {
        sendError(res, 404, 'Not Found', 'API routes start with /api');
        return;
    }

    const apiPath = path.slice(API_PREFIX.length) || '/';

    try {
        // Try to route the request
        const handled = await router.route(req, res, apiPath);
        
        if (!handled) {
            // Root API endpoint
            if (apiPath === '/' || apiPath === '') {
                sendJSON(res, 200, {
                    name: 'E-Commerce Price Tracker API',
                    version: '1.0.0',
                    endpoints: {
                        products: {
                            'GET /api/products': 'List all products with latest prices',
                            'GET /api/products/:id': 'Get single product with price summary',
                            'GET /api/products/:id/history': 'Get price history for product',
                            'DELETE /api/products/:id': 'Delete a product',
                        },
                        tracked: {
                            'GET /api/tracked': 'List all tracked products',
                            'GET /api/tracked/:id': 'Get single tracked product',
                            'POST /api/tracked': 'Add new tracked product',
                            'PATCH /api/tracked/:id': 'Update tracked product',
                            'DELETE /api/tracked/:id': 'Delete tracked product',
                            'POST /api/tracked/:id/enable': 'Enable tracking',
                            'POST /api/tracked/:id/disable': 'Disable tracking',
                        },
                        priceChanges: {
                            'GET /api/price-changes': 'Get recent price changes',
                            'GET /api/price-changes/drops': 'Get biggest price drops',
                        },
                        stats: {
                            'GET /api/stats': 'Get database statistics',
                            'GET /api/stats/config': 'Get current configuration',
                        },
                        search: {
                            'POST /api/search': 'Search for products',
                        },
                    },
                    documentation: 'https://github.com/MihanikMike/ecommerce-price-tracker',
                });
            } else {
                sendError(res, 404, 'Endpoint not found', apiPath);
            }
        }
    } catch (error) {
        logger.error({ error, path: apiPath, method: req.method }, 'API request error');
        if (!res.headersSent) {
            sendError(res, 500, 'Internal Server Error', error.message);
        }
    }
}

/**
 * Start the API server
 */
export async function startApiServer(port = DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
        server = http.createServer(handleRequest);

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.warn({ port }, 'API server port in use, trying next port');
                startApiServer(port + 1).then(resolve).catch(reject);
            } else {
                reject(error);
            }
        });

        server.listen(port, () => {
            // Get the actual port (important when port 0 is passed for random port)
            const actualPort = server.address().port;
            logger.info({ port: actualPort }, 'API server started');
            logger.info({ 
                docs: `http://localhost:${actualPort}/api`,
                products: `http://localhost:${actualPort}/api/products`,
                tracked: `http://localhost:${actualPort}/api/tracked`,
            }, 'API endpoints available');
            resolve(actualPort);
        });
    });
}

/**
 * Stop the API server
 */
export async function stopApiServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                logger.info('API server stopped');
                server = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

export { router };
export default { startApiServer, stopApiServer };

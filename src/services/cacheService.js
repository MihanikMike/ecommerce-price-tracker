/**
 * Cache Service
 * Redis-based caching layer for improved performance
 */

import Redis from 'ioredis';
import logger from '../utils/logger.js';
import config from '../config/index.js';

// Cache configuration with defaults
const CACHE_CONFIG = {
    enabled: process.env.CACHE_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'pt:',
    
    // Default TTLs (in seconds)
    ttl: {
        product: parseInt(process.env.CACHE_TTL_PRODUCT, 10) || 300,         // 5 minutes
        productList: parseInt(process.env.CACHE_TTL_PRODUCT_LIST, 10) || 60, // 1 minute
        priceHistory: parseInt(process.env.CACHE_TTL_PRICE_HISTORY, 10) || 120, // 2 minutes
        chartData: parseInt(process.env.CACHE_TTL_CHART, 10) || 180,         // 3 minutes
        searchResults: parseInt(process.env.CACHE_TTL_SEARCH, 10) || 600,    // 10 minutes
        stats: parseInt(process.env.CACHE_TTL_STATS, 10) || 30,              // 30 seconds
    },
};

// Cache key prefixes
export const CACHE_KEYS = {
    PRODUCT: 'product:',
    PRODUCT_LIST: 'products:list',
    PRODUCT_HISTORY: 'product:history:',
    TRACKED_PRODUCTS: 'tracked:list',
    TRACKED_PRODUCT: 'tracked:',
    CHART_DATA: 'chart:',
    CHART_DAILY: 'chart:daily:',
    CHART_COMPARE: 'chart:compare:',
    SEARCH_RESULTS: 'search:',
    PRICE_CHANGES: 'price:changes:',
    STATS: 'stats:',
    CONFIG: 'config',
};

let redisClient = null;
let isConnected = false;
let connectionError = null;

/**
 * Get cache configuration
 * @returns {Object} Cache configuration
 */
export function getCacheConfig() {
    return { ...CACHE_CONFIG };
}

/**
 * Initialize Redis connection
 * @returns {Promise<boolean>} True if connected
 */
export async function initializeCache() {
    if (!CACHE_CONFIG.enabled) {
        logger.info('Cache is disabled');
        return false;
    }
    
    if (redisClient && isConnected) {
        return true;
    }
    
    try {
        redisClient = new Redis({
            host: CACHE_CONFIG.host,
            port: CACHE_CONFIG.port,
            password: CACHE_CONFIG.password,
            db: CACHE_CONFIG.db,
            keyPrefix: CACHE_CONFIG.keyPrefix,
            retryStrategy: (times) => {
                if (times > 3) {
                    logger.warn({ times }, 'Redis retry limit reached');
                    return null; // Stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            maxRetriesPerRequest: 1,
            enableReadyCheck: true,
            lazyConnect: true,
        });
        
        redisClient.on('connect', () => {
            isConnected = true;
            connectionError = null;
            logger.info({ host: CACHE_CONFIG.host, port: CACHE_CONFIG.port }, 'Redis connected');
        });
        
        redisClient.on('error', (error) => {
            connectionError = error;
            logger.error({ error }, 'Redis error');
        });
        
        redisClient.on('close', () => {
            isConnected = false;
            logger.info('Redis connection closed');
        });
        
        await redisClient.connect();
        isConnected = true;
        return true;
        
    } catch (error) {
        connectionError = error;
        logger.warn({ error: error.message }, 'Failed to connect to Redis - caching disabled');
        return false;
    }
}

/**
 * Close Redis connection
 */
export async function closeCache() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        isConnected = false;
        logger.info('Redis connection closed');
    }
}

/**
 * Check if cache is available
 * @returns {boolean} True if cache is ready
 */
export function isCacheAvailable() {
    return CACHE_CONFIG.enabled && isConnected && redisClient !== null;
}

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null
 */
export async function get(key) {
    if (!isCacheAvailable()) return null;
    
    try {
        const value = await redisClient.get(key);
        if (value) {
            logger.debug({ key }, 'Cache hit');
            return JSON.parse(value);
        }
        logger.debug({ key }, 'Cache miss');
        return null;
    } catch (error) {
        logger.warn({ error: error.message, key }, 'Cache get error');
        return null;
    }
}

/**
 * Set a value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} True if successful
 */
export async function set(key, value, ttl = null) {
    if (!isCacheAvailable()) return false;
    
    try {
        const serialized = JSON.stringify(value);
        if (ttl) {
            await redisClient.setex(key, ttl, serialized);
        } else {
            await redisClient.set(key, serialized);
        }
        logger.debug({ key, ttl }, 'Cache set');
        return true;
    } catch (error) {
        logger.warn({ error: error.message, key }, 'Cache set error');
        return false;
    }
}

/**
 * Delete a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} True if deleted
 */
export async function del(key) {
    if (!isCacheAvailable()) return false;
    
    try {
        await redisClient.del(key);
        logger.debug({ key }, 'Cache deleted');
        return true;
    } catch (error) {
        logger.warn({ error: error.message, key }, 'Cache delete error');
        return false;
    }
}

/**
 * Delete multiple keys by pattern
 * @param {string} pattern - Key pattern (e.g., 'product:*')
 * @returns {Promise<number>} Number of keys deleted
 */
export async function delByPattern(pattern) {
    if (!isCacheAvailable()) return 0;
    
    try {
        const fullPattern = CACHE_CONFIG.keyPrefix + pattern;
        const keys = await redisClient.keys(fullPattern);
        
        if (keys.length === 0) return 0;
        
        // Remove prefix from keys before deletion (ioredis adds it back)
        const keysWithoutPrefix = keys.map(k => k.replace(CACHE_CONFIG.keyPrefix, ''));
        const deleted = await redisClient.del(...keysWithoutPrefix);
        
        logger.debug({ pattern, deleted }, 'Cache pattern deleted');
        return deleted;
    } catch (error) {
        logger.warn({ error: error.message, pattern }, 'Cache pattern delete error');
        return 0;
    }
}

/**
 * Flush all cache
 * @returns {Promise<boolean>} True if flushed
 */
export async function flushAll() {
    if (!isCacheAvailable()) return false;
    
    try {
        // Only flush keys with our prefix
        const pattern = '*';
        const keys = await redisClient.keys(CACHE_CONFIG.keyPrefix + pattern);
        
        if (keys.length > 0) {
            const keysWithoutPrefix = keys.map(k => k.replace(CACHE_CONFIG.keyPrefix, ''));
            await redisClient.del(...keysWithoutPrefix);
        }
        
        logger.info({ keysDeleted: keys.length }, 'Cache flushed');
        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Cache flush error');
        return false;
    }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export async function getStats() {
    if (!isCacheAvailable()) {
        return {
            enabled: CACHE_CONFIG.enabled,
            connected: false,
            error: connectionError?.message || null,
        };
    }
    
    try {
        const info = await redisClient.info('memory');
        const dbSize = await redisClient.dbsize();
        
        // Parse memory info
        const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
        const peakMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);
        
        // Count keys by type
        const productKeys = await redisClient.keys(CACHE_CONFIG.keyPrefix + 'product:*');
        const chartKeys = await redisClient.keys(CACHE_CONFIG.keyPrefix + 'chart:*');
        const searchKeys = await redisClient.keys(CACHE_CONFIG.keyPrefix + 'search:*');
        
        return {
            enabled: true,
            connected: true,
            host: CACHE_CONFIG.host,
            port: CACHE_CONFIG.port,
            db: CACHE_CONFIG.db,
            keyPrefix: CACHE_CONFIG.keyPrefix,
            totalKeys: dbSize,
            memoryUsed: memoryMatch ? memoryMatch[1].trim() : 'unknown',
            memoryPeak: peakMatch ? peakMatch[1].trim() : 'unknown',
            keysByType: {
                products: productKeys.length,
                charts: chartKeys.length,
                search: searchKeys.length,
            },
            ttl: CACHE_CONFIG.ttl,
        };
    } catch (error) {
        logger.warn({ error: error.message }, 'Failed to get cache stats');
        return {
            enabled: true,
            connected: isConnected,
            error: error.message,
        };
    }
}

// ============================================================
// HIGH-LEVEL CACHING FUNCTIONS
// ============================================================

/**
 * Get or set pattern - fetch from cache or execute function and cache result
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - TTL in seconds
 * @returns {Promise<any>} Data from cache or fetch function
 */
export async function getOrSet(key, fetchFn, ttl) {
    // Try cache first
    const cached = await get(key);
    if (cached !== null) {
        return cached;
    }
    
    // Fetch and cache
    const data = await fetchFn();
    await set(key, data, ttl);
    return data;
}

/**
 * Cache product data
 * @param {number} productId - Product ID
 * @param {Object} data - Product data
 */
export async function cacheProduct(productId, data) {
    await set(`${CACHE_KEYS.PRODUCT}${productId}`, data, CACHE_CONFIG.ttl.product);
}

/**
 * Get cached product
 * @param {number} productId - Product ID
 * @returns {Promise<Object|null>} Cached product or null
 */
export async function getCachedProduct(productId) {
    return get(`${CACHE_KEYS.PRODUCT}${productId}`);
}

/**
 * Invalidate product cache
 * @param {number} productId - Product ID
 */
export async function invalidateProduct(productId) {
    await del(`${CACHE_KEYS.PRODUCT}${productId}`);
    await del(`${CACHE_KEYS.PRODUCT_HISTORY}${productId}:*`);
    await delByPattern(`${CACHE_KEYS.CHART_DATA}${productId}:*`);
}

/**
 * Invalidate all product caches
 */
export async function invalidateAllProducts() {
    await delByPattern(`${CACHE_KEYS.PRODUCT}*`);
    await del(CACHE_KEYS.PRODUCT_LIST);
}

/**
 * Cache price history
 * @param {number} productId - Product ID
 * @param {string} range - Time range
 * @param {Object} data - History data
 */
export async function cachePriceHistory(productId, range, data) {
    await set(
        `${CACHE_KEYS.PRODUCT_HISTORY}${productId}:${range}`,
        data,
        CACHE_CONFIG.ttl.priceHistory
    );
}

/**
 * Get cached price history
 * @param {number} productId - Product ID
 * @param {string} range - Time range
 * @returns {Promise<Object|null>} Cached history or null
 */
export async function getCachedPriceHistory(productId, range) {
    return get(`${CACHE_KEYS.PRODUCT_HISTORY}${productId}:${range}`);
}

/**
 * Cache chart data
 * @param {number} productId - Product ID
 * @param {string} range - Time range
 * @param {string} type - Chart type (data, daily, info)
 * @param {Object} data - Chart data
 */
export async function cacheChartData(productId, range, type, data) {
    await set(
        `${CACHE_KEYS.CHART_DATA}${productId}:${range}:${type}`,
        data,
        CACHE_CONFIG.ttl.chartData
    );
}

/**
 * Get cached chart data
 * @param {number} productId - Product ID
 * @param {string} range - Time range
 * @param {string} type - Chart type
 * @returns {Promise<Object|null>} Cached chart data or null
 */
export async function getCachedChartData(productId, range, type) {
    return get(`${CACHE_KEYS.CHART_DATA}${productId}:${range}:${type}`);
}

/**
 * Cache search results
 * @param {string} query - Search query
 * @param {Object} data - Search results
 */
export async function cacheSearchResults(query, data) {
    const key = `${CACHE_KEYS.SEARCH_RESULTS}${hashKey(query)}`;
    await set(key, data, CACHE_CONFIG.ttl.searchResults);
}

/**
 * Get cached search results
 * @param {string} query - Search query
 * @returns {Promise<Object|null>} Cached results or null
 */
export async function getCachedSearchResults(query) {
    const key = `${CACHE_KEYS.SEARCH_RESULTS}${hashKey(query)}`;
    return get(key);
}

/**
 * Cache database stats
 * @param {Object} stats - Stats data
 */
export async function cacheStats(stats) {
    await set(CACHE_KEYS.STATS + 'db', stats, CACHE_CONFIG.ttl.stats);
}

/**
 * Get cached stats
 * @returns {Promise<Object|null>} Cached stats or null
 */
export async function getCachedStats() {
    return get(CACHE_KEYS.STATS + 'db');
}

/**
 * Create a simple hash for cache keys
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashKey(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

// ============================================================
// CACHE DECORATORS / MIDDLEWARE
// ============================================================

/**
 * Create a cached version of a function
 * @param {Function} fn - Function to cache
 * @param {Function} keyFn - Function to generate cache key from args
 * @param {number} ttl - TTL in seconds
 * @returns {Function} Cached function
 */
export function withCache(fn, keyFn, ttl) {
    return async (...args) => {
        const key = keyFn(...args);
        return getOrSet(key, () => fn(...args), ttl);
    };
}

/**
 * Express-style middleware for caching API responses
 * @param {string} keyPrefix - Cache key prefix
 * @param {number} ttl - TTL in seconds
 * @returns {Function} Middleware function
 */
export function cacheMiddleware(keyPrefix, ttl) {
    return async (req, res, next) => {
        if (!isCacheAvailable()) {
            return next();
        }
        
        const key = `${keyPrefix}${req.url}`;
        const cached = await get(key);
        
        if (cached) {
            return res.json(cached);
        }
        
        // Store original json method
        const originalJson = res.json.bind(res);
        
        // Override json method to cache response
        res.json = (data) => {
            set(key, data, ttl);
            return originalJson(data);
        };
        
        next();
    };
}

export default {
    // Configuration
    getCacheConfig,
    CACHE_KEYS,
    
    // Connection
    initializeCache,
    closeCache,
    isCacheAvailable,
    
    // Basic operations
    get,
    set,
    del,
    delByPattern,
    flushAll,
    getStats,
    
    // High-level operations
    getOrSet,
    cacheProduct,
    getCachedProduct,
    invalidateProduct,
    invalidateAllProducts,
    cachePriceHistory,
    getCachedPriceHistory,
    cacheChartData,
    getCachedChartData,
    cacheSearchResults,
    getCachedSearchResults,
    cacheStats,
    getCachedStats,
    
    // Utilities
    withCache,
    cacheMiddleware,
};

import client from 'prom-client';
import logger from '../utils/logger.js';

/**
 * Prometheus Metrics for E-Commerce Price Tracker
 * Provides comprehensive monitoring metrics for scraping operations,
 * database performance, browser pool, and system health.
 */

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// ============================================
// SCRAPING METRICS
// ============================================

/** Total number of scrape attempts */
export const scrapeAttemptsTotal = new client.Counter({
    name: 'price_tracker_scrape_attempts_total',
    help: 'Total number of scrape attempts',
    labelNames: ['site', 'status'],
    registers: [register]
});

/** Scrape duration in seconds */
export const scrapeDuration = new client.Histogram({
    name: 'price_tracker_scrape_duration_seconds',
    help: 'Duration of scrape operations in seconds',
    labelNames: ['site'],
    buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
    registers: [register]
});

/** Number of products scraped */
export const productsScraped = new client.Counter({
    name: 'price_tracker_products_scraped_total',
    help: 'Total number of products successfully scraped',
    labelNames: ['site'],
    registers: [register]
});

/** Price changes detected */
export const priceChangesDetected = new client.Counter({
    name: 'price_tracker_price_changes_total',
    help: 'Total number of price changes detected',
    labelNames: ['site', 'direction'], // direction: up, down
    registers: [register]
});

/** Current product prices (gauge) */
export const currentPrice = new client.Gauge({
    name: 'price_tracker_current_price',
    help: 'Current price of tracked products',
    labelNames: ['product_id', 'site'],
    registers: [register]
});

// ============================================
// ERROR METRICS
// ============================================

/** Total errors by type */
export const errorsTotal = new client.Counter({
    name: 'price_tracker_errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'site'], // type: scrape, database, proxy, browser
    registers: [register]
});

/** Retry attempts */
export const retryAttempts = new client.Counter({
    name: 'price_tracker_retry_attempts_total',
    help: 'Total number of retry attempts',
    labelNames: ['operation', 'site'],
    registers: [register]
});

// ============================================
// PROXY METRICS
// ============================================

/** Total proxies in pool */
export const proxyPoolSize = new client.Gauge({
    name: 'price_tracker_proxy_pool_size',
    help: 'Number of proxies in the pool',
    labelNames: ['status'], // status: working, failed
    registers: [register]
});

/** Proxy requests */
export const proxyRequests = new client.Counter({
    name: 'price_tracker_proxy_requests_total',
    help: 'Total proxy requests',
    labelNames: ['status'], // status: success, failure
    registers: [register]
});

/** Proxy latency */
export const proxyLatency = new client.Histogram({
    name: 'price_tracker_proxy_latency_seconds',
    help: 'Proxy response latency in seconds',
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [register]
});

// ============================================
// BROWSER POOL METRICS
// ============================================

/** Browser pool size */
export const browserPoolSize = new client.Gauge({
    name: 'price_tracker_browser_pool_size',
    help: 'Total browsers in pool',
    registers: [register]
});

/** Browsers in use */
export const browserPoolInUse = new client.Gauge({
    name: 'price_tracker_browser_pool_in_use',
    help: 'Browsers currently in use',
    registers: [register]
});

/** Browser acquire wait time */
export const browserAcquireWait = new client.Histogram({
    name: 'price_tracker_browser_acquire_wait_seconds',
    help: 'Time spent waiting to acquire a browser',
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register]
});

// ============================================
// DATABASE METRICS
// ============================================

/** Database query duration */
export const dbQueryDuration = new client.Histogram({
    name: 'price_tracker_db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation'], // operation: select, insert, update
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    registers: [register]
});

/** Database connection pool stats */
export const dbPoolConnections = new client.Gauge({
    name: 'price_tracker_db_pool_connections',
    help: 'Database connection pool stats',
    labelNames: ['state'], // state: total, idle, waiting
    registers: [register]
});

/** Database errors */
export const dbErrors = new client.Counter({
    name: 'price_tracker_db_errors_total',
    help: 'Total database errors',
    labelNames: ['operation'],
    registers: [register]
});

// ============================================
// RATE LIMITER METRICS
// ============================================

/** Rate limiter delays */
export const rateLimiterDelay = new client.Histogram({
    name: 'price_tracker_rate_limiter_delay_seconds',
    help: 'Rate limiter delay applied in seconds',
    labelNames: ['site'],
    buckets: [0.5, 1, 2, 3, 5, 10, 15, 30],
    registers: [register]
});

/** Rate limit hits */
export const rateLimitHits = new client.Counter({
    name: 'price_tracker_rate_limit_hits_total',
    help: 'Number of times rate limit was hit',
    labelNames: ['site'],
    registers: [register]
});

// ============================================
// APPLICATION METRICS
// ============================================

/** Application info */
export const appInfo = new client.Gauge({
    name: 'price_tracker_app_info',
    help: 'Application information',
    labelNames: ['version', 'node_version'],
    registers: [register]
});

// Set app info on startup
appInfo.labels(
    process.env.npm_package_version || '1.0.0',
    process.version
).set(1);

/** Last successful run timestamp */
export const lastSuccessfulRun = new client.Gauge({
    name: 'price_tracker_last_successful_run_timestamp',
    help: 'Timestamp of last successful monitoring run',
    registers: [register]
});

/** Monitoring cycle duration */
export const monitoringCycleDuration = new client.Histogram({
    name: 'price_tracker_monitoring_cycle_duration_seconds',
    help: 'Duration of complete monitoring cycle',
    buckets: [10, 30, 60, 120, 300, 600, 900, 1800],
    registers: [register]
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Record a scrape attempt
 */
export function recordScrape(site, success, durationSeconds) {
    scrapeAttemptsTotal.labels(site, success ? 'success' : 'failure').inc();
    scrapeDuration.labels(site).observe(durationSeconds);
    
    if (success) {
        productsScraped.labels(site).inc();
    } else {
        errorsTotal.labels('scrape', site).inc();
    }
}

/**
 * Record a price change
 */
export function recordPriceChange(site, oldPrice, newPrice) {
    const direction = newPrice > oldPrice ? 'up' : 'down';
    priceChangesDetected.labels(site, direction).inc();
}

/**
 * Update proxy pool metrics
 */
export function updateProxyMetrics(workingCount, failedCount = 0) {
    proxyPoolSize.labels('working').set(workingCount);
    proxyPoolSize.labels('failed').set(failedCount);
}

/**
 * Update browser pool metrics
 */
export function updateBrowserPoolMetrics(total, inUse) {
    browserPoolSize.set(total);
    browserPoolInUse.set(inUse);
}

/**
 * Update database pool metrics
 */
export function updateDbPoolMetrics(total, idle, waiting) {
    dbPoolConnections.labels('total').set(total);
    dbPoolConnections.labels('idle').set(idle);
    dbPoolConnections.labels('waiting').set(waiting);
}

/**
 * Record a database query
 */
export function recordDbQuery(operation, durationSeconds, error = false) {
    dbQueryDuration.labels(operation).observe(durationSeconds);
    if (error) {
        dbErrors.labels(operation).inc();
    }
}

/**
 * Record rate limiter activity
 */
export function recordRateLimitDelay(site, delaySeconds) {
    rateLimiterDelay.labels(site).observe(delaySeconds);
}

/**
 * Record rate limit being hit
 */
export function recordRateLimitHit(site) {
    rateLimitHits.labels(site).inc();
}

/**
 * Get all metrics in Prometheus format
 */
export async function getMetrics() {
    return await register.metrics();
}

/**
 * Get metrics content type
 */
export function getMetricsContentType() {
    return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
    register.resetMetrics();
    logger.info('Metrics reset');
}

export default {
    register,
    // Scraping
    scrapeAttemptsTotal,
    scrapeDuration,
    productsScraped,
    priceChangesDetected,
    currentPrice,
    // Errors
    errorsTotal,
    retryAttempts,
    // Proxy
    proxyPoolSize,
    proxyRequests,
    proxyLatency,
    // Browser
    browserPoolSize,
    browserPoolInUse,
    browserAcquireWait,
    // Database
    dbQueryDuration,
    dbPoolConnections,
    dbErrors,
    // Rate limiter
    rateLimiterDelay,
    rateLimitHits,
    // Application
    appInfo,
    lastSuccessfulRun,
    monitoringCycleDuration,
    // Helpers
    recordScrape,
    recordPriceChange,
    updateProxyMetrics,
    updateBrowserPoolMetrics,
    updateDbPoolMetrics,
    recordDbQuery,
    recordRateLimitDelay,
    recordRateLimitHit,
    getMetrics,
    getMetricsContentType,
    resetMetrics
};

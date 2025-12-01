import http from 'http';
import logger from '../utils/logger.js';
import { checkDatabaseHealth, getPoolStats } from '../db/connect-pg.js';
import { browserPool } from '../utils/BrowserPool.js';
import { getProxyStats } from '../utils/proxy-manager.js';
import { rateLimiter } from '../utils/rate-limiter.js';
import { getMetrics, getMetricsContentType, updateBrowserPoolMetrics, updateDbPoolMetrics, updateProxyMetrics } from '../utils/metrics.js';

/**
 * Lightweight HTTP server for health checks
 * Provides /health, /ready, /live, and /metrics endpoints for monitoring
 */

const DEFAULT_PORT = process.env.HEALTH_PORT || 3000;

let server = null;
let startTime = null;

// Application state tracking
const appState = {
    isReady: false,
    lastMonitorRun: null,
    lastMonitorSuccess: false,
    totalScrapesAttempted: 0,
    totalScrapesSuccessful: 0,
    errors: []
};

/**
 * Update application state
 */
export function updateAppState(updates) {
    Object.assign(appState, updates);
}

/**
 * Record a scrape attempt
 */
export function recordScrapeAttempt(success) {
    appState.totalScrapesAttempted++;
    if (success) {
        appState.totalScrapesSuccessful++;
    }
    appState.lastMonitorRun = new Date().toISOString();
    appState.lastMonitorSuccess = success;
}

/**
 * Record an error
 */
export function recordError(error) {
    appState.errors.push({
        timestamp: new Date().toISOString(),
        message: error.message || String(error),
        stack: error.stack
    });
    // Keep only last 10 errors
    if (appState.errors.length > 10) {
        appState.errors.shift();
    }
}

/**
 * Get comprehensive health status
 */
async function getHealthStatus() {
    const checks = {
        database: { status: 'unknown', details: null },
        browserPool: { status: 'unknown', details: null },
        proxy: { status: 'unknown', details: null },
        rateLimiter: { status: 'unknown', details: null }
    };

    // Check database
    try {
        const dbHealth = await checkDatabaseHealth();
        const poolStats = getPoolStats();
        checks.database = {
            status: dbHealth.healthy ? 'healthy' : 'unhealthy',
            details: {
                connected: dbHealth.healthy,
                timestamp: dbHealth.timestamp,
                pool: poolStats
            }
        };
    } catch (error) {
        checks.database = {
            status: 'unhealthy',
            details: { error: error.message }
        };
    }

    // Check browser pool
    try {
        const poolStats = browserPool.getStats();
        const isHealthy = (poolStats.totalBrowsers || poolStats.size || 0) > 0;
        checks.browserPool = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            details: poolStats
        };
    } catch (error) {
        checks.browserPool = {
            status: 'unhealthy',
            details: { error: error.message }
        };
    }

    // Check proxy manager
    try {
        const proxyStats = getProxyStats();
        const hasProxies = proxyStats.total > 0;
        checks.proxy = {
            status: hasProxies ? 'healthy' : 'degraded',
            details: proxyStats
        };
    } catch (error) {
        checks.proxy = {
            status: 'degraded',
            details: { error: error.message }
        };
    }

    // Check rate limiter
    try {
        const rlStats = rateLimiter.getStats();
        checks.rateLimiter = {
            status: 'healthy',
            details: rlStats
        };
    } catch (error) {
        checks.rateLimiter = {
            status: 'degraded',
            details: { error: error.message }
        };
    }

    // Determine overall health
    const criticalChecks = [checks.database, checks.browserPool];
    const allHealthy = criticalChecks.every(c => c.status === 'healthy');
    const anyUnhealthy = criticalChecks.some(c => c.status === 'unhealthy');

    return {
        status: anyUnhealthy ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded'),
        timestamp: new Date().toISOString(),
        uptime: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
        version: process.env.npm_package_version || '1.0.0',
        checks,
        application: {
            ready: appState.isReady,
            lastMonitorRun: appState.lastMonitorRun,
            lastMonitorSuccess: appState.lastMonitorSuccess,
            scrapeStats: {
                attempted: appState.totalScrapesAttempted,
                successful: appState.totalScrapesSuccessful,
                successRate: appState.totalScrapesAttempted > 0
                    ? Math.round((appState.totalScrapesSuccessful / appState.totalScrapesAttempted) * 100)
                    : 0
            },
            recentErrors: appState.errors.length
        }
    };
}

/**
 * Handle HTTP requests
 */
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
        switch (path) {
            case '/health':
            case '/healthz': {
                // Full health check with all component status
                const health = await getHealthStatus();
                const statusCode = health.status === 'healthy' ? 200 : 
                                   health.status === 'degraded' ? 200 : 503;
                res.writeHead(statusCode);
                res.end(JSON.stringify(health, null, 2));
                break;
            }

            case '/ready':
            case '/readiness': {
                // Readiness probe - is the app ready to accept work?
                const dbHealth = await checkDatabaseHealth();
                const poolStats = browserPool.getStats();
                const hasBrowsers = (poolStats.totalBrowsers || poolStats.size || 0) > 0;
                
                const ready = dbHealth.healthy && hasBrowsers && appState.isReady;
                
                res.writeHead(ready ? 200 : 503);
                res.end(JSON.stringify({
                    ready,
                    timestamp: new Date().toISOString(),
                    checks: {
                        database: dbHealth.healthy,
                        browserPool: hasBrowsers,
                        appInitialized: appState.isReady
                    }
                }, null, 2));
                break;
            }

            case '/live':
            case '/liveness': {
                // Liveness probe - is the process alive?
                // Simple check, just confirms the process is running
                res.writeHead(200);
                res.end(JSON.stringify({
                    alive: true,
                    timestamp: new Date().toISOString(),
                    uptime: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
                    pid: process.pid,
                    memory: {
                        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
                    }
                }, null, 2));
                break;
            }

            case '/metrics': {
                // Prometheus metrics endpoint
                try {
                    // Update current metrics before returning
                    const poolStats = browserPool.getStats();
                    updateBrowserPoolMetrics(
                        poolStats.totalBrowsers || poolStats.size || 0,
                        poolStats.currentInUse || 0
                    );
                    
                    const dbStats = getPoolStats();
                    updateDbPoolMetrics(
                        dbStats.totalCount || 0,
                        dbStats.idleCount || 0,
                        dbStats.waitingCount || 0
                    );
                    
                    const proxyStats = getProxyStats();
                    updateProxyMetrics(proxyStats.total || 0, 0);
                    
                    const metrics = await getMetrics();
                    res.setHeader('Content-Type', getMetricsContentType());
                    res.writeHead(200);
                    res.end(metrics);
                } catch (error) {
                    logger.error({ error }, 'Error generating metrics');
                    res.writeHead(500);
                    res.end('Error generating metrics');
                }
                break;
            }

            case '/metrics/json': {
                // JSON metrics endpoint (legacy format)
                const health = await getHealthStatus();
                res.writeHead(200);
                res.end(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    uptime: health.uptime,
                    scrapes: health.application.scrapeStats,
                    database: health.checks.database.details,
                    browserPool: health.checks.browserPool.details,
                    proxy: health.checks.proxy.details,
                    rateLimiter: health.checks.rateLimiter.details,
                    errors: appState.errors
                }, null, 2));
                break;
            }

            case '/': {
                // Root endpoint - basic info
                res.writeHead(200);
                res.end(JSON.stringify({
                    name: 'E-Commerce Price Tracker',
                    version: process.env.npm_package_version || '1.0.0',
                    endpoints: [
                        { path: '/health', description: 'Full health check' },
                        { path: '/ready', description: 'Readiness probe' },
                        { path: '/live', description: 'Liveness probe' },
                        { path: '/metrics', description: 'Prometheus metrics' },
                        { path: '/metrics/json', description: 'JSON metrics' }
                    ]
                }, null, 2));
                break;
            }

            default:
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not Found', path }));
        }
    } catch (error) {
        logger.error({ error, path }, 'Health server error');
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
    }
}

/**
 * Start the health check server
 */
export async function startHealthServer(port = DEFAULT_PORT) {
    return new Promise((resolve, reject) => {
        server = http.createServer(handleRequest);

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.warn({ port }, 'Health server port in use, trying next port');
                startHealthServer(port + 1).then(resolve).catch(reject);
            } else {
                reject(error);
            }
        });

        server.listen(port, () => {
            startTime = Date.now();
            logger.info({ port }, 'Health check server started');
            logger.info({ 
                endpoints: ['/health', '/ready', '/live', '/metrics'] 
            }, 'Available health endpoints');
            resolve(port);
        });
    });
}

/**
 * Stop the health check server
 */
export async function stopHealthServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                logger.info('Health check server stopped');
                server = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

export default {
    startHealthServer,
    stopHealthServer,
    updateAppState,
    recordScrapeAttempt,
    recordError
};

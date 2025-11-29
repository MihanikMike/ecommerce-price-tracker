import logger from './utils/logger.js';
import config from './config/index.js';
import { pool, runMigrations, closeDatabaseConnection, checkDatabaseHealth } from './db/connect-pg.js';
import { browserPool } from './utils/BrowserPool.js';
import { runPriceMonitor } from './monitor/price-monitor.js';
import { testDatabaseConnection } from './utils/db-retry.js';
import { startHealthServer, stopHealthServer, updateAppState } from './server/health-server.js';

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
        // Stop health server first
        await stopHealthServer();
        logger.info('Health server stopped');

        // Close browser pool
        await browserPool.closeAll();
        logger.info('Browser pool closed');

        // Close database connections
        await closeDatabaseConnection();
        logger.info('Database connections closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
    }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection');
    process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught Exception');
    process.exit(1);
});

// Main application
async function main() {
    try {
        logger.info('Starting E-Commerce Price Tracker...');
        logger.info({ 
            nodeEnv: config.nodeEnv,
            pgHost: config.pg.host,
            pgDatabase: config.pg.database 
        }, 'Configuration loaded');

        // Test database connection with retries
        logger.info('Testing database connection...');
        const connected = await testDatabaseConnection(pool, {
            maxRetries: 5,
            initialDelayMs: 2000,
            maxDelayMs: 10000
        });
        
        if (!connected) {
            logger.error('Failed to connect to database after retries');
            process.exit(1);
        }
        
        // Check database health
        const health = await checkDatabaseHealth();
        if (!health.healthy) {
            logger.error({ health }, 'Database health check failed');
            process.exit(1);
        }
        
        logger.info({ timestamp: health.timestamp }, 'Database connection healthy');

        // Run migrations
        logger.info('Running database migrations...');
        await runMigrations();
        logger.info('Migrations completed');

        // Initialize browser pool
        logger.info('Initializing browser pool...');
        await browserPool.initialize();
        logger.info('Browser pool initialized');

        // Start health check server
        const healthPort = await startHealthServer(process.env.HEALTH_PORT || 3000);
        logger.info({ port: healthPort }, 'Health check server ready');

        // Mark application as ready
        updateAppState({ isReady: true });

        // Start monitoring
        logger.info('Starting price monitoring...');
        await runPriceMonitor();
        logger.info('Price monitoring completed');

        // Close connections
        await browserPool.closeAll();
        logger.info('Browser pool closed');
        
        await closeDatabaseConnection();
        logger.info('Application finished successfully');
        process.exit(0);

    } catch (error) {
        logger.error({ error }, 'Application error');
        await browserPool.closeAll();
        await closeDatabaseConnection();
        process.exit(1);
    }
}

// Start the application
main();

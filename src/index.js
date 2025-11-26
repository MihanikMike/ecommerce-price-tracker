import logger from './utils/logger.js';
import config from './config/index.js';
import { pool, runMigrations, closeDatabaseConnection } from './db/connect-pg.js';
import { runPriceMonitor } from './monitor/price-monitor.js';

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
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

        // Test database connection
        logger.info('Testing database connection...');
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger.info('Database connection successful');

        // Run migrations
        logger.info('Running database migrations...');
        await runMigrations();
        logger.info('Migrations completed');

        // Start monitoring
        logger.info('Starting price monitoring...');
        await runPriceMonitor();
        logger.info('Price monitoring completed');

        // Close connections
        await closeDatabaseConnection();
        logger.info('Application finished successfully');
        process.exit(0);

    } catch (error) {
        logger.error({ error }, 'Application error');
        await closeDatabaseConnection();
        process.exit(1);
    }
}

// Start the application
main();

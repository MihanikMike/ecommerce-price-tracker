import logger from './utils/logger.js';
import config, { validateConfigOrExit } from './config/index.js';
import { pool, runMigrations, closeDatabaseConnection, checkDatabaseHealth } from './db/connect-pg.js';
import { testDatabaseConnection } from './utils/db-retry.js';
import { startHealthServer, stopHealthServer, updateAppState } from './server/health-server.js';
import { startApiServer, stopApiServer } from './server/api-server.js';

// Validate configuration before starting
validateConfigOrExit();

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
        // Stop API server first
        await stopApiServer();
        logger.info('API server stopped');

        // Stop health server
        await stopHealthServer();
        logger.info('Health server stopped');

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

        // NOTE: Browser pool is NOT initialized here
        // Browsers are only started when running `npm run monitor`
        // This keeps the API server lightweight (~50MB vs ~500MB)

        // Start health check server
        const healthPort = await startHealthServer(process.env.HEALTH_PORT || 3000);
        logger.info({ port: healthPort }, 'Health check server ready');

        // Start API server
        const apiPort = await startApiServer(process.env.API_PORT || 3001);
        logger.info({ port: apiPort }, 'API server ready');

        // Mark application as ready
        updateAppState({ isReady: true });

        logger.info(`
╔════════════════════════════════════════════════════════════╗
║         E-Commerce Price Tracker API Server                ║
╠════════════════════════════════════════════════════════════╣
║  API:     http://localhost:${apiPort.toString().padEnd(5)}/api                       ║
║  Health:  http://localhost:${healthPort.toString().padEnd(5)}/health                    ║
╠════════════════════════════════════════════════════════════╣
║  To scrape prices, run: npm run monitor                    ║
║  Press Ctrl+C to stop the server                           ║
╚════════════════════════════════════════════════════════════╝
`);

        // Keep server running - don't exit
        // The API server will handle requests until Ctrl+C

    } catch (error) {
        logger.error({ error }, 'Application error');
        await closeDatabaseConnection();
        process.exit(1);
    }
}

// Start the application
main();

#!/usr/bin/env node

/**
 * API Server CLI
 * Run the API server standalone (without price monitoring)
 * 
 * Usage:
 *   node src/cli/api.js              # Start API server
 *   node src/cli/api.js --port=3001  # Start on specific port
 *   npm run api                      # Using npm script
 */

import logger from '../utils/logger.js';
import config, { validateConfigOrExit } from '../config/index.js';
import { pool, runMigrations, closeDatabaseConnection, checkDatabaseHealth } from '../db/connect-pg.js';
import { browserPool } from '../utils/BrowserPool.js';
import { testDatabaseConnection } from '../utils/db-retry.js';
import { startApiServer, stopApiServer } from '../server/api-server.js';
import { startHealthServer, stopHealthServer, updateAppState } from '../server/health-server.js';

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : null;
};

const port = parseInt(getArg('port'), 10) || parseInt(process.env.API_PORT, 10) || 3001;
const healthPort = parseInt(getArg('health-port'), 10) || parseInt(process.env.HEALTH_PORT, 10) || 3000;

// Help
if (args.includes('--help') || args.includes('-h') || args.includes('help')) {
    console.log(`
API Server - E-Commerce Price Tracker

Usage:
  node src/cli/api.js [options]

Options:
  --port=PORT         API server port (default: 3001, env: API_PORT)
  --health-port=PORT  Health server port (default: 3000, env: HEALTH_PORT)
  --help, -h          Show this help message

Environment Variables:
  API_PORT            API server port
  HEALTH_PORT         Health server port
  PG_*                PostgreSQL connection settings

Examples:
  # Start API server on default ports
  node src/cli/api.js

  # Start on custom port
  node src/cli/api.js --port=8080

  # Using npm script
  npm run api

API Endpoints:
  GET    /api/products              List all products
  GET    /api/products/:id          Get single product
  GET    /api/products/:id/history  Get price history
  DELETE /api/products/:id          Delete a product

  GET    /api/tracked               List tracked products
  GET    /api/tracked/:id           Get single tracked product
  POST   /api/tracked               Add new tracked product
  PATCH  /api/tracked/:id           Update tracked product
  DELETE /api/tracked/:id           Delete tracked product
  POST   /api/tracked/:id/enable    Enable tracking
  POST   /api/tracked/:id/disable   Disable tracking

  GET    /api/price-changes         Get recent price changes
  GET    /api/price-changes/drops   Get biggest price drops

  GET    /api/stats                 Get database statistics
  GET    /api/stats/config          Get current configuration

  POST   /api/search                Search for products
`);
    process.exit(0);
}

// Validate configuration
validateConfigOrExit();

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down API server...`);

    try {
        await stopApiServer();
        await stopHealthServer();
        await browserPool.closeAll();
        await closeDatabaseConnection();
        logger.info('API server shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
    }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Main
async function main() {
    try {
        logger.info('Starting API server...');

        // Test database connection
        const connected = await testDatabaseConnection(pool, {
            maxRetries: 5,
            initialDelayMs: 2000,
            maxDelayMs: 10000
        });

        if (!connected) {
            logger.error('Failed to connect to database');
            process.exit(1);
        }

        // Check database health
        const health = await checkDatabaseHealth();
        if (!health.healthy) {
            logger.error({ health }, 'Database health check failed');
            process.exit(1);
        }

        logger.info('Database connection healthy');

        // Run migrations
        await runMigrations();
        logger.info('Migrations completed');

        // Initialize browser pool (needed for search endpoint)
        await browserPool.initialize();
        logger.info('Browser pool initialized');

        // Start health server
        const actualHealthPort = await startHealthServer(healthPort);
        logger.info({ port: actualHealthPort }, 'Health server started');

        // Start API server
        const actualApiPort = await startApiServer(port);

        // Mark as ready
        updateAppState({ isReady: true });

        console.log(`
╔════════════════════════════════════════════════════════════╗
║         E-Commerce Price Tracker API Server                ║
╠════════════════════════════════════════════════════════════╣
║  API:     http://localhost:${actualApiPort.toString().padEnd(5)}/api                       ║
║  Health:  http://localhost:${actualHealthPort.toString().padEnd(5)}/health                    ║
║  Metrics: http://localhost:${actualHealthPort.toString().padEnd(5)}/metrics                   ║
╠════════════════════════════════════════════════════════════╣
║  Press Ctrl+C to stop the server                           ║
╚════════════════════════════════════════════════════════════╝
`);

    } catch (error) {
        logger.error({ error }, 'Failed to start API server');
        process.exit(1);
    }
}

main();

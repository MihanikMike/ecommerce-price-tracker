import logger from '../utils/logger.js';
import { runMigrations, closeDatabaseConnection } from '../db/connect-pg.js';

async function main() {
    try {
        logger.info('Starting database migrations...');
        await runMigrations();
        logger.info('✅ Migrations completed successfully');
        await closeDatabaseConnection();
        process.exit(0);
    } catch (error) {
        logger.error({ error }, '❌ Migration failed');
        await closeDatabaseConnection();
        process.exit(1);
    }
}

main();
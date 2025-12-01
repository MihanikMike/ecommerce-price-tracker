import pkg from "pg";
const { Pool } = pkg;
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create connection pool with proper configuration
export const pool = new Pool({
    host: config.pg.host,
    port: config.pg.port,
    database: config.pg.database,
    user: config.pg.user,
    password: config.pg.password,
    max: config.pg.max || 20,
    idleTimeoutMillis: config.pg.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.pg.connectionTimeoutMillis || 10000,
});

// Pool error handler
pool.on('error', (err) => {
    logger.error({ error: err }, 'Unexpected error on idle PostgreSQL client');
});

// Pool connect event
pool.on('connect', () => {
    logger.debug('New PostgreSQL client connected');
});

// Pool remove event
pool.on('remove', () => {
    logger.debug('PostgreSQL client removed from pool');
});

// Health check function
export async function checkDatabaseHealth() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        return { healthy: true, timestamp: result.rows[0].now };
    } catch (error) {
        logger.error({ error }, 'Database health check failed');
        return { healthy: false, error: error.message };
    }
}

// Get connection pool statistics
export function getPoolStats() {
    return {
        totalCount: pool.totalCount,      // Total number of clients in pool
        idleCount: pool.idleCount,        // Number of idle clients
        waitingCount: pool.waitingCount,  // Number of queued requests waiting for a client
        maxConnections: config.pg.max,    // Maximum pool size
        utilizationPercent: pool.totalCount > 0 
            ? Math.round(((pool.totalCount - pool.idleCount) / pool.totalCount) * 100)
            : 0
    };
}

// Migration runner with tracking
export async function runMigrations() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        
        // Get executed migrations
        const { rows: executedMigrations } = await client.query(
            'SELECT version FROM schema_migrations ORDER BY version'
        );
        const executedVersions = new Set(executedMigrations.map(m => m.version));
        
        // Load migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const migrationFiles = [
            '001_init.sql',
            '002_add_indexes.sql',
            '003_tracked_products.sql'
        ];
        
        // Execute pending migrations
        for (const file of migrationFiles) {
            const version = file.replace('.sql', '');
            
            if (executedVersions.has(version)) {
                logger.info({ version }, 'Migration already executed, skipping');
                continue;
            }
            
            logger.info({ version }, 'Running migration');
            const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            
            // Record migration
            await client.query(
                'INSERT INTO schema_migrations (version) VALUES ($1)',
                [version]
            );
            
            logger.info({ version }, 'Migration completed');
        }
        
        await client.query('COMMIT');
        logger.info('All migrations completed successfully');
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error }, 'Migration failed, rolling back');
        throw error;
    } finally {
        client.release();
    }
}

// Graceful shutdown
export async function closeDatabaseConnection() {
    try {
        await pool.end();
        logger.info('Database connection pool closed');
    } catch (error) {
        logger.error({ error }, 'Error closing database connection pool');
        throw error;
    }
}
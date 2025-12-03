import pkg from "pg";
const { Pool } = pkg;
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Slow query threshold (ms)
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS, 10) || 100;

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

/**
 * Wrapper for pool.query that logs slow queries
 */
export async function queryWithTiming(text, params) {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (duration > SLOW_QUERY_THRESHOLD) {
            logger.warn({
                query: text.substring(0, 200),
                duration,
                threshold: SLOW_QUERY_THRESHOLD,
                rows: result.rowCount
            }, 'Slow query detected');
        }
        
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error({
            query: text.substring(0, 200),
            duration,
            error: error.message
        }, 'Query failed');
        throw error;
    }
}

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
        
        // Create migrations tracking table with checksum for verification
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                checksum VARCHAR(64),
                execution_time_ms INTEGER
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
            const startTime = Date.now();
            const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            const executionTime = Date.now() - startTime;
            
            // Simple checksum for verification
            const checksum = Buffer.from(sql).toString('base64').substring(0, 64);
            
            // Record migration
            await client.query(
                'INSERT INTO schema_migrations (version, checksum, execution_time_ms) VALUES ($1, $2, $3)',
                [version, checksum, executionTime]
            );
            
            logger.info({ version, executionTime }, 'Migration completed');
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

/**
 * Rollback a specific migration by version
 * @param {string} targetVersion - The migration version to rollback (e.g., '003_tracked_products')
 */
export async function rollbackMigration(targetVersion) {
    const client = await pool.connect();
    
    try {
        // Check if migration exists in schema_migrations
        const { rows } = await client.query(
            'SELECT version FROM schema_migrations WHERE version = $1',
            [targetVersion]
        );
        
        if (rows.length === 0) {
            throw new Error(`Migration ${targetVersion} has not been executed`);
        }
        
        // Look for rollback file
        const migrationsDir = path.join(__dirname, 'migrations');
        const rollbackFile = path.join(migrationsDir, `${targetVersion}.down.sql`);
        
        let rollbackSql;
        try {
            rollbackSql = readFileSync(rollbackFile, 'utf8');
        } catch (err) {
            throw new Error(`Rollback file not found: ${targetVersion}.down.sql. Create it first.`);
        }
        
        await client.query('BEGIN');
        
        logger.warn({ version: targetVersion }, 'Rolling back migration');
        const startTime = Date.now();
        await client.query(rollbackSql);
        const executionTime = Date.now() - startTime;
        
        // Remove from schema_migrations
        await client.query(
            'DELETE FROM schema_migrations WHERE version = $1',
            [targetVersion]
        );
        
        await client.query('COMMIT');
        logger.info({ version: targetVersion, executionTime }, 'Migration rolled back successfully');
        
        return { version: targetVersion, executionTime };
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error, version: targetVersion }, 'Rollback failed');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get migration status
 * @returns {Promise<Array>} List of migrations with their status
 */
export async function getMigrationStatus() {
    const client = await pool.connect();
    
    try {
        const { rows } = await client.query(`
            SELECT version, executed_at, execution_time_ms 
            FROM schema_migrations 
            ORDER BY version
        `);
        
        const migrationsDir = path.join(__dirname, 'migrations');
        const allMigrations = [
            '001_init.sql',
            '002_add_indexes.sql',
            '003_tracked_products.sql',
            '004_search_based_tracking.sql',
            '005_add_current_price.sql'
        ];
        
        return allMigrations.map(file => {
            const version = file.replace('.sql', '');
            const executed = rows.find(r => r.version === version);
            const hasRollback = (() => {
                try {
                    readFileSync(path.join(migrationsDir, `${version}.down.sql`), 'utf8');
                    return true;
                } catch {
                    return false;
                }
            })();
            
            return {
                version,
                executed: !!executed,
                executedAt: executed?.executed_at || null,
                executionTimeMs: executed?.execution_time_ms || null,
                hasRollback
            };
        });
        
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
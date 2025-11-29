#!/usr/bin/env node
import { pool, checkDatabaseHealth, getPoolStats, closeDatabaseConnection } from '../db/connect-pg.js';
import logger from '../utils/logger.js';

async function checkDatabase() {
    try {
        console.log('\n🔍 DATABASE STATUS CHECK\n');
        
        // Health check
        console.log('=== Health Check ===');
        const health = await checkDatabaseHealth();
        if (health.healthy) {
            console.log('✅ Status: HEALTHY');
            console.log(`📅 Timestamp: ${health.timestamp}`);
        } else {
            console.log('❌ Status: UNHEALTHY');
            console.log(`⚠️  Error: ${health.error}`);
        }
        
        // Pool statistics
        console.log('\n=== Connection Pool Stats ===');
        const stats = getPoolStats();
        console.log(`📊 Total connections: ${stats.totalCount}/${stats.maxConnections}`);
        console.log(`💤 Idle connections: ${stats.idleCount}`);
        console.log(`⏳ Waiting requests: ${stats.waitingCount}`);
        console.log(`📈 Utilization: ${stats.utilizationPercent}%`);
        
        // Database size
        console.log('\n=== Database Size ===');
        const sizeResult = await pool.query(`
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as size,
                current_database() as name
        `);
        console.log(`💾 Database: ${sizeResult.rows[0].name}`);
        console.log(`📦 Size: ${sizeResult.rows[0].size}`);
        
        // Table statistics
        console.log('\n=== Table Statistics ===');
        const tableStats = await pool.query(`
            SELECT 
                schemaname,
                relname as tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as size,
                n_live_tup as row_count
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
        `);
        console.table(tableStats.rows);
        
        // Index usage
        console.log('\n=== Index Usage ===');
        const indexStats = await pool.query(`
            SELECT 
                schemaname,
                relname as tablename,
                indexrelname as indexname,
                idx_scan as scans,
                pg_size_pretty(pg_relation_size(indexrelid)) as size
            FROM pg_stat_user_indexes
            ORDER BY idx_scan DESC
        `);
        console.table(indexStats.rows);
        
        // Active connections
        console.log('\n=== Active Connections ===');
        const connections = await pool.query(`
            SELECT 
                state,
                COUNT(*) as count
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY state
        `);
        console.table(connections.rows);
        
        console.log('\n✅ Database check complete\n');
        
    } catch (error) {
        logger.error({ error }, 'Failed to check database');
        console.error('❌ Error:', error.message);
    } finally {
        await closeDatabaseConnection();
    }
}

checkDatabase();

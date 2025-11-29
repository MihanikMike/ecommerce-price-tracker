#!/usr/bin/env node
import { pool } from '../db/connect-pg.js';
import logger from '../utils/logger.js';

async function viewDatabase() {
    try {
        console.log('\n📊 DATABASE CONTENTS\n');
        
        // Tracked Products
        console.log('=== TRACKED PRODUCTS ===');
        const tracked = await pool.query(`
            SELECT id, site, url, enabled, check_interval_minutes, 
                   last_checked_at, next_check_at
            FROM tracked_products
            ORDER BY id
        `);
        console.table(tracked.rows);
        
        // Products
        console.log('\n=== PRODUCTS ===');
        const products = await pool.query(`
            SELECT id, site, title, last_seen_at, created_at
            FROM products
            ORDER BY id
        `);
        console.table(products.rows);
        
        // Price History
        console.log('\n=== PRICE HISTORY (Last 20) ===');
        const history = await pool.query(`
            SELECT ph.id, p.title, ph.price, ph.currency, ph.captured_at
            FROM price_history ph
            JOIN products p ON ph.product_id = p.id
            ORDER BY ph.captured_at DESC
            LIMIT 20
        `);
        console.table(history.rows);
        
        // Statistics
        console.log('\n=== STATISTICS ===');
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM tracked_products) as tracked_products,
                (SELECT COUNT(*) FROM tracked_products WHERE enabled = true) as enabled_products,
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM price_history) as total_price_records
        `);
        console.table(stats.rows);
        
    } catch (error) {
        logger.error({ error }, 'Failed to view database');
    } finally {
        await pool.end();
    }
}

viewDatabase();

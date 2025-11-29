#!/usr/bin/env node

/**
 * Data Retention CLI
 * Manage database cleanup and view storage statistics
 */

import { pool } from "../db/connect-pg.js";
import {
    runRetentionCleanup,
    cleanupPriceHistory,
    cleanupStaleProducts,
    cleanupSearchResults,
    getDatabaseStats,
    getRetentionPolicy,
} from "../services/retentionService.js";

const commands = {
    async stats() {
        console.log('\n📊 Database Statistics\n');
        console.log('─'.repeat(60));
        
        const stats = await getDatabaseStats();
        
        console.log(`Database Size:        ${stats.database_size}`);
        console.log(`Products Table:       ${stats.products_size}`);
        console.log(`Price History Table:  ${stats.price_history_size}`);
        console.log('');
        console.log(`Products:             ${stats.product_count}`);
        console.log(`Price Records:        ${stats.price_history_count}`);
        console.log(`Tracked Products:     ${stats.tracked_products_count}`);
        console.log(`Daily Samples:        ${stats.daily_samples_count}`);
        console.log('');
        if (stats.oldest_price) {
            console.log(`Oldest Price:         ${new Date(stats.oldest_price).toLocaleDateString()}`);
            console.log(`Newest Price:         ${new Date(stats.newest_price).toLocaleDateString()}`);
        }
        console.log('─'.repeat(60));
    },

    async policy() {
        console.log('\n📋 Current Retention Policy\n');
        console.log('─'.repeat(60));
        
        const policy = getRetentionPolicy();
        
        console.log(`Price History:        ${policy.priceHistoryDays} days`);
        console.log(`Min Records/Product:  ${policy.minPriceRecordsPerProduct}`);
        console.log(`Stale Products:       ${policy.staleProductDays} days`);
        console.log(`Search Results:       ${policy.searchResultDays} days`);
        console.log(`Delete Batch Size:    ${policy.deleteBatchSize}`);
        console.log(`Keep Daily Samples:   ${policy.keepDailySamples ? 'Yes' : 'No'}`);
        console.log('─'.repeat(60));
        console.log('\nTo customize, set environment variables:');
        console.log('  RETENTION_PRICE_HISTORY_DAYS=90');
        console.log('  RETENTION_MIN_RECORDS=10');
        console.log('  RETENTION_STALE_PRODUCT_DAYS=180');
        console.log('  RETENTION_SEARCH_RESULT_DAYS=30');
        console.log('  RETENTION_KEEP_DAILY_SAMPLES=true');
    },

    async cleanup(dryRun = false) {
        const isDryRun = dryRun === '--dry-run' || dryRun === 'true';
        
        if (isDryRun) {
            console.log('\n🔍 DRY RUN - No data will be deleted\n');
            console.log('─'.repeat(60));
            
            // Show what would be deleted
            const policy = getRetentionPolicy();
            
            // Price history
            const priceResult = await pool.query(`
                WITH ranked AS (
                    SELECT id, product_id,
                           ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY captured_at DESC) as rn
                    FROM price_history
                    WHERE captured_at < NOW() - INTERVAL '${policy.priceHistoryDays} days'
                )
                SELECT COUNT(*) as count FROM ranked WHERE rn > $1
            `, [policy.minPriceRecordsPerProduct]);
            console.log(`Price History:    ${priceResult.rows[0].count} records would be deleted`);
            
            // Stale products
            const staleResult = await pool.query(`
                SELECT COUNT(*) as count FROM products
                WHERE last_seen_at < NOW() - INTERVAL '${policy.staleProductDays} days'
            `);
            console.log(`Stale Products:   ${staleResult.rows[0].count} products would be deleted`);
            
            // Search results
            const searchExists = await pool.query(`
                SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'search_results')
            `);
            if (searchExists.rows[0].exists) {
                const searchResult = await pool.query(`
                    SELECT COUNT(*) as count FROM search_results
                    WHERE scraped_at < NOW() - INTERVAL '${policy.searchResultDays} days'
                `);
                console.log(`Search Results:   ${searchResult.rows[0].count} records would be deleted`);
            }
            
            console.log('─'.repeat(60));
            console.log('\nRun without --dry-run to actually delete data.');
            return;
        }
        
        console.log('\n🧹 Running Data Retention Cleanup\n');
        console.log('─'.repeat(60));
        
        const startStats = await getDatabaseStats();
        console.log(`Before: ${startStats.price_history_count} price records, ${startStats.product_count} products`);
        
        const results = await runRetentionCleanup();
        
        const endStats = await getDatabaseStats();
        
        console.log('');
        console.log('Results:');
        console.log(`  Price History:    ${results.priceHistory.deleted} records deleted`);
        console.log(`  Stale Products:   ${results.staleProducts.deleted} products deleted`);
        console.log(`  Search Results:   ${results.searchResults.deleted} records deleted`);
        console.log('');
        console.log(`After: ${endStats.price_history_count} price records, ${endStats.product_count} products`);
        console.log(`Database size: ${endStats.database_size}`);
        console.log('─'.repeat(60));
    },

    async 'cleanup-prices'() {
        console.log('\n🧹 Cleaning up old price history...\n');
        const result = await cleanupPriceHistory();
        console.log(`Deleted ${result.deleted} price history records`);
    },

    async 'cleanup-products'() {
        console.log('\n🧹 Cleaning up stale products...\n');
        const result = await cleanupStaleProducts();
        console.log(`Deleted ${result.deleted} stale products`);
    },

    async 'cleanup-search'() {
        console.log('\n🧹 Cleaning up old search results...\n');
        const result = await cleanupSearchResults();
        console.log(`Deleted ${result.deleted} search result records`);
    },

    help() {
        console.log(`
Data Retention CLI

Usage:
  npm run retention -- <command> [options]

Commands:
  stats                 Show database size and record counts
  policy                Show current retention policy settings
  cleanup [--dry-run]   Run full retention cleanup (use --dry-run to preview)
  cleanup-prices        Clean up old price history only
  cleanup-products      Clean up stale products only
  cleanup-search        Clean up old search results only
  help                  Show this help message

Examples:
  npm run retention -- stats
  npm run retention -- policy
  npm run retention -- cleanup --dry-run
  npm run retention -- cleanup

Environment Variables:
  RETENTION_PRICE_HISTORY_DAYS=90       Keep prices for 90 days
  RETENTION_MIN_RECORDS=10              Keep at least 10 prices per product
  RETENTION_STALE_PRODUCT_DAYS=180      Remove products unseen for 180 days
  RETENTION_SEARCH_RESULT_DAYS=30       Keep search results for 30 days
  RETENTION_KEEP_DAILY_SAMPLES=true     Archive to daily samples before purge
        `);
    }
};

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    // Normalize command name
    const normalizedCommand = command.replace(/^--/, '');

    if (!commands[normalizedCommand]) {
        console.error(`❌ Unknown command: ${command}`);
        commands.help();
        process.exit(1);
    }

    try {
        await commands[normalizedCommand](...args.slice(1));
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

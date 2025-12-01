#!/usr/bin/env node

/**
 * Price Changes CLI
 * View and analyze price changes for tracked products
 */

import { pool } from "../db/connect-pg.js";
import { 
    getRecentPriceChanges, 
    getBiggestPriceDrops, 
    getPriceSummary,
    calculatePriceChange 
} from "../services/priceChangeService.js";

const commands = {
    async recent(hours = 24) {
        console.log(`\n📊 Significant Price Changes (last ${hours} hours)\n`);
        console.log('─'.repeat(80));
        
        const changes = await getRecentPriceChanges(parseInt(hours));
        
        if (changes.length === 0) {
            console.log('No significant price changes detected.');
            return;
        }

        for (const change of changes) {
            const emoji = change.direction === 'down' ? '📉' : '📈';
            const sign = change.direction === 'down' ? '' : '+';
            
            console.log(`${emoji} ${change.title?.substring(0, 50) || 'Unknown'}...`);
            console.log(`   Site: ${change.site || 'unknown'}`);
            console.log(`   Price: $${parseFloat(change.old_price).toFixed(2)} → $${parseFloat(change.new_price).toFixed(2)}`);
            console.log(`   Change: ${sign}$${change.absolute_change} (${sign}${change.percent_change}%)`);
            console.log(`   Time: ${new Date(change.new_captured_at).toLocaleString()}`);
            console.log('─'.repeat(80));
        }

        console.log(`\nTotal: ${changes.length} significant price change(s)`);
    },

    async drops(hours = 24, limit = 10) {
        console.log(`\n💰 Biggest Price Drops (last ${hours} hours)\n`);
        console.log('─'.repeat(80));
        
        const drops = await getBiggestPriceDrops(parseInt(hours), parseInt(limit));
        
        if (drops.length === 0) {
            console.log('No price drops detected.');
            return;
        }

        let rank = 1;
        for (const drop of drops) {
            console.log(`#${rank} 🔥 ${drop.title?.substring(0, 50) || 'Unknown'}...`);
            console.log(`   Site: ${drop.site || 'unknown'}`);
            console.log(`   Was: $${parseFloat(drop.old_price).toFixed(2)} → Now: $${parseFloat(drop.new_price).toFixed(2)}`);
            console.log(`   Savings: $${Math.abs(drop.absolute_change)} (${Math.abs(drop.percent_change)}% off)`);
            console.log(`   URL: ${drop.url}`);
            console.log('─'.repeat(80));
            rank++;
        }

        console.log(`\nTotal: ${drops.length} product(s) with price drops`);
    },

    async summary(productId, days = 30) {
        if (!productId) {
            console.error('❌ Product ID required. Usage: npm run price-changes -- summary <productId> [days]');
            return;
        }

        console.log(`\n📈 Price Summary for Product #${productId} (${days} days)\n`);
        console.log('─'.repeat(60));
        
        const summary = await getPriceSummary(parseInt(productId), parseInt(days));
        
        if (!summary) {
            console.log('No price data found for this product.');
            return;
        }

        console.log(`Current Price:    $${summary.currentPrice.toFixed(2)}`);
        console.log(`Min Price:        $${summary.minPrice.toFixed(2)}`);
        console.log(`Max Price:        $${summary.maxPrice.toFixed(2)}`);
        console.log(`Avg Price:        $${summary.avgPrice.toFixed(2)}`);
        console.log(`Price Range:      $${summary.priceRange.toFixed(2)}`);
        console.log(`Volatility:       ${summary.volatility}%`);
        console.log(`Data Points:      ${summary.dataPoints}`);
        
        if (summary.periodChange) {
            const pc = summary.periodChange;
            const sign = pc.direction === 'down' ? '' : '+';
            const emoji = pc.direction === 'down' ? '📉' : pc.direction === 'up' ? '📈' : '➡️';
            console.log(`\n${emoji} Period Change:   ${sign}$${pc.absoluteChange} (${sign}${pc.percentChange}%)`);
        }
        console.log('─'.repeat(60));
    },

    async all() {
        console.log('\n📊 All Products with Price History\n');
        console.log('─'.repeat(80));
        
        const result = await pool.query(`
            SELECT 
                p.id,
                p.site,
                p.title,
                p.url,
                (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) as price_count,
                (SELECT price FROM price_history WHERE product_id = p.id ORDER BY captured_at DESC LIMIT 1) as current_price,
                (SELECT MIN(price) FROM price_history WHERE product_id = p.id) as min_price,
                (SELECT MAX(price) FROM price_history WHERE product_id = p.id) as max_price
            FROM products p
            WHERE EXISTS (SELECT 1 FROM price_history WHERE product_id = p.id)
            ORDER BY price_count DESC
        `);

        if (result.rows.length === 0) {
            console.log('No products with price history found.');
            return;
        }

        for (const row of result.rows) {
            const currentPrice = parseFloat(row.current_price);
            const minPrice = parseFloat(row.min_price);
            const maxPrice = parseFloat(row.max_price);
            const atMin = currentPrice === minPrice;
            const atMax = currentPrice === maxPrice;

            console.log(`[${row.id}] ${row.title?.substring(0, 45) || 'Unknown'}...`);
            console.log(`    Site: ${row.site || 'unknown'} | Prices: ${row.price_count}`);
            console.log(`    Current: $${currentPrice.toFixed(2)} ${atMin ? '🔥 (LOWEST!)' : atMax ? '⚠️ (HIGHEST)' : ''}`);
            console.log(`    Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
            console.log('─'.repeat(80));
        }

        console.log(`\nTotal: ${result.rows.length} product(s)`);
    },

    help() {
        console.log(`
Price Changes CLI

Usage:
  npm run price-changes -- <command> [options]

Commands:
  recent [hours]              Show significant price changes (default: 24 hours)
  drops [hours] [limit]       Show biggest price drops (default: 24 hours, 10 items)
  summary <productId> [days]  Show price summary for a product (default: 30 days)
  all                         List all products with price history
  help                        Show this help message

Examples:
  npm run price-changes -- recent 48
  npm run price-changes -- drops 24 5
  npm run price-changes -- summary 4 7
  npm run price-changes -- all

Environment Variables for Thresholds:
  PRICE_MIN_ABSOLUTE_CHANGE=1.00    Minimum $ change to be significant
  PRICE_MIN_PERCENT_CHANGE=5        Minimum % change to be significant
  PRICE_ALERT_DROP_THRESHOLD=10     % drop to trigger alert
  PRICE_ALERT_INCREASE_THRESHOLD=20 % increase to trigger alert
        `);
    }
};

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    if (!commands[command]) {
        console.error(`❌ Unknown command: ${command}`);
        commands.help();
        process.exit(1);
    }

    try {
        await commands[command](...args.slice(1));
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

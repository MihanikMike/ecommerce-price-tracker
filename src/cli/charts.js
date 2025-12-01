#!/usr/bin/env node

/**
 * Chart CLI Tool
 * Generate and view price history charts
 */

import { pool } from '../db/connect-pg.js';
import * as chartService from '../services/chartService.js';

const API_PORT = process.env.API_PORT || 3001;
const BASE_URL = `http://localhost:${API_PORT}`;

function print(msg) {
    console.log(msg);
}

function printHelp() {
    print(`
📈 Price History Charts CLI

Usage: node src/cli/charts.js <command> [options]

Commands:
  list                      List all products with price history
  url <productId>           Get chart URL for a product
  data <productId> [range]  Show chart data for a product
  compare <id1,id2,...>     Get comparison chart URL
  stats <productId>         Show price statistics

Time Ranges:
  24h   Last 24 hours
  7d    Last 7 days
  30d   Last 30 days (default)
  90d   Last 90 days
  1y    Last year
  all   All time

Examples:
  node src/cli/charts.js list
  node src/cli/charts.js url 1
  node src/cli/charts.js data 1 7d
  node src/cli/charts.js compare 1,2,3
  node src/cli/charts.js stats 1

npm scripts:
  npm run chart:list              List products
  npm run chart:url 1             Get chart URL
  npm run chart:data 1            Show data
  npm run chart:stats 1           Show statistics
`);
}

async function listProducts() {
    print('\n📊 Products with Price History\n');
    
    try {
        const products = await chartService.getProductsForChartSelection();
        
        if (products.length === 0) {
            print('No products with price history found.');
            print('\nAdd products and run price monitoring to collect price data.');
            return;
        }
        
        print(`Found ${products.length} products:\n`);
        print('ID   | Site      | Prices | Current    | Title');
        print('-----|-----------|--------|------------|' + '-'.repeat(50));
        
        for (const product of products) {
            const price = product.currentPrice 
                ? `$${product.currentPrice.toFixed(2)}`.padEnd(10)
                : 'N/A'.padEnd(10);
            const title = product.title.length > 45 
                ? product.title.substring(0, 42) + '...'
                : product.title;
            
            print(
                `${String(product.id).padEnd(4)} | ` +
                `${product.site.padEnd(9)} | ` +
                `${String(product.priceCount).padEnd(6)} | ` +
                `${price} | ` +
                title
            );
        }
        
        print(`\n💡 View chart: ${BASE_URL}/chart.html?id=<ID>`);
        print(`   Or run: npm run chart:url <ID>`);
    } catch (error) {
        print(`❌ Error: ${error.message}`);
    }
}

async function getChartUrl(productId) {
    print('\n🔗 Chart URL\n');
    
    try {
        const info = await chartService.getProductChartInfo(productId);
        
        if (!info) {
            print(`❌ Product ${productId} not found`);
            return;
        }
        
        print(`Product: ${info.title}`);
        print(`Site: ${info.site}`);
        print(`Price Records: ${info.totalPrices}`);
        print('');
        print(`📈 Chart URL: ${BASE_URL}/chart.html?id=${productId}`);
        print('');
        print('Time range options:');
        print(`  24h: ${BASE_URL}/chart.html?id=${productId}&range=24h`);
        print(`  7d:  ${BASE_URL}/chart.html?id=${productId}&range=7d`);
        print(`  30d: ${BASE_URL}/chart.html?id=${productId}&range=30d`);
        print(`  90d: ${BASE_URL}/chart.html?id=${productId}&range=90d`);
        print(`  1y:  ${BASE_URL}/chart.html?id=${productId}&range=1y`);
        print(`  all: ${BASE_URL}/chart.html?id=${productId}&range=all`);
        
    } catch (error) {
        print(`❌ Error: ${error.message}`);
    }
}

async function showChartData(productId, range = '30d') {
    print(`\n📊 Chart Data for Product ${productId} (${range})\n`);
    
    try {
        const info = await chartService.getProductChartInfo(productId);
        
        if (!info) {
            print(`❌ Product ${productId} not found`);
            return;
        }
        
        print(`Product: ${info.title}`);
        print(`Site: ${info.site}`);
        print('');
        
        const data = await chartService.getPriceChartData(productId, range);
        
        if (data.meta.dataPoints === 0) {
            print('No price data for this time range.');
            return;
        }
        
        print('Statistics:');
        print(`  Data Points: ${data.meta.dataPoints}`);
        print(`  Currency: ${data.meta.currency}`);
        print(`  Current: $${data.meta.current?.toFixed(2) || 'N/A'}`);
        print(`  Min: $${data.meta.min?.toFixed(2) || 'N/A'}`);
        print(`  Max: $${data.meta.max?.toFixed(2) || 'N/A'}`);
        print(`  Average: $${data.meta.avg?.toFixed(2) || 'N/A'}`);
        print(`  Change: ${data.meta.changePercent >= 0 ? '+' : ''}${data.meta.changePercent?.toFixed(2) || 0}%`);
        print('');
        
        // Show recent data points
        const recentCount = Math.min(10, data.labels.length);
        print(`Recent ${recentCount} data points:`);
        print('Date/Time                 | Price');
        print('--------------------------|--------');
        
        for (let i = data.labels.length - recentCount; i < data.labels.length; i++) {
            const date = new Date(data.labels[i]).toLocaleString();
            const price = data.datasets[0].data[i];
            print(`${date.padEnd(25)} | $${price.toFixed(2)}`);
        }
        
    } catch (error) {
        print(`❌ Error: ${error.message}`);
    }
}

async function getCompareUrl(idsString) {
    print('\n📊 Comparison Chart URL\n');
    
    const ids = idsString.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (ids.length < 2) {
        print('❌ Please provide at least 2 product IDs separated by commas');
        print('   Example: npm run chart:compare 1,2,3');
        return;
    }
    
    if (ids.length > 10) {
        print('❌ Maximum 10 products can be compared');
        return;
    }
    
    try {
        const data = await chartService.getComparisonChartData(ids, '30d');
        
        print(`Comparing ${data.meta.productCount} products:\n`);
        
        for (const product of data.meta.products) {
            print(`  ${product.id}: ${product.title} (${product.site})`);
        }
        
        print('');
        print(`📈 Comparison URL: ${BASE_URL}/chart.html?compare=${ids.join(',')}`);
        
    } catch (error) {
        print(`❌ Error: ${error.message}`);
    }
}

async function showStats(productId) {
    print(`\n📈 Price Statistics for Product ${productId}\n`);
    
    try {
        const info = await chartService.getProductChartInfo(productId);
        
        if (!info) {
            print(`❌ Product ${productId} not found`);
            return;
        }
        
        print(`Product: ${info.title}`);
        print(`Site: ${info.site}`);
        print(`URL: ${info.url}`);
        print('');
        print('All-Time Statistics:');
        print(`  Total Price Records: ${info.totalPrices}`);
        print(`  Tracking Since: ${info.firstPriceDate ? new Date(info.firstPriceDate).toLocaleDateString() : 'N/A'}`);
        print(`  Last Updated: ${info.lastSeen ? new Date(info.lastSeen).toLocaleString() : 'N/A'}`);
        print('');
        print('Price Summary:');
        print(`  Current Price: $${info.currentPrice?.toFixed(2) || 'N/A'}`);
        print(`  All-Time Low: $${info.allTimeLow?.toFixed(2) || 'N/A'}`);
        print(`  All-Time High: $${info.allTimeHigh?.toFixed(2) || 'N/A'}`);
        
        if (info.currentPrice && info.allTimeLow) {
            const diff = info.currentPrice - info.allTimeLow;
            const diffPercent = (diff / info.allTimeLow) * 100;
            print(`  Above Lowest: +$${diff.toFixed(2)} (+${diffPercent.toFixed(1)}%)`);
        }
        
        print('');
        print(`📈 View Chart: ${BASE_URL}/chart.html?id=${productId}`);
        
    } catch (error) {
        print(`❌ Error: ${error.message}`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();
    
    if (!command || command === 'help' || command === '--help' || command === '-h') {
        printHelp();
        process.exit(0);
    }
    
    try {
        switch (command) {
            case 'list':
                await listProducts();
                break;
                
            case 'url':
                const urlProductId = parseInt(args[1], 10);
                if (isNaN(urlProductId)) {
                    print('❌ Please provide a valid product ID');
                    print('   Usage: npm run chart:url <productId>');
                    process.exit(1);
                }
                await getChartUrl(urlProductId);
                break;
                
            case 'data':
                const dataProductId = parseInt(args[1], 10);
                if (isNaN(dataProductId)) {
                    print('❌ Please provide a valid product ID');
                    print('   Usage: npm run chart:data <productId> [range]');
                    process.exit(1);
                }
                const range = args[2] || '30d';
                await showChartData(dataProductId, range);
                break;
                
            case 'compare':
                if (!args[1]) {
                    print('❌ Please provide product IDs to compare');
                    print('   Usage: npm run chart:compare 1,2,3');
                    process.exit(1);
                }
                await getCompareUrl(args[1]);
                break;
                
            case 'stats':
                const statsProductId = parseInt(args[1], 10);
                if (isNaN(statsProductId)) {
                    print('❌ Please provide a valid product ID');
                    print('   Usage: npm run chart:stats <productId>');
                    process.exit(1);
                }
                await showStats(statsProductId);
                break;
                
            default:
                print(`❌ Unknown command: ${command}`);
                printHelp();
                process.exit(1);
        }
    } catch (error) {
        print(`❌ Error: ${error.message}`);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();

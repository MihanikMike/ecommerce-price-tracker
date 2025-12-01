#!/usr/bin/env node

/**
 * CLI for Search-Based Product Tracking
 * 
 * Usage:
 *   node src/cli/search.js search "iPhone 15 Pro Max"
 *   node src/cli/search.js search "Burton snowboard jacket" --keywords="winter,mens"
 *   node src/cli/search.js track "Nintendo Switch OLED" --interval=120
 *   node src/cli/search.js compare 1   # Compare prices for tracked product ID 1
 */

import { searchAndScrape } from "../search/search-orchestrator.js";
import { runSearchMonitor, quickSearch, trackProduct } from "../monitor/search-monitor.js";
import { searchAllSites, getAvailableSites } from "../search/direct-search.js";
import { 
    getSearchProductsToCheck, 
    getSearchResults,
    getPriceComparison,
    getAllTrackedProducts 
} from "../db/trackedProductsRepository.js";
import { browserPool } from "../utils/BrowserPool.js";
import { pool } from "../db/connect-pg.js";
import logger from "../utils/logger.js";

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0];
    const positional = [];
    const options = {};
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        } else if (arg.startsWith('-')) {
            options[arg.slice(1)] = true;
        } else {
            positional.push(arg);
        }
    }
    
    return { command, positional, options };
}

/**
 * Print colored output
 */
function print(text, color = 'reset') {
    const colors = {
        reset: '\x1b[0m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        red: '\x1b[31m',
        cyan: '\x1b[36m',
        bold: '\x1b[1m',
    };
    console.log(`${colors[color] || ''}${text}${colors.reset}`);
}

/**
 * Format price for display
 */
function formatPrice(price, currency = 'USD') {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency 
    }).format(price);
}

/**
 * Search command - quick search for a product
 * Uses direct e-commerce site search (more reliable than search engines)
 */
async function cmdSearch(productName, options) {
    print(`\n🔍 Searching for: "${productName}"`, 'cyan');
    print('━'.repeat(60), 'blue');
    
    // Show available sites
    const sites = options.sites ? options.sites.split(',') : ['target'];
    print(`Sites: ${sites.join(', ')}`, 'yellow');
    
    const maxResults = parseInt(options.max) || 5;
    const startTime = Date.now();
    
    try {
        // Use direct site search
        const result = await searchAllSites(productName, {
            sites,
            maxResults,
        });
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        print(`\n✅ Found ${result.allProducts.length} products in ${elapsed}s`, 'green');
        print('━'.repeat(60), 'blue');
        
        if (result.allProducts.length > 0) {
            // Best match (first result after sorting by priority)
            const bestMatch = result.allProducts[0];
            
            print('\n📌 BEST MATCH:', 'bold');
            print(`   Title: ${bestMatch.title?.substring(0, 70) || 'N/A'}...`);
            print(`   Price: ${bestMatch.price || 'N/A'}`, 'green');
            print(`   Store: ${bestMatch.site}`);
            print(`   URL: ${bestMatch.url?.substring(0, 80) || 'N/A'}`, 'cyan');
            
            // Price comparison across sites
            if (result.allProducts.length > 1) {
                print('\n💰 PRICE COMPARISON:', 'bold');
                
                const prices = result.allProducts.filter(p => p.priceValue).sort((a, b) => a.priceValue - b.priceValue);
                
                if (prices.length > 0) {
                    print(`   Lowest:  ${prices[0].price} at ${prices[0].site}`, 'green');
                    print(`   Highest: ${prices[prices.length - 1].price} at ${prices[prices.length - 1].site}`, 'red');
                }
                
                print('\n📊 ALL RESULTS:', 'bold');
                result.allProducts.forEach((p, i) => {
                    const priceStr = p.price || 'N/A';
                    print(`   ${i+1}. [${p.site}] ${p.title?.substring(0, 50) || 'N/A'}`);
                    print(`      ${priceStr}`, 'cyan');
                });
            }
        } else {
            print('\n❌ No products found', 'red');
            
            if (result.errors.length > 0) {
                print('\nErrors:', 'yellow');
                result.errors.forEach(e => print(`   ${e.site}: ${e.error}`));
            }
        }
        
        print('\n');
        
    } catch (error) {
        print(`\n❌ Search failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * Track command - add a product to tracking
 */
async function cmdTrack(productName, options) {
    print(`\n📥 Adding to tracking: "${productName}"`, 'cyan');
    
    const site = options.site || 'any';
    const keywords = options.keywords ? options.keywords.split(',') : [];
    const interval = parseInt(options.interval) || 60;
    
    try {
        const id = await trackProduct(productName, {
            site,
            keywords,
            checkIntervalMinutes: interval,
        });
        
        print(`\n✅ Product added with ID: ${id}`, 'green');
        print(`   Check interval: every ${interval} minutes`);
        print(`   Site preference: ${site}`);
        if (keywords.length > 0) {
            print(`   Keywords: ${keywords.join(', ')}`);
        }
        print('\n');
        
    } catch (error) {
        print(`\n❌ Failed to add product: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * Run command - run the search monitor
 */
async function cmdRun(options) {
    print('\n🚀 Running search-based price monitor...', 'cyan');
    print('━'.repeat(60), 'blue');
    
    const limit = parseInt(options.limit) || 50;
    
    try {
        const results = await runSearchMonitor({ limit });
        
        print(`\n📊 RESULTS:`, 'bold');
        print(`   Total processed: ${results.total}`);
        print(`   Successful: ${results.successful}`, 'green');
        print(`   Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'reset');
        
        if (results.results.length > 0) {
            print('\n📋 DETAILS:', 'bold');
            for (const r of results.results) {
                const status = r.success ? '✅' : '❌';
                const price = r.bestMatch ? formatPrice(r.bestMatch.price) : 'N/A';
                print(`   ${status} ${r.productName.substring(0, 40).padEnd(40)} ${price}`);
            }
        }
        
        print('\n');
        
    } catch (error) {
        print(`\n❌ Monitor failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * List command - list tracked products
 */
async function cmdList() {
    print('\n📋 Tracked Products (Search-Based)', 'cyan');
    print('━'.repeat(60), 'blue');
    
    try {
        const products = await getAllTrackedProducts();
        const searchProducts = products.filter(p => p.tracking_mode === 'search');
        
        if (searchProducts.length === 0) {
            print('\nNo search-based products found.', 'yellow');
            print('Add one with: node src/cli/search.js track "Product Name"');
        } else {
            print(`\nFound ${searchProducts.length} search-based products:\n`);
            
            for (const p of searchProducts) {
                const status = p.enabled ? '✓' : '✗';
                const confidence = p.match_confidence ? `${p.match_confidence}%` : 'N/A';
                print(`[${p.id}] ${status} ${p.product_name}`);
                print(`    Site: ${p.site} | Interval: ${p.check_interval_minutes}m | Confidence: ${confidence}`);
                if (p.last_found_url) {
                    print(`    Last URL: ${p.last_found_url.substring(0, 60)}...`, 'cyan');
                }
                print('');
            }
        }
        
    } catch (error) {
        print(`\n❌ Failed to list products: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * Compare command - show price comparison for a tracked product
 */
async function cmdCompare(productId) {
    print(`\n💰 Price Comparison for Product ID: ${productId}`, 'cyan');
    print('━'.repeat(60), 'blue');
    
    try {
        const comparison = await getPriceComparison(parseInt(productId));
        const results = await getSearchResults(parseInt(productId));
        
        if (!comparison.bestDeal) {
            print('\nNo price data found for this product.', 'yellow');
            print('Run search monitor first: node src/cli/search.js run');
        } else {
            print(`\n📊 PRICE ANALYSIS:`, 'bold');
            print(`   Lowest:  ${formatPrice(comparison.lowestPrice)}`, 'green');
            print(`   Highest: ${formatPrice(comparison.highestPrice)}`, 'red');
            print(`   Average: ${formatPrice(comparison.averagePrice)}`);
            print(`   Range:   ${formatPrice(comparison.priceRange)}`);
            
            print(`\n🏆 BEST DEAL:`, 'bold');
            print(`   ${comparison.bestDeal.site_name}: ${formatPrice(comparison.bestDeal.price)}`, 'green');
            print(`   ${comparison.bestDeal.result_title?.substring(0, 60)}...`);
            print(`   ${comparison.bestDeal.result_url}`, 'cyan');
            
            if (results.length > 1) {
                print(`\n📋 ALL RESULTS (${results.length}):`, 'bold');
                for (const r of results) {
                    const score = r.match_score ? `${r.match_score}%` : 'N/A';
                    print(`   ${r.site_name?.padEnd(15)} ${formatPrice(r.price).padStart(12)} (match: ${score})`);
                }
            }
        }
        
        print('\n');
        
    } catch (error) {
        print(`\n❌ Failed to get comparison: ${error.message}`, 'red');
        process.exit(1);
    }
}

/**
 * Help command
 */
function cmdHelp() {
    print('\n🔍 Search-Based Price Tracker CLI', 'bold');
    print('━'.repeat(60), 'blue');
    print('\nUsage: node src/cli/search.js <command> [options]\n');
    
    print('Commands:', 'cyan');
    print('  search <name>     Quick search for a product on e-commerce sites');
    print('  track <name>      Add product to tracking');
    print('  run               Run the search monitor');
    print('  list              List tracked products');
    print('  compare <id>      Show price comparison for a tracked product');
    print('  help              Show this help');
    
    print('\nOptions:', 'cyan');
    print('  --sites=a,b       Sites to search (default: target)');
    print('                    Available: target, newegg, bhphoto, rei');
    print('  --max=N           Max results per site (default: 5)');
    print('  --interval=N      Check interval in minutes (default: 60)');
    print('  --limit=N         Limit products to process (default: 50)');
    
    print('\nExamples:', 'cyan');
    print('  node src/cli/search.js search "iPhone 15 Pro"');
    print('  node src/cli/search.js search "AirPods Pro 3" --sites=target,newegg');
    print('  node src/cli/search.js track "Nintendo Switch" --interval=120');
    print('  node src/cli/search.js run --limit=10');
    print('  node src/cli/search.js compare 1');
    print('\n');
}

/**
 * Main
 */
async function main() {
    const { command, positional, options } = parseArgs();
    
    // Initialize browser pool for commands that need it
    const browserCommands = ['search', 'track', 'run', 'compare'];
    if (browserCommands.includes(command)) {
        await browserPool.initialize();
    }
    
    try {
        switch (command) {
            case 'search':
                if (!positional[0]) {
                    print('Error: Product name required', 'red');
                    print('Usage: node src/cli/search.js search "Product Name"');
                    process.exit(1);
                }
                await cmdSearch(positional[0], options);
                break;
                
            case 'track':
                if (!positional[0]) {
                    print('Error: Product name required', 'red');
                    print('Usage: node src/cli/search.js track "Product Name"');
                    process.exit(1);
                }
                await cmdTrack(positional[0], options);
                break;
                
            case 'run':
                await cmdRun(options);
                break;
                
            case 'list':
                await cmdList();
                break;
                
            case 'compare':
                if (!positional[0]) {
                    print('Error: Product ID required', 'red');
                    print('Usage: node src/cli/search.js compare <id>');
                    process.exit(1);
                }
                await cmdCompare(positional[0]);
                break;
                
            case 'help':
            case '--help':
            case '-h':
            case undefined:
                cmdHelp();
                break;
                
            default:
                print(`Unknown command: ${command}`, 'red');
                cmdHelp();
                process.exit(1);
        }
        
    } catch (error) {
        print(`\n❌ Error: ${error.message}`, 'red');
        logger.error({ error }, 'CLI error');
        process.exit(1);
    } finally {
        // Cleanup
        try {
            await browserPool.closeAll();
            await pool.end();
        } catch (e) {
            // Ignore cleanup errors
        }
    }
}

main();

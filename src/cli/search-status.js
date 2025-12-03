#!/usr/bin/env node

/**
 * Search Engine Status CLI
 * 
 * Check search engine configuration and test searches
 * 
 * Usage:
 *   node src/cli/search-status.js                    # Show status
 *   node src/cli/search-status.js test "query"       # Test search
 *   node src/cli/search-status.js test "query" google # Test specific engine
 */

import {
    getSearchEngineStatus,
    searchProductWithFallback,
    searchDuckDuckGo,
    searchGoogle,
    searchBingAPI,
} from '../search/search-engine.js';
import { browserPool } from '../utils/BrowserPool.js';
import logger from '../utils/logger.js';

async function showStatus() {
    console.log('\n🔍 Search Engine Status\n');
    console.log('=' .repeat(60));
    console.log('💡 All search engines are FREE (browser-based scraping)');
    console.log('   No API keys required!');
    console.log('=' .repeat(60));
    
    const status = getSearchEngineStatus();
    
    // DuckDuckGo
    console.log('\n📦 DuckDuckGo');
    console.log(`   Enabled: ✅ Yes`);
    console.log(`   Type: ${status.duckduckgo.type}`);
    console.log(`   Cost: ${status.duckduckgo.cost}`);
    console.log(`   Notes: ${status.duckduckgo.notes}`);
    
    // Google
    console.log('\n🔎 Google');
    console.log(`   Enabled: ✅ Yes`);
    console.log(`   Type: ${status.google.type}`);
    console.log(`   Cost: ${status.google.cost}`);
    console.log(`   Notes: ${status.google.notes}`);
    
    // Bing
    console.log('\n🔷 Bing');
    console.log(`   Enabled: ✅ Yes`);
    console.log(`   Type: ${status.bing.type}`);
    console.log(`   Cost: ${status.bing.cost}`);
    console.log(`   Notes: ${status.bing.notes}`);
    
    // Engine order
    console.log('\n⚙️  Configured Engine Order');
    console.log(`   ${status.configuredOrder.join(' → ')}`);
    console.log(`   (Set SEARCH_ENGINES env var to customize)`);
    
    console.log('\n' + '='.repeat(60));
}

async function testSearch(query, engine = null) {
    console.log(`\n🔍 Testing search for: "${query}"\n`);
    
    try {
        await browserPool.initialize();
        
        let results;
        let usedEngine;
        
        if (engine) {
            // Test specific engine
            console.log(`Using specific engine: ${engine}`);
            
            switch (engine.toLowerCase()) {
                case 'duckduckgo':
                case 'ddg':
                    results = await searchDuckDuckGo(query, { maxResults: 5, ecommerceOnly: true });
                    usedEngine = 'duckduckgo';
                    break;
                case 'google':
                    results = await searchGoogle(query, { maxResults: 5, ecommerceOnly: true });
                    usedEngine = 'google';
                    break;
                case 'bing':
                    results = await searchBingAPI(query, { maxResults: 5, ecommerceOnly: true });
                    usedEngine = 'bing';
                    break;
                default:
                    console.error(`❌ Unknown engine: ${engine}`);
                    console.log('   Valid engines: duckduckgo, google, bing');
                    return;
            }
        } else {
            // Use fallback strategy
            console.log('Using automatic fallback strategy...\n');
            const result = await searchProductWithFallback(query, { maxResults: 5 });
            results = result.results;
            usedEngine = result.engine;
            
            if (result.fallbackUsed) {
                console.log(`⚠️  Primary engine failed, used fallback: ${usedEngine}`);
            }
        }
        
        console.log(`\n✅ Results from: ${usedEngine}`);
        console.log('=' .repeat(60));
        
        if (!results || results.length === 0) {
            console.log('No e-commerce results found');
        } else {
            results.forEach((r, i) => {
                console.log(`\n${i + 1}. ${r.siteName} (priority: ${r.priority})`);
                console.log(`   Title: ${r.title.substring(0, 60)}${r.title.length > 60 ? '...' : ''}`);
                console.log(`   URL: ${r.url.substring(0, 70)}${r.url.length > 70 ? '...' : ''}`);
                if (r.source) {
                    console.log(`   Source: ${r.source}`);
                }
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`Total e-commerce results: ${results?.length || 0}`);
        
    } catch (err) {
        console.error(`\n❌ Search failed: ${err.message}`);
        logger.error({ error: err }, 'Search test failed');
    } finally {
        await browserPool.closeAll();
    }
}

function showHelp() {
    console.log(`
Search Engine Status CLI

Usage:
  node src/cli/search-status.js                     Show engine status
  node src/cli/search-status.js test "query"        Test search with fallback
  node src/cli/search-status.js test "query" google Test specific engine
  node src/cli/search-status.js help                Show this help

Engines (ALL FREE - browser-based scraping, no API keys needed):
  duckduckgo  Most reliable, uses HTML version (recommended)
  google      May show CAPTCHA under heavy use
  bing        May show CAPTCHA under heavy use

Environment Variables:
  SEARCH_ENGINES              Engine order (default: duckduckgo,google,bing)
  SEARCH_MAX_RESULTS          Max results per search (default: 10)
  SEARCH_TIMEOUT              Search timeout in ms (default: 30000)

Examples:
  node src/cli/search-status.js test "AirPods Pro"
  node src/cli/search-status.js test "Nintendo Switch" google
  node src/cli/search-status.js test "iPhone 15" bing
`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
} else if (command === 'test') {
    const query = args[1];
    const engine = args[2];
    
    if (!query) {
        console.error('❌ Please provide a search query');
        console.log('   Usage: node src/cli/search-status.js test "query"');
        process.exit(1);
    }
    
    testSearch(query, engine).then(() => process.exit(0)).catch(() => process.exit(1));
} else {
    showStatus();
}

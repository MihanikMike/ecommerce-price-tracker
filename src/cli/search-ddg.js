#!/usr/bin/env node

/**
 * DuckDuckGo Search CLI - Search for products using DuckDuckGo
 * 
 * Usage: node src/cli/search-ddg.js "Product Name"
 */

import { searchDuckDuckGo, searchProduct } from '../search/search-engine.js';
import { browserPool } from '../utils/BrowserPool.js';

async function main() {
    const query = process.argv[2];
    
    if (!query) {
        console.log('Usage: node src/cli/search-ddg.js "Product Name"');
        process.exit(1);
    }
    
    console.log(`\n🦆 DuckDuckGo Search for: "${query}"`);
    console.log('━'.repeat(60));
    
    try {
        // Initialize browser pool
        await browserPool.initialize();
        
        console.log('\nSearching DuckDuckGo...\n');
        
        const results = await searchDuckDuckGo(query, {
            maxResults: 10,
            ecommerceOnly: false,  // Show all results first
            prioritizeEcommerce: true,
        });
        
        if (results.length === 0) {
            console.log('❌ No results found');
        } else {
            console.log(`✅ Found ${results.length} results:\n`);
            
            results.forEach((result, i) => {
                const ecommerceTag = result.isEcommerce ? '🛒' : '🔗';
                console.log(`${i + 1}. ${ecommerceTag} ${result.title}`);
                console.log(`   Site: ${result.siteName}`);
                console.log(`   URL: ${result.url}`);
                if (result.snippet) {
                    console.log(`   Snippet: ${result.snippet.substring(0, 100)}...`);
                }
                console.log('');
            });
            
            // Count e-commerce results
            const ecommerceResults = results.filter(r => r.isEcommerce);
            console.log(`\n📊 Summary:`);
            console.log(`   Total results: ${results.length}`);
            console.log(`   E-commerce sites: ${ecommerceResults.length}`);
            if (ecommerceResults.length > 0) {
                console.log(`   Sites found: ${ecommerceResults.map(r => r.siteName).join(', ')}`);
            }
        }
        
    } catch (err) {
        console.error('❌ Search failed:', err.message);
    } finally {
        await browserPool.closeAll();
    }
}

main().catch(console.error);

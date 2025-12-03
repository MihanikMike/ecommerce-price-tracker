#!/usr/bin/env node
/**
 * DuckDuckGo Search Test Script
 * Alternative to Bing since Bing has bot detection
 */

import { browserPool } from '../utils/BrowserPool.js';

const query = process.argv[2] || 'Burton Freestyle Snowboard Bindings buy';

async function main() {
    await browserPool.initialize();
    
    // DuckDuckGo HTML-only version (lite) is less likely to detect bots
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`\n🦆 Testing DuckDuckGo search for: "${query}"`);
    console.log(`URL: ${searchUrl}\n`);
    
    let browser = null;
    
    try {
        browser = await browserPool.acquire();
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
        });
        
        const page = await context.newPage();
        
        console.log('Navigating to DuckDuckGo...');
        await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });
        
        await new Promise(r => setTimeout(r, 2000));
        
        // Save screenshot
        await page.screenshot({ path: '/tmp/ddg-search.png', fullPage: false });
        console.log('Screenshot saved to /tmp/ddg-search.png\n');
        
        // DuckDuckGo HTML uses .result class
        const resultElements = await page.$$('.result, .web-result, .results_links');
        console.log(`Found ${resultElements.length} result elements\n`);
        
        // Try to extract results
        const results = await page.evaluate(() => {
            const items = [];
            const resultDivs = document.querySelectorAll('.result, .web-result, .results_links');
            
            for (const div of resultDivs) {
                const link = div.querySelector('a.result__a, a.result__url, a');
                const title = div.querySelector('.result__title, .result__a, a');
                const snippet = div.querySelector('.result__snippet, .result__body');
                
                if (link) {
                    let url = link.href || link.getAttribute('href');
                    
                    // Decode DuckDuckGo redirect URL
                    if (url && url.includes('duckduckgo.com/l/')) {
                        try {
                            const urlObj = new URL(url);
                            const encodedUrl = urlObj.searchParams.get('uddg');
                            if (encodedUrl) {
                                url = decodeURIComponent(encodedUrl);
                            }
                        } catch (e) {}
                    }
                    
                    items.push({
                        url: url,
                        title: title?.innerText || '',
                        snippet: snippet?.innerText?.substring(0, 100) || '',
                    });
                }
            }
            
            return items;
        });
        
        console.log(`Extracted ${results.length} results:\n`);
        
        // Filter to e-commerce sites
        const ecommerceDomains = ['amazon', 'ebay', 'walmart', 'target', 'bestbuy', 'burton', 'rei', 'backcountry', 'evo'];
        
        const filtered = results.filter(r => 
            ecommerceDomains.some(d => r.url?.toLowerCase().includes(d))
        );
        
        if (filtered.length > 0) {
            console.log('🛒 E-commerce results:');
            filtered.slice(0, 5).forEach((r, i) => {
                console.log(`${i + 1}. ${r.title?.substring(0, 60)}...`);
                console.log(`   URL: ${r.url?.substring(0, 70)}`);
                console.log();
            });
        } else {
            console.log('All results:');
            results.slice(0, 5).forEach((r, i) => {
                console.log(`${i + 1}. ${r.title?.substring(0, 60)}...`);
                console.log(`   URL: ${r.url?.substring(0, 70)}`);
                console.log();
            });
        }
        
        await context.close();
        browserPool.release(browser);
        
    } catch (err) {
        console.error('Error:', err.message);
        if (browser) {
            browserPool.release(browser);
        }
    }
    
    await browserPool.closeAll();
}

main();

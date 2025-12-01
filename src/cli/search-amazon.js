#!/usr/bin/env node
/**
 * Quick Amazon search script
 */

import { browserPool } from '../utils/BrowserPool.js';
import { fetchPage, releaseBrowser } from '../utils/fetch-page.js';

const query = process.argv[2] || 'Burton Freestyle Snowboard Bindings';

async function main() {
    await browserPool.initialize();
    
    const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    console.log(`\n🔍 Searching Amazon for: "${query}"`);
    console.log(`URL: ${url}\n`);
    
    try {
        const { page, browser, context } = await fetchPage(url);
        
        // Wait for results to load
        await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 15000 }).catch(() => null);
        
        // Get all search results
        const results = await page.$$('[data-component-type="s-search-result"]');
        console.log(`Found ${results.length} search results\n`);
        
        // Save screenshot for debugging
        await page.screenshot({ path: '/tmp/amazon-search.png', fullPage: false });
        console.log('Screenshot saved to /tmp/amazon-search.png\n');
        
        // Try alternate selectors for title
        const titleSelectors = [
            'h2 a',           // Get the whole link text
            'h2',             // Or just h2
            '.a-text-normal',
            '[data-cy="title-recipe"] a',
            '.s-title-instructions-style'
        ];
        
        // Extract first 5 products - process all at once before any can go stale
        const products = [];
        for (let i = 0; i < Math.min(5, results.length); i++) {
            const result = results[i];
            try {
                let title = null;
                let titleEl = null;
                
                // Try each selector until one works
                for (const sel of titleSelectors) {
                    titleEl = await result.$(sel);
                    if (titleEl) {
                        title = await titleEl.textContent();
                        if (title && title.length > 10) {
                            title = title.trim().replace(/\s+/g, ' ');
                            break;
                        }
                    }
                }
                
                const priceEl = await result.$('.a-price .a-offscreen');
                const linkEl = await result.$('h2 a');
                
                const price = priceEl ? await priceEl.innerText() : 'N/A';
                const link = linkEl ? await linkEl.getAttribute('href') : '';
                
                if (title) {
                    products.push({ title, price, link });
                }
            } catch (e) {
                // Skip failed extractions
            }
        }
        
        await releaseBrowser({ page, browser, context });
        
        // Now print the results
        if (products.length === 0) {
            console.log('No products extracted. Amazon might be showing a captcha or different layout.');
        } else {
            products.forEach((p, i) => {
                console.log(`${i+1}. ${p.title.substring(0, 70)}...`);
                console.log(`   💰 Price: ${p.price}`);
                if (p.link) {
                    console.log(`   🔗 https://www.amazon.com${p.link.split('?')[0]}`);
                }
                console.log();
            });
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
    
    await browserPool.closeAll();
}

main();

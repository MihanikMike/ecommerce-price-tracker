#!/usr/bin/env node
/**
 * Bing Search Test Script
 * Tests the Bing search functionality and helps debug selector issues
 */

import { browserPool } from '../utils/BrowserPool.js';

const query = process.argv[2] || 'Burton Freestyle Snowboard Bindings buy';

async function main() {
    await browserPool.initialize();
    
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    console.log(`\n🔍 Testing Bing search for: "${query}"`);
    console.log(`URL: ${searchUrl}\n`);
    
    let browser = null;
    
    try {
        browser = await browserPool.acquire();
        
        // Create context with Firefox-like settings
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
        });
        
        const page = await context.newPage();
        
        // Navigate to Bing
        console.log('Navigating to Bing...');
        await page.goto(searchUrl, { waitUntil: 'load', timeout: 30000 });
        
        // Wait a moment for results
        await new Promise(r => setTimeout(r, 3000));
        
        // Check for consent/cookie banner and dismiss it
        const consentButton = await page.$('#bnp_btn_accept, .bnp_btn_accept, button[id*="accept"], #accept');
        if (consentButton) {
            console.log('Found consent button, clicking...');
            await consentButton.click();
            await new Promise(r => setTimeout(r, 2000));
        }
        
        // Get page HTML to see what's there
        const html = await page.content();
        console.log(`Page HTML length: ${html.length} characters`);
        
        // Check if we're on a consent page
        if (html.includes('consent') || html.includes('cookie') || html.includes('privacy')) {
            console.log('⚠️  Possible consent/cookie page detected');
        }
        
        // Save a snippet of the HTML for debugging
        const fs = await import('fs');
        fs.writeFileSync('/tmp/bing-page.html', html);
        console.log('HTML saved to /tmp/bing-page.html');
        
        // Check for common blocking indicators
        if (html.includes('robot') || html.includes('captcha') || html.includes('unusual traffic')) {
            console.log('⚠️  Bot detection triggered!');
        }
        
        if (html.includes('JavaScript') && html.includes('enable')) {
            console.log('⚠️  JavaScript requirement page');
        }
        
        // Debug: find any elements that look like results
        const debugInfo = await page.evaluate(() => {
            const info = {
                bodyClasses: document.body.className,
                mainContent: null,
                possibleResults: [],
                allDivClasses: [],
            };
            
            // Find main content area
            const mainEl = document.querySelector('#b_content, #b_results, main, [role="main"]');
            if (mainEl) {
                info.mainContent = mainEl.id || mainEl.className;
            }
            
            // Find any list items or divs that might be results
            const allLis = document.querySelectorAll('li');
            info.totalLis = allLis.length;
            
            // Check divs - maybe Bing uses divs now
            const allDivs = document.querySelectorAll('div');
            info.totalDivs = allDivs.length;
            
            // Sample div classes that have links
            for (let i = 0; i < allDivs.length; i++) {
                const div = allDivs[i];
                const link = div.querySelector('a[href*="http"]');
                if (link && div.className && !info.allDivClasses.includes(div.className)) {
                    info.allDivClasses.push(div.className.substring(0, 60));
                    if (info.allDivClasses.length > 15) break;
                }
            }
            
            // Look for anything that looks like a search result
            const links = document.querySelectorAll('a[href*="http"]');
            info.totalLinks = links.length;
            
            for (let i = 0; i < Math.min(10, links.length); i++) {
                const link = links[i];
                const href = link.href;
                // Skip bing internal links
                if (!href.includes('bing.com') && !href.includes('microsoft.com')) {
                    info.possibleResults.push({
                        href: href.substring(0, 80),
                        text: link.innerText?.substring(0, 50) || '',
                        parentClass: link.parentElement?.className?.substring(0, 40) || '',
                    });
                }
            }
            
            return info;
        });
        
        console.log(`\nBody classes: ${debugInfo.bodyClasses}`);
        console.log(`Main content: ${debugInfo.mainContent}`);
        console.log(`Total <li> elements: ${debugInfo.totalLis}`);
        console.log(`Total <div> elements: ${debugInfo.totalDivs}`);
        console.log(`Total external links: ${debugInfo.possibleResults.length}`);
        
        if (debugInfo.allDivClasses.length > 0) {
            console.log('\nDiv classes with links:');
            debugInfo.allDivClasses.forEach(c => console.log(`  - ${c}`));
        }
        
        if (debugInfo.possibleResults.length > 0) {
            console.log('\nExternal links found:');
            debugInfo.possibleResults.slice(0, 5).forEach((r, i) => {
                console.log(`  ${i+1}. ${r.text || '[no text]'}`);
                console.log(`     URL: ${r.href}`);
                console.log(`     Parent: ${r.parentClass}`);
            });
        }
        
        // Save screenshot
        await page.screenshot({ path: '/tmp/bing-search.png', fullPage: false });
        console.log('Screenshot saved to /tmp/bing-search.png\n');
        
        // Check for CAPTCHA
        const captcha = await page.$('#captcha, .b_captcha, #b_captcha');
        if (captcha) {
            console.log('⚠️  CAPTCHA detected!');
        }
        
        // Try various selectors to find results
        const selectors = [
            'li.b_algo',
            '.b_algo',
            '#b_results .b_algo',
            '#b_results > li',
            '.b_results > li',
            'ol#b_results > li',
            '#b_content .b_algo',
        ];
        
        console.log('Testing selectors:');
        for (const selector of selectors) {
            const elements = await page.$$(selector);
            console.log(`  ${selector}: ${elements.length} elements`);
        }
        
        // Get page title
        const title = await page.title();
        console.log(`\nPage title: ${title}`);
        
        // Get the main content structure
        console.log('\nAnalyzing page structure...');
        const structure = await page.evaluate(() => {
            const results = [];
            
            // Try to find any result-like elements
            const possibleResults = document.querySelectorAll('li.b_algo, .b_algo, #b_results li, .b_results li');
            
            for (let i = 0; i < Math.min(5, possibleResults.length); i++) {
                const el = possibleResults[i];
                const link = el.querySelector('a');
                const h2 = el.querySelector('h2');
                
                results.push({
                    className: el.className,
                    hasLink: !!link,
                    linkHref: link?.href?.substring(0, 80) || 'N/A',
                    h2Text: h2?.innerText?.substring(0, 50) || 'N/A',
                });
            }
            
            return {
                url: window.location.href,
                resultsCount: possibleResults.length,
                sampleResults: results,
            };
        });
        
        console.log(`Results found: ${structure.resultsCount}`);
        console.log(`Current URL: ${structure.url}`);
        
        if (structure.sampleResults.length > 0) {
            console.log('\nSample results:');
            structure.sampleResults.forEach((r, i) => {
                console.log(`\n  ${i + 1}. ${r.h2Text}...`);
                console.log(`     Class: ${r.className}`);
                console.log(`     Link: ${r.linkHref}...`);
            });
        }
        
        // Try to extract actual results
        console.log('\n--- Extracting Results ---\n');
        
        const resultElements = await page.$$('li.b_algo');
        console.log(`Found ${resultElements.length} results with 'li.b_algo'\n`);
        
        for (let i = 0; i < Math.min(5, resultElements.length); i++) {
            const el = resultElements[i];
            try {
                const linkEl = await el.$('h2 a');
                if (linkEl) {
                    const href = await linkEl.getAttribute('href');
                    const text = await linkEl.textContent();
                    console.log(`${i + 1}. ${text?.substring(0, 60)}...`);
                    console.log(`   URL: ${href?.substring(0, 70)}...`);
                    console.log();
                }
            } catch (e) {
                console.log(`${i + 1}. [Error extracting]`);
            }
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

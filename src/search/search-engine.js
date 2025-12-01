/**
 * Search Engine Scraper
 * 
 * Searches Bing for product URLs with anti-detection measures.
 * Bing is preferred because:
 * - Less aggressive bot detection than Google
 * - More reliable than DuckDuckGo (which now has CAPTCHA)
 * - Good e-commerce results
 */

import { browserPool } from "../utils/BrowserPool.js";
import { randomUA } from "../utils/useragents.js";
import logger from "../utils/logger.js";
import { rateLimiter } from "../utils/rate-limiter.js";

/**
 * Known e-commerce domains to prioritize in search results
 */
const ECOMMERCE_DOMAINS = [
    // Major retailers
    { domain: 'amazon.com', priority: 10, name: 'Amazon' },
    { domain: 'amazon.co.uk', priority: 10, name: 'Amazon UK' },
    { domain: 'ebay.com', priority: 8, name: 'eBay' },
    { domain: 'walmart.com', priority: 9, name: 'Walmart' },
    { domain: 'target.com', priority: 9, name: 'Target' },
    { domain: 'bestbuy.com', priority: 9, name: 'Best Buy' },
    
    // Specialty retailers
    { domain: 'burton.com', priority: 10, name: 'Burton' },
    { domain: 'rei.com', priority: 8, name: 'REI' },
    { domain: 'backcountry.com', priority: 8, name: 'Backcountry' },
    { domain: 'moosejaw.com', priority: 7, name: 'Moosejaw' },
    { domain: 'evo.com', priority: 7, name: 'Evo' },
    
    // Fashion
    { domain: 'nordstrom.com', priority: 8, name: 'Nordstrom' },
    { domain: 'zappos.com', priority: 8, name: 'Zappos' },
    { domain: 'macys.com', priority: 7, name: "Macy's" },
    
    // Electronics
    { domain: 'newegg.com', priority: 8, name: 'Newegg' },
    { domain: 'bhphotovideo.com', priority: 8, name: 'B&H Photo' },
    
    // Home
    { domain: 'homedepot.com', priority: 8, name: 'Home Depot' },
    { domain: 'lowes.com', priority: 8, name: "Lowe's" },
    { domain: 'wayfair.com', priority: 7, name: 'Wayfair' },
];

/**
 * Domains to exclude from search results
 */
const EXCLUDED_DOMAINS = [
    'youtube.com',
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'pinterest.com',
    'reddit.com',
    'wikipedia.org',
    'yelp.com',
    'linkedin.com',
    'tiktok.com',
    'bing.com',
    'microsoft.com',
];

/**
 * Search configuration
 */
const SEARCH_CONFIG = {
    maxResults: 10,           // Maximum results to return
    timeout: 30000,           // Page load timeout
    minDelay: 3000,           // Minimum delay between searches
    maxDelay: 7000,           // Maximum delay between searches
    retries: 3,               // Number of retry attempts
};

/**
 * Random delay to appear more human-like
 */
function randomDelay(min = SEARCH_CONFIG.minDelay, max = SEARCH_CONFIG.maxDelay) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Build Bing search URL
 */
function buildBingSearchUrl(query, options = {}) {
    // Use simple URL - Bing adds other params automatically
    const params = new URLSearchParams({
        q: query,
    });
    
    return `https://www.bing.com/search?${params.toString()}`;
}

/**
 * Generate random conversation ID for Bing
 */
function generateCvid() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
}

/**
 * Check if URL is from a known e-commerce domain
 */
function getEcommerceDomainInfo(url) {
    const domain = extractDomain(url);
    if (!domain) return null;
    
    return ECOMMERCE_DOMAINS.find(d => domain.includes(d.domain));
}

/**
 * Check if URL should be excluded
 */
function isExcludedDomain(url) {
    const domain = extractDomain(url);
    if (!domain) return true;
    
    return EXCLUDED_DOMAINS.some(d => domain.includes(d));
}

/**
 * Parse Bing search results from HTML
 */
async function parseBingResults(page) {
    const results = [];
    
    try {
        // Bing uses different selectors - try multiple
        const selectors = [
            'li.b_algo',           // Standard organic results
            '.b_algo',             // Alternative
            '#b_results .b_algo',  // With parent context
        ];
        
        let resultElements = [];
        for (const selector of selectors) {
            resultElements = await page.$$(selector);
            if (resultElements.length > 0) {
                logger.debug({ selector, count: resultElements.length }, 'Found Bing results');
                break;
            }
        }
        
        for (const element of resultElements) {
            try {
                // Get the link - Bing puts it in h2 > a
                const linkElement = await element.$('h2 a');
                if (!linkElement) continue;
                
                let href = await linkElement.getAttribute('href');
                const title = await linkElement.innerText();
                
                // Bing wraps URLs in a redirect - extract the real URL
                if (href && href.includes('bing.com/ck/a')) {
                    try {
                        const url = new URL(href);
                        const encodedUrl = url.searchParams.get('u');
                        if (encodedUrl) {
                            // Bing uses a1 prefix before base64 encoded URL
                            const base64Part = encodedUrl.replace(/^a1/, '');
                            href = Buffer.from(base64Part, 'base64').toString('utf-8');
                        }
                    } catch (e) {
                        logger.debug({ href, error: e.message }, 'Failed to decode Bing redirect URL');
                    }
                }
                
                // Get snippet/description
                const snippetElement = await element.$('.b_caption p, .b_algoSlug');
                const snippet = snippetElement ? await snippetElement.innerText() : '';
                
                // Skip if no valid URL or excluded domain
                if (!href || !href.startsWith('http') || isExcludedDomain(href)) {
                    continue;
                }
                
                // Get e-commerce info if available
                const ecommerceInfo = getEcommerceDomainInfo(href);
                
                results.push({
                    url: href,
                    title: title?.trim() || '',
                    snippet: snippet?.trim() || '',
                    domain: extractDomain(href),
                    isEcommerce: !!ecommerceInfo,
                    siteName: ecommerceInfo?.name || extractDomain(href),
                    priority: ecommerceInfo?.priority || 0,
                });
            } catch (err) {
                logger.debug({ error: err.message }, 'Failed to parse single Bing result');
            }
        }
    } catch (err) {
        logger.error({ error: err }, 'Failed to parse Bing search results');
    }
    
    return results;
}

/**
 * Firefox user agents (less detected by Bing)
 */
const FIREFOX_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
];

function getRandomFirefoxUA() {
    return FIREFOX_USER_AGENTS[Math.floor(Math.random() * FIREFOX_USER_AGENTS.length)];
}

/**
 * Create a browser context with anti-detection measures
 */
async function createStealthContext(browser) {
    // Use Firefox user agent since we're using Firefox browser (less detected by Bing)
    const userAgent = getRandomFirefoxUA();
    
    const context = await browser.newContext({
        userAgent,
        viewport: { 
            width: 1920 + Math.floor(Math.random() * 100), 
            height: 1080 + Math.floor(Math.random() * 100) 
        },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        colorScheme: 'light',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        },
    });
    
    // Add anti-detection scripts
    await context.addInitScript(() => {
        // Hide webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ]
        });
        
        // Override languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        
        // Override platform
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        
        // Override hardware concurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        
        // Override device memory
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        
        // Mock Chrome runtime
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {},
        };
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
    });
    
    return { context, userAgent };
}

/**
 * Perform a search on Bing with anti-detection
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchBing(query, options = {}) {
    const {
        maxResults = SEARCH_CONFIG.maxResults,
        ecommerceOnly = true,
        prioritizeEcommerce = true,
    } = options;
    
    const searchUrl = buildBingSearchUrl(query);
    logger.info({ query, searchUrl }, 'Performing Bing search');
    
    // Apply rate limiting for searches
    await rateLimiter.waitForRateLimit(searchUrl);
    
    // Random delay before search to appear more human
    await randomDelay(1000, 3000);
    
    let browser = null;
    let context = null;
    
    try {
        browser = await browserPool.acquire();
        const stealthResult = await createStealthContext(browser);
        context = stealthResult.context;
        
        logger.debug({ userAgent: stealthResult.userAgent.substring(0, 50) }, 'Using user agent');
        
        const page = await context.newPage();
        
        // Navigate directly to search (simpler approach works better with Firefox)
        await page.goto(searchUrl, { 
            waitUntil: 'load', 
            timeout: SEARCH_CONFIG.timeout 
        });
        
        // Wait for results to load
        try {
            await page.waitForSelector('li.b_algo', { timeout: 15000 });
            logger.debug({ query }, 'Results selector found');
        } catch (e) {
            logger.warn({ query }, 'No results selector found on Bing');
        }
        
        // Random delay after results load
        await randomDelay(1500, 3000);
        
        // Check for CAPTCHA
        const captchaExists = await page.$('#captcha, .b_captcha, #b_captcha');
        if (captchaExists) {
            logger.warn({ query }, 'CAPTCHA detected on Bing');
            throw new Error('CAPTCHA detected');
        }
        
        // Random scroll to appear human
        await page.evaluate(() => {
            window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
        });
        
        await randomDelay(500, 1500);
        
        // Parse results
        let results = await parseBingResults(page);
        
        logger.info({ query, totalResults: results.length }, 'Parsed Bing search results');
        
        // Filter to e-commerce only if requested
        if (ecommerceOnly) {
            results = results.filter(r => r.isEcommerce);
        }
        
        // Sort by priority (e-commerce sites first)
        if (prioritizeEcommerce) {
            results.sort((a, b) => b.priority - a.priority);
        }
        
        // Limit results
        results = results.slice(0, maxResults);
        
        logger.info({ 
            query, 
            filteredResults: results.length,
            sites: results.map(r => r.siteName)
        }, 'Bing search completed');
        
        return results;
        
    } catch (err) {
        logger.error({ error: err.message, query }, 'Bing search failed');
        throw err;
    } finally {
        if (context) {
            await context.close().catch(() => {});
        }
        if (browser) {
            browserPool.release(browser);
        }
    }
}

/**
 * Search for a product with retry logic
 * 
 * @param {string} productName - Product name to search
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchProduct(productName, options = {}) {
    const {
        keywords = [],
        maxResults = 5,
        retries = SEARCH_CONFIG.retries,
    } = options;
    
    // Build search query with product name and keywords
    const queryParts = [productName, ...keywords, 'buy', 'price'];
    const query = queryParts.join(' ');
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Random delay between attempts
            if (attempt > 1) {
                const backoffDelay = Math.min(3000 * Math.pow(1.5, attempt - 1), 15000);
                await randomDelay(backoffDelay, backoffDelay + 2000);
            }
            
            const results = await searchBing(query, {
                maxResults,
                ecommerceOnly: true,
                prioritizeEcommerce: true,
            });
            
            if (results.length > 0) {
                return results;
            }
            
            // No results, try simpler query
            if (attempt < retries) {
                logger.info({ attempt, query }, 'No e-commerce results, retrying with simpler query');
                
                await randomDelay(2000, 4000);
                
                // Fallback to just product name
                const simpleResults = await searchBing(productName, {
                    maxResults,
                    ecommerceOnly: false,
                    prioritizeEcommerce: true,
                });
                
                if (simpleResults.length > 0) {
                    return simpleResults;
                }
            }
            
        } catch (err) {
            lastError = err;
            logger.warn({ attempt, error: err.message }, 'Search attempt failed');
        }
    }
    
    throw lastError || new Error(`No search results found for: ${productName}`);
}

/**
 * Search for a product across multiple search engines (fallback strategy)
 */
export async function searchProductWithFallback(productName, options = {}) {
    // Primary: Bing
    try {
        const results = await searchProduct(productName, options);
        if (results.length > 0) {
            return { engine: 'bing', results };
        }
    } catch (err) {
        logger.warn({ error: err.message }, 'Bing search failed');
    }
    
    // Future: Add other search engine fallbacks here
    return { engine: 'none', results: [] };
}

/**
 * Get list of known e-commerce domains
 */
export function getKnownEcommerceDomains() {
    return [...ECOMMERCE_DOMAINS];
}

/**
 * Add a custom e-commerce domain
 */
export function addEcommerceDomain(domain, name, priority = 5) {
    if (!ECOMMERCE_DOMAINS.find(d => d.domain === domain)) {
        ECOMMERCE_DOMAINS.push({ domain, name, priority });
    }
}

// Keep backward compatibility - export DuckDuckGo as alias
export const searchDuckDuckGo = searchBing;

export default {
    searchBing,
    searchDuckDuckGo: searchBing,  // Alias for backward compatibility
    searchProduct,
    searchProductWithFallback,
    getKnownEcommerceDomains,
    addEcommerceDomain,
};

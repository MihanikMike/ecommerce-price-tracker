/**
 * Search Engine Module
 * 
 * Multi-engine search with automatic fallback (ALL FREE, NO API KEYS):
 * 1. DuckDuckGo HTML (free, browser-based scraping)
 * 2. Google (free, browser-based scraping)
 * 3. Bing (free, browser-based scraping)
 * 
 * Features:
 * - Automatic fallback when one engine fails
 * - E-commerce domain prioritization
 * - Rate limiting and anti-detection
 * - Configurable engine order
 * - No API keys required!
 */

import { browserPool } from "../utils/BrowserPool.js";
import { randomUA } from "../utils/useragents.js";
import logger from "../utils/logger.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import config from "../config/index.js";

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
    
    // Specialty outdoor/snow retailers
    { domain: 'burton.com', priority: 10, name: 'Burton' },
    { domain: 'rei.com', priority: 8, name: 'REI' },
    { domain: 'backcountry.com', priority: 8, name: 'Backcountry' },
    { domain: 'moosejaw.com', priority: 7, name: 'Moosejaw' },
    { domain: 'evo.com', priority: 8, name: 'Evo' },
    { domain: 'sunandski.com', priority: 7, name: 'Sun & Ski' },
    { domain: 'scheels.com', priority: 7, name: 'Scheels' },
    { domain: 'bluezonesports.com', priority: 6, name: 'Blue Zone Sports' },
    { domain: 'rudeboys.com', priority: 6, name: 'Rude Boys' },
    { domain: 'skibindingsnow.com', priority: 6, name: 'Ski Binding Snow' },
    { domain: 'blauerboardshop.com', priority: 6, name: 'Blauer Board Shop' },
    { domain: 'theskibum.com', priority: 6, name: 'The Ski Bum' },
    { domain: 'powder7.com', priority: 6, name: 'Powder7' },
    { domain: 'christysports.com', priority: 6, name: 'Christy Sports' },
    { domain: 'buckmansskishop.com', priority: 6, name: "Buckman's" },
    { domain: 'sportchek.ca', priority: 6, name: 'Sport Chek' },
    
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
    'duckduckgo.com',  // DDG ad redirects
];

/**
 * Search configuration
 */
const SEARCH_CONFIG = {
    maxResults: config.search?.maxResults || 10,
    timeout: config.search?.timeout || 30000,
    minDelay: 3000,           // Minimum delay between searches
    maxDelay: 7000,           // Maximum delay between searches
    retries: config.search?.retries || 3,
    engines: config.search?.engines || ['duckduckgo', 'google', 'bing'],
};

/**
 * Random delay to appear more human-like
 */
function randomDelay(min = SEARCH_CONFIG.minDelay, max = SEARCH_CONFIG.maxDelay) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Build DuckDuckGo search URL (HTML version - no JavaScript required)
 */
function buildDuckDuckGoUrl(query, options = {}) {
    const params = new URLSearchParams({
        q: query,
    });
    
    // Use HTML version for less bot detection
    return `https://html.duckduckgo.com/html/?${params.toString()}`;
}

// Keep for backward compatibility
const buildBingSearchUrl = buildDuckDuckGoUrl;

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
 * Parse DuckDuckGo HTML search results
 */
async function parseDuckDuckGoResults(page) {
    const results = [];
    
    try {
        // DuckDuckGo HTML version uses .result class for each result
        const resultElements = await page.$$('.result');
        
        logger.debug({ count: resultElements.length }, 'Found DuckDuckGo results');
        
        for (const element of resultElements) {
            try {
                // Get the title link
                const linkElement = await element.$('.result__a');
                if (!linkElement) continue;
                
                let href = await linkElement.getAttribute('href');
                const title = await linkElement.innerText();
                
                // DuckDuckGo wraps URLs in a redirect - extract the real URL from uddg param
                if (href && href.includes('uddg=')) {
                    try {
                        const url = new URL(href, 'https://duckduckgo.com');
                        const encodedUrl = url.searchParams.get('uddg');
                        if (encodedUrl) {
                            href = decodeURIComponent(encodedUrl);
                        }
                    } catch (e) {
                        logger.debug({ href, error: e.message }, 'Failed to decode DuckDuckGo redirect URL');
                    }
                }
                
                // Get snippet/description
                const snippetElement = await element.$('.result__snippet');
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
                logger.debug({ error: err.message }, 'Failed to parse single DuckDuckGo result');
            }
        }
    } catch (err) {
        logger.error({ error: err }, 'Failed to parse DuckDuckGo search results');
    }
    
    return results;
}

// Keep for backward compatibility
const parseBingResults = parseDuckDuckGoResults;

// ============================================================================
// Google Search (Free, Browser-Based Scraping)
// ============================================================================

/**
 * Parse Google search results from page
 */
async function parseGoogleResults(page) {
    const results = [];
    
    try {
        // Google uses various selectors for search results
        // Try multiple selectors for robustness
        const resultSelectors = [
            'div.g',           // Standard results
            'div[data-hveid]', // Results with hveid
            '.rc',             // Older layout
        ];
        
        let resultElements = [];
        for (const selector of resultSelectors) {
            resultElements = await page.$$(selector);
            if (resultElements.length > 0) {
                logger.debug({ selector, count: resultElements.length }, 'Found Google results with selector');
                break;
            }
        }
        
        for (const element of resultElements) {
            try {
                // Get the link - try multiple selectors
                let linkElement = await element.$('a[href^="http"]');
                if (!linkElement) linkElement = await element.$('a[data-ved]');
                if (!linkElement) continue;
                
                let href = await linkElement.getAttribute('href');
                
                // Skip Google redirect URLs
                if (href && href.includes('google.com/url')) {
                    try {
                        const url = new URL(href);
                        href = url.searchParams.get('url') || url.searchParams.get('q') || href;
                    } catch (e) {
                        // Keep original href
                    }
                }
                
                // Get title
                const titleElement = await element.$('h3');
                const title = titleElement ? await titleElement.innerText() : '';
                
                // Get snippet
                const snippetSelectors = [
                    'div[data-sncf]',
                    '.VwiC3b',
                    'span.st',
                    'div.IsZvec',
                ];
                let snippet = '';
                for (const sel of snippetSelectors) {
                    const snippetEl = await element.$(sel);
                    if (snippetEl) {
                        snippet = await snippetEl.innerText();
                        break;
                    }
                }
                
                // Skip if no valid URL or excluded domain
                if (!href || !href.startsWith('http') || isExcludedDomain(href)) {
                    continue;
                }
                
                // Skip Google's own pages
                if (href.includes('google.com') || href.includes('gstatic.com')) {
                    continue;
                }
                
                const ecommerceInfo = getEcommerceDomainInfo(href);
                
                results.push({
                    url: href,
                    title: title?.trim() || '',
                    snippet: snippet?.trim() || '',
                    domain: extractDomain(href),
                    isEcommerce: !!ecommerceInfo,
                    siteName: ecommerceInfo?.name || extractDomain(href),
                    priority: ecommerceInfo?.priority || 0,
                    source: 'google',
                });
            } catch (err) {
                logger.debug({ error: err.message }, 'Failed to parse single Google result');
            }
        }
    } catch (err) {
        logger.error({ error: err }, 'Failed to parse Google search results');
    }
    
    return results;
}

/**
 * Search using Google (free, browser-based scraping)
 * No API key required - uses direct browser access
 * 
 * Note: Google may show CAPTCHA for automated access. 
 * Use with appropriate delays and consider it a fallback option.
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchGoogle(query, options = {}) {
    const {
        maxResults = SEARCH_CONFIG.maxResults,
        ecommerceOnly = true,
        prioritizeEcommerce = true,
    } = options;

    // Build Google search URL
    const params = new URLSearchParams({
        q: query,
        num: Math.min(maxResults + 5, 20).toString(), // Request extra for filtering
        hl: 'en',
    });
    const searchUrl = `https://www.google.com/search?${params.toString()}`;
    
    logger.info({ query, searchUrl }, 'Performing Google search (browser-based)');
    
    // Apply rate limiting
    await rateLimiter.waitForRateLimit(searchUrl);
    await randomDelay(2000, 5000);
    
    let browser = null;
    let context = null;
    
    try {
        browser = await browserPool.acquire();
        const stealthResult = await createStealthContext(browser);
        context = stealthResult.context;
        
        const page = await context.newPage();
        
        // Navigate to Google
        await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: SEARCH_CONFIG.timeout 
        });
        
        // Wait for results
        try {
            await page.waitForSelector('div.g, div[data-hveid]', { timeout: 10000 });
        } catch (e) {
            // Check for CAPTCHA
            const captchaExists = await page.$('#captcha-form, .g-recaptcha, #recaptcha');
            if (captchaExists) {
                throw new Error('Google CAPTCHA detected - try again later or use different search engine');
            }
            logger.warn({ query }, 'No Google results selector found');
        }
        
        await randomDelay(1000, 2000);
        
        // Parse results
        let results = await parseGoogleResults(page);
        
        logger.info({ query, totalResults: results.length }, 'Parsed Google search results');
        
        // Filter to e-commerce only if requested
        if (ecommerceOnly) {
            results = results.filter(r => r.isEcommerce);
        }
        
        // Sort by priority
        if (prioritizeEcommerce) {
            results.sort((a, b) => b.priority - a.priority);
        }
        
        results = results.slice(0, maxResults);
        
        logger.info({ 
            query, 
            filteredResults: results.length,
            sites: results.map(r => r.siteName),
        }, 'Google search completed');
        
        return results;
        
    } catch (err) {
        logger.error({ error: err.message, query }, 'Google search failed');
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

// ============================================================================
// Bing Search (Free, Browser-Based Scraping)
// ============================================================================

/**
 * Parse Bing search results from page
 */
async function parseBingSearchResults(page) {
    const results = [];
    
    try {
        // Bing uses li.b_algo for search results
        const resultElements = await page.$$('li.b_algo');
        
        logger.debug({ count: resultElements.length }, 'Found Bing results');
        
        for (const element of resultElements) {
            try {
                // Get the main link
                const linkElement = await element.$('h2 a');
                if (!linkElement) continue;
                
                const href = await linkElement.getAttribute('href');
                const title = await linkElement.innerText();
                
                // Get snippet
                const snippetElement = await element.$('.b_caption p, .b_algoSlug');
                const snippet = snippetElement ? await snippetElement.innerText() : '';
                
                // Skip if no valid URL or excluded domain
                if (!href || !href.startsWith('http') || isExcludedDomain(href)) {
                    continue;
                }
                
                // Skip Bing's own pages
                if (href.includes('bing.com') || href.includes('microsoft.com')) {
                    continue;
                }
                
                const ecommerceInfo = getEcommerceDomainInfo(href);
                
                results.push({
                    url: href,
                    title: title?.trim() || '',
                    snippet: snippet?.trim() || '',
                    domain: extractDomain(href),
                    isEcommerce: !!ecommerceInfo,
                    siteName: ecommerceInfo?.name || extractDomain(href),
                    priority: ecommerceInfo?.priority || 0,
                    source: 'bing',
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
 * Search using Bing (free, browser-based scraping)
 * No API key required - uses direct browser access
 * 
 * Note: Bing may show CAPTCHA for automated access.
 * Use with appropriate delays and consider it a fallback option.
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchBingAPI(query, options = {}) {
    const {
        maxResults = SEARCH_CONFIG.maxResults,
        ecommerceOnly = true,
        prioritizeEcommerce = true,
    } = options;

    // Build Bing search URL
    const params = new URLSearchParams({
        q: query,
        count: Math.min(maxResults + 5, 30).toString(),
    });
    const searchUrl = `https://www.bing.com/search?${params.toString()}`;
    
    logger.info({ query, searchUrl }, 'Performing Bing search (browser-based)');
    
    // Apply rate limiting
    await rateLimiter.waitForRateLimit(searchUrl);
    await randomDelay(2000, 5000);
    
    let browser = null;
    let context = null;
    
    try {
        browser = await browserPool.acquire();
        const stealthResult = await createStealthContext(browser);
        context = stealthResult.context;
        
        const page = await context.newPage();
        
        // Navigate to Bing
        await page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: SEARCH_CONFIG.timeout 
        });
        
        // Wait for results
        try {
            await page.waitForSelector('li.b_algo', { timeout: 10000 });
        } catch (e) {
            // Check for CAPTCHA
            const captchaExists = await page.$('#b_captcha, .b_captcha');
            if (captchaExists) {
                throw new Error('Bing CAPTCHA detected - try again later or use different search engine');
            }
            logger.warn({ query }, 'No Bing results selector found');
        }
        
        await randomDelay(1000, 2000);
        
        // Parse results
        let results = await parseBingSearchResults(page);
        
        logger.info({ query, totalResults: results.length }, 'Parsed Bing search results');
        
        // Filter to e-commerce only if requested
        if (ecommerceOnly) {
            results = results.filter(r => r.isEcommerce);
        }
        
        // Sort by priority
        if (prioritizeEcommerce) {
            results.sort((a, b) => b.priority - a.priority);
        }
        
        results = results.slice(0, maxResults);
        
        logger.info({ 
            query, 
            filteredResults: results.length,
            sites: results.map(r => r.siteName),
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
 * Perform a search on DuckDuckGo with anti-detection
 * Uses the HTML version which requires no JavaScript and has less bot detection
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function searchDuckDuckGo(query, options = {}) {
    const {
        maxResults = SEARCH_CONFIG.maxResults,
        ecommerceOnly = true,
        prioritizeEcommerce = true,
    } = options;
    
    const searchUrl = buildDuckDuckGoUrl(query);
    logger.info({ query, searchUrl }, 'Performing DuckDuckGo search');
    
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
        
        // Navigate directly to search (DuckDuckGo HTML version)
        await page.goto(searchUrl, { 
            waitUntil: 'load', 
            timeout: SEARCH_CONFIG.timeout 
        });
        
        // Wait for results to load - DuckDuckGo uses .result class
        try {
            await page.waitForSelector('.result', { timeout: 15000 });
            logger.debug({ query }, 'Results selector found');
        } catch (e) {
            logger.warn({ query }, 'No results selector found on DuckDuckGo');
        }
        
        // Random delay after results load
        await randomDelay(1500, 3000);
        
        // DuckDuckGo HTML version doesn't typically use CAPTCHA
        // But check for any error messages
        const errorExists = await page.$('.error, .no-results');
        if (errorExists) {
            const errorText = await errorExists.innerText();
            logger.warn({ query, error: errorText }, 'Error on DuckDuckGo');
        }
        
        // Random scroll to appear human
        await page.evaluate(() => {
            window.scrollBy(0, Math.floor(Math.random() * 300) + 100);
        });
        
        await randomDelay(500, 1500);
        
        // Parse results
        let results = await parseDuckDuckGoResults(page);
        
        logger.info({ query, totalResults: results.length }, 'Parsed DuckDuckGo search results');
        
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
        }, 'DuckDuckGo search completed');
        
        return results;
        
    } catch (err) {
        logger.error({ error: err.message, query }, 'DuckDuckGo search failed');
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
            
            const results = await searchDuckDuckGo(query, {
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
                const simpleResults = await searchDuckDuckGo(productName, {
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
 * Uses configured engine order with automatic fallback
 * 
 * @param {string} productName - Product name to search
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Object with engine used and results array
 */
export async function searchProductWithFallback(productName, options = {}) {
    const {
        keywords = [],
        maxResults = SEARCH_CONFIG.maxResults,
        engines = SEARCH_CONFIG.engines,
    } = options;

    // Build search query
    const queryParts = [productName, ...keywords, 'buy', 'price'];
    const query = queryParts.join(' ');

    const searchOptions = {
        maxResults,
        ecommerceOnly: true,
        prioritizeEcommerce: true,
    };

    const errors = [];

    // Try each search engine in order
    // All engines are free browser-based scraping - no API keys required
    for (const engine of engines) {
        try {
            let results = [];
            
            switch (engine.toLowerCase()) {
                case 'duckduckgo':
                case 'ddg':
                    logger.info({ engine: 'duckduckgo', query }, 'Trying DuckDuckGo search (browser-based)');
                    results = await searchDuckDuckGo(query, searchOptions);
                    break;
                    
                case 'google':
                    logger.info({ engine: 'google', query }, 'Trying Google search (browser-based)');
                    results = await searchGoogle(query, searchOptions);
                    break;
                    
                case 'bing':
                    logger.info({ engine: 'bing', query }, 'Trying Bing search (browser-based)');
                    results = await searchBingAPI(query, searchOptions);
                    break;
                    
                default:
                    logger.warn({ engine }, 'Unknown search engine, skipping');
                    continue;
            }

            if (results && results.length > 0) {
                logger.info({ 
                    engine, 
                    resultCount: results.length,
                    sites: results.map(r => r.siteName),
                }, 'Search successful');
                
                return { 
                    engine, 
                    results,
                    fallbackUsed: engine !== engines[0],
                };
            }
            
            logger.info({ engine }, 'No results from engine, trying next');
            
        } catch (err) {
            errors.push({ engine, error: err.message });
            logger.warn({ engine, error: err.message }, 'Search engine failed, trying next');
        }
    }

    // All engines failed
    logger.error({ 
        productName, 
        errors,
        enginesAttempted: engines,
    }, 'All search engines failed');

    return { 
        engine: 'none', 
        results: [],
        errors,
    };
}

/**
 * Get search engine status (which engines are available)
 * All engines are FREE and use browser-based scraping (no API keys required)
 */
export function getSearchEngineStatus() {
    return {
        duckduckgo: {
            enabled: true,
            type: 'browser-scraping',
            cost: 'FREE',
            notes: 'Most reliable, uses HTML version with minimal bot detection',
        },
        google: {
            enabled: true,
            type: 'browser-scraping',
            cost: 'FREE',
            notes: 'May show CAPTCHA under heavy use - use as fallback',
        },
        bing: {
            enabled: true,
            type: 'browser-scraping',
            cost: 'FREE',
            notes: 'May show CAPTCHA under heavy use - use as fallback',
        },
        configuredOrder: SEARCH_CONFIG.engines,
        allFree: true,
        apiKeysRequired: false,
    };
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

// Keep backward compatibility - export searchBing as alias for searchDuckDuckGo
export const searchBing = searchDuckDuckGo;

export default {
    searchDuckDuckGo,
    searchGoogle,
    searchBingAPI,
    searchBing: searchDuckDuckGo,  // Alias for backward compatibility
    searchProduct,
    searchProductWithFallback,
    getKnownEcommerceDomains,
    addEcommerceDomain,
    getSearchEngineStatus,
};

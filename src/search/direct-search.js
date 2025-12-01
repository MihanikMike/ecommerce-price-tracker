/**
 * Direct E-commerce Site Search
 * 
 * Instead of using search engines (which often block automated access),
 * this module searches directly on e-commerce sites.
 * 
 * Benefits:
 * - More reliable than search engine scraping
 * - Gets actual product pages, not search result links
 * - Less likely to be blocked (though still possible)
 * - More accurate pricing information
 */

import { fetchPage, releaseBrowser } from "../utils/fetch-page.js";
import logger from "../utils/logger.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import { retry } from "../utils/retry.js";

/**
 * E-commerce site search configurations
 * Each site has its own search URL pattern and result selectors
 */
const SITE_SEARCH_CONFIGS = {
    // Target - generally more scraping-friendly
    target: {
        name: 'Target',
        domain: 'target.com',
        searchUrl: (query) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
        resultSelector: '[data-test="product-grid"] > div',
        extractProduct: async (element) => {
            const titleEl = await element.$('[data-test="product-title"]');
            const priceEl = await element.$('[data-test="current-price"]');
            const linkEl = await element.$('a[href*="/p/"]');
            
            return {
                title: titleEl ? await titleEl.textContent() : null,
                price: priceEl ? await priceEl.textContent() : null,
                url: linkEl ? await linkEl.getAttribute('href') : null,
            };
        },
        priority: 9,
    },
    
    // Best Buy
    bestbuy: {
        name: 'Best Buy',
        domain: 'bestbuy.com',
        searchUrl: (query) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`,
        resultSelector: '.sku-item',
        extractProduct: async (element) => {
            const titleEl = await element.$('.sku-title a');
            const priceEl = await element.$('.priceView-customer-price span');
            
            return {
                title: titleEl ? await titleEl.textContent() : null,
                price: priceEl ? await priceEl.textContent() : null,
                url: titleEl ? await titleEl.getAttribute('href') : null,
            };
        },
        priority: 9,
    },
    
    // Walmart - Updated selectors for 2024+ layout
    walmart: {
        name: 'Walmart',
        domain: 'walmart.com',
        searchUrl: (query) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
        // Multiple result container selectors for different layouts
        resultSelector: '[data-testid="list-view"], [data-item-id], div[data-automation-id="product-item"]',
        extractProduct: async (element) => {
            // Try multiple title selectors
            let titleEl = await element.$('[data-automation-id="product-title"]');
            if (!titleEl) titleEl = await element.$('span[data-automation-id="product-title"]');
            if (!titleEl) titleEl = await element.$('[data-testid="product-title"]');
            if (!titleEl) titleEl = await element.$('a[link-identifier] span');
            if (!titleEl) titleEl = await element.$('.w_iUH7');
            
            // Try multiple price selectors
            let priceEl = await element.$('[data-automation-id="product-price"] .f2');
            if (!priceEl) priceEl = await element.$('[data-automation-id="product-price"] span.w_iUH7');
            if (!priceEl) priceEl = await element.$('[data-testid="current-price"]');
            if (!priceEl) priceEl = await element.$('[itemprop="price"]');
            if (!priceEl) priceEl = await element.$('span[aria-hidden="true"]');
            if (!priceEl) priceEl = await element.$('.price-main');
            
            // Try multiple link selectors
            let linkEl = await element.$('a[link-identifier]');
            if (!linkEl) linkEl = await element.$('a[href*="/ip/"]');
            if (!linkEl) linkEl = await element.$('a[data-testid="product-link"]');
            if (!linkEl) linkEl = await element.$('a');
            
            // Get URL and ensure full path
            let url = linkEl ? await linkEl.getAttribute('href') : null;
            if (url && !url.startsWith('http')) {
                url = `https://www.walmart.com${url}`;
            }
            
            return {
                title: titleEl ? await titleEl.textContent() : null,
                price: priceEl ? await priceEl.textContent() : null,
                url: url,
            };
        },
        priority: 9,
    },
    
    // Newegg - tech-focused, often more accessible
    newegg: {
        name: 'Newegg',
        domain: 'newegg.com',
        searchUrl: (query) => `https://www.newegg.com/p/pl?d=${encodeURIComponent(query)}`,
        resultSelector: '.item-cell',
        extractProduct: async (element) => {
            const titleEl = await element.$('.item-title');
            const priceEl = await element.$('.price-current');
            
            return {
                title: titleEl ? await titleEl.textContent() : null,
                price: priceEl ? await priceEl.textContent() : null,
                url: titleEl ? await titleEl.getAttribute('href') : null,
            };
        },
        priority: 8,
    },
    
    // B&H Photo
    bhphoto: {
        name: 'B&H Photo',
        domain: 'bhphotovideo.com',
        searchUrl: (query) => `https://www.bhphotovideo.com/c/search?q=${encodeURIComponent(query)}`,
        resultSelector: '[data-selenium="miniProductPage"]',
        extractProduct: async (element) => {
            const titleEl = await element.$('[data-selenium="miniProductPageProductName"]');
            // Try multiple price selectors
            let priceEl = await element.$('[data-selenium="pricingPrice"]');
            if (!priceEl) {
                priceEl = await element.$('[class*="price"]');
            }
            const linkEl = await element.$('a[data-selenium="miniProductPageProductImgLink"]');
            
            return {
                title: titleEl ? await titleEl.textContent() : null,
                price: priceEl ? await priceEl.textContent() : null,
                url: linkEl ? await linkEl.getAttribute('href') : null,
            };
        },
        priority: 8,
    },
    
    // REI - outdoor gear (Note: REI blocks automated access, may not work)
    rei: {
        name: 'REI',
        domain: 'rei.com',
        searchUrl: (query) => `https://www.rei.com/search?q=${encodeURIComponent(query)}`,
        blocked: true, // REI blocks automated browsers
        resultSelector: '[data-ui="search-results"] li',
        extractProduct: async (element) => {
            const titleEl = await element.$('h2');
            const priceEl = await element.$('[data-ui="sale-price"], [data-ui="price"]');
            const linkEl = await element.$('a');
            
            return {
                title: titleEl ? await titleEl.textContent() : null,
                price: priceEl ? await priceEl.textContent() : null,
                url: linkEl ? await linkEl.getAttribute('href') : null,
            };
        },
        priority: 8,
    },
};

/**
 * Generic fallback selectors for unknown sites
 */
const GENERIC_SELECTORS = {
    products: [
        '.product', '.product-item', '.product-card',
        '[class*="product"]', '[data-product]',
        '.item', '.listing-item',
    ],
    title: [
        '.product-title', '.product-name', '.item-title',
        'h2', 'h3', '[class*="title"]', '[class*="name"]',
    ],
    price: [
        '.price', '.product-price', '.current-price',
        '[class*="price"]', '[data-price]',
    ],
    link: [
        'a[href*="/product"]', 'a[href*="/p/"]', 'a[href*="/dp/"]',
        'a', // fallback to first link
    ],
};

/**
 * Search a specific e-commerce site with retry logic
 * 
 * @param {string} siteKey - Key from SITE_SEARCH_CONFIGS
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of products found
 */
export async function searchSite(siteKey, query, options = {}) {
    const config = SITE_SEARCH_CONFIGS[siteKey];
    if (!config) {
        throw new Error(`Unknown site: ${siteKey}`);
    }
    
    // Check if site is known to block automated access
    if (config.blocked) {
        logger.warn({ site: config.name }, 'Site blocks automated access, skipping');
        return [];
    }
    
    const { maxResults = 5, retries = 2 } = options;
    
    // Wrap the search in retry logic for timeout handling
    return retry(
        () => performSiteSearch(siteKey, config, query, maxResults),
        {
            retries,
            minDelay: 2000,
            maxDelay: 10000,
            shouldRetry: (error) => {
                // Retry on timeouts and network errors
                const isTimeout = error.message?.includes('timeout') || 
                                  error.message?.includes('Timeout') ||
                                  error.name === 'TimeoutError';
                const isNetwork = error.message?.includes('net::') ||
                                  error.message?.includes('Network') ||
                                  error.message?.includes('ECONNREFUSED');
                const shouldRetry = isTimeout || isNetwork;
                
                if (shouldRetry) {
                    logger.info({ site: config.name, error: error.message }, 'Retrying site search');
                }
                return shouldRetry;
            },
        }
    );
}

/**
 * Internal function that performs the actual site search
 */
async function performSiteSearch(siteKey, config, query, maxResults) {
    const searchUrl = config.searchUrl(query);
    
    logger.info({ site: config.name, query, searchUrl }, 'Searching e-commerce site');
    
    // Apply rate limiting
    await rateLimiter.waitForRateLimit(searchUrl);
    
    let browserContext = null;
    
    try {
        // Use direct connection for e-commerce sites (proxies often blocked)
        browserContext = await fetchPage(searchUrl, { 
            useProxy: false,
            directFallback: true,
        });
        
        const { page } = browserContext;
        
        // Wait for products to load
        await page.waitForSelector(config.resultSelector, { timeout: 15000 }).catch(() => {
            logger.warn({ site: config.name }, 'Product selector not found');
        });
        
        // Small delay for dynamic content
        await page.waitForTimeout(2000);
        
        // Get product elements
        const elements = await page.$$(config.resultSelector);
        logger.info({ site: config.name, count: elements.length }, 'Found product elements');
        
        const products = [];
        
        for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
            try {
                const product = await config.extractProduct(elements[i]);
                
                if (product.title && product.url) {
                    // Normalize URL
                    if (product.url && !product.url.startsWith('http')) {
                        product.url = `https://www.${config.domain}${product.url}`;
                    }
                    
                    // Parse price
                    product.priceValue = parsePrice(product.price);
                    product.site = config.name;
                    product.domain = config.domain;
                    product.priority = config.priority;
                    
                    products.push(product);
                }
            } catch (err) {
                logger.debug({ error: err.message, index: i }, 'Failed to extract product');
            }
        }
        
        logger.info({ 
            site: config.name, 
            query,
            products: products.length 
        }, 'Site search completed');
        
        return products;
        
    } catch (err) {
        logger.error({ site: config.name, error: err.message }, 'Site search failed');
        throw err;
    } finally {
        if (browserContext) {
            await releaseBrowser(browserContext);
        }
    }
}

/**
 * Search multiple e-commerce sites in parallel
 * 
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Results from all sites
 */
export async function searchAllSites(query, options = {}) {
    const { 
        sites = Object.keys(SITE_SEARCH_CONFIGS),
        maxResults = 5,
        maxConcurrent = 2,  // Limit concurrent searches
    } = options;
    
    logger.info({ query, sites }, 'Starting multi-site search');
    
    const results = {
        query,
        sites: {},
        allProducts: [],
        errors: [],
    };
    
    // Search sites with limited concurrency
    const chunks = [];
    for (let i = 0; i < sites.length; i += maxConcurrent) {
        chunks.push(sites.slice(i, i + maxConcurrent));
    }
    
    for (const chunk of chunks) {
        const promises = chunk.map(async (siteKey) => {
            try {
                const products = await searchSite(siteKey, query, { maxResults });
                results.sites[siteKey] = {
                    success: true,
                    products,
                };
                results.allProducts.push(...products);
            } catch (err) {
                results.sites[siteKey] = {
                    success: false,
                    error: err.message,
                };
                results.errors.push({ site: siteKey, error: err.message });
            }
        });
        
        await Promise.all(promises);
        
        // Small delay between chunks
        if (chunks.indexOf(chunk) < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    // Sort all products by priority
    results.allProducts.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    logger.info({
        query,
        totalProducts: results.allProducts.length,
        successfulSites: Object.values(results.sites).filter(s => s.success).length,
        failedSites: results.errors.length,
    }, 'Multi-site search completed');
    
    return results;
}

/**
 * Parse price string to number
 */
function parsePrice(priceStr) {
    if (!priceStr) return null;
    
    // Extract numbers from price string
    const match = priceStr.match(/[\d,]+\.?\d*/);
    if (match) {
        return parseFloat(match[0].replace(/,/g, ''));
    }
    return null;
}

/**
 * Get list of available sites
 */
export function getAvailableSites() {
    return Object.entries(SITE_SEARCH_CONFIGS).map(([key, config]) => ({
        key,
        name: config.name,
        domain: config.domain,
        priority: config.priority,
    }));
}

export default {
    searchSite,
    searchAllSites,
    getAvailableSites,
    SITE_SEARCH_CONFIGS,
};

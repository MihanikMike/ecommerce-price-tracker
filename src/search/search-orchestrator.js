/**
 * Search Orchestrator
 * 
 * Coordinates the complete search-based product tracking workflow:
 * 1. Search for product using DuckDuckGo
 * 2. Filter results to e-commerce URLs
 * 3. Scrape each URL for product data
 * 4. Match and score results
 * 5. Compare prices and return structured data
 * 
 * Integrates with:
 * - ProxyManager for rotation
 * - RateLimiter for polite scraping
 * - BrowserPool for resource management
 */

import { searchProduct, searchProductWithFallback } from "./search-engine.js";
import { scrapeProduct } from "./universal-scraper.js";
import { findBestMatch, comparePrices } from "./product-matcher.js";
import { detectSite, isSupportedSite } from "./site-registry.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import { getProxyStats, refreshProxyCache } from "../utils/proxy-manager.js";
import logger from "../utils/logger.js";

/**
 * Orchestrator configuration
 */
const CONFIG = {
    maxSearchResults: 10,      // Max URLs from search
    maxScrapedProducts: 5,     // Max products to actually scrape
    scrapeTimeout: 60000,      // Timeout per scrape
    minMatchScore: 30,         // Minimum match score to consider
    delayBetweenScrapes: 1500, // Delay between scrapes (ms)
    retryAttempts: 2,          // Retry failed scrapes
    parallelScrapes: 1,        // Concurrent scrapes (1 = sequential)
};

/**
 * Delay helper
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Filter and rank search results
 * @param {Array} searchResults - Raw search results
 * @param {Object} options - Filter options
 * @returns {Array} Filtered and ranked results
 */
function filterSearchResults(searchResults, options = {}) {
    const {
        maxResults = CONFIG.maxScrapedProducts,
        requireSupported = false,
        preferredSites = [],
    } = options;
    
    let filtered = searchResults;
    
    // Filter to supported sites only
    if (requireSupported) {
        filtered = filtered.filter(r => isSupportedSite(r.url));
    }
    
    // Boost preferred sites
    if (preferredSites.length > 0) {
        filtered = filtered.map(r => {
            const siteInfo = detectSite(r.url);
            const isPreferred = preferredSites.some(ps => 
                siteInfo?.name?.toLowerCase().includes(ps.toLowerCase()) ||
                r.url.toLowerCase().includes(ps.toLowerCase())
            );
            return {
                ...r,
                priority: isPreferred ? r.priority + 10 : r.priority
            };
        });
        
        filtered.sort((a, b) => b.priority - a.priority);
    }
    
    return filtered.slice(0, maxResults);
}

/**
 * Scrape a URL with retries
 * @param {string} url - URL to scrape
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object|null>} Scraped data or null
 */
async function scrapeWithRetry(url, retries = CONFIG.retryAttempts) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const data = await scrapeProduct(url);
            if (data) {
                return data;
            }
        } catch (err) {
            lastError = err;
            logger.warn({ url, attempt, error: err.message }, 'Scrape attempt failed');
            
            if (attempt < retries) {
                await delay(1000 * attempt);  // Exponential backoff
            }
        }
    }
    
    return null;
}

/**
 * Search for a product and scrape results
 * 
 * @param {string} productName - Product name to search
 * @param {Object} options - Search and scrape options
 * @returns {Promise<Object>} Complete search results
 */
export async function searchAndScrape(productName, options = {}) {
    const {
        keywords = [],
        maxResults = CONFIG.maxScrapedProducts,
        expectedPrice = null,
        preferredSites = [],
        includeUnavailable = true,
        trackingContext = null,  // For logging/metrics
    } = options;
    
    const startTime = Date.now();
    const context = trackingContext || { productName };
    
    logger.info({ ...context, keywords, maxResults }, 'Starting product search');
    
    // Check proxy availability
    const proxyStats = getProxyStats();
    if (proxyStats.working === 0) {
        logger.info('No working proxies, refreshing cache...');
        await refreshProxyCache();
    }
    
    const result = {
        query: productName,
        keywords,
        searchEngine: null,
        searchResults: [],
        scrapedProducts: [],
        bestMatch: null,
        priceComparison: null,
        errors: [],
        timing: {
            searchMs: 0,
            scrapeMs: 0,
            totalMs: 0,
        },
        stats: {
            urlsFound: 0,
            urlsScraped: 0,
            successfulScrapes: 0,
            failedScrapes: 0,
        },
    };
    
    try {
        // Step 1: Search for product URLs
        const searchStart = Date.now();
        
        const searchResult = await searchProductWithFallback(productName, {
            keywords,
            maxResults: CONFIG.maxSearchResults,
        });
        
        result.searchEngine = searchResult.engine;
        result.searchResults = searchResult.results;
        result.stats.urlsFound = searchResult.results.length;
        result.timing.searchMs = Date.now() - searchStart;
        
        logger.info({
            ...context,
            engine: searchResult.engine,
            resultsFound: searchResult.results.length,
        }, 'Search completed');
        
        if (searchResult.results.length === 0) {
            result.errors.push('No search results found');
            result.timing.totalMs = Date.now() - startTime;
            return result;
        }
        
        // Step 2: Filter and prioritize results
        const filteredResults = filterSearchResults(searchResult.results, {
            maxResults,
            preferredSites,
        });
        
        logger.info({
            ...context,
            filteredCount: filteredResults.length,
            sites: filteredResults.map(r => r.siteName),
        }, 'Filtered search results');
        
        // Step 3: Scrape each URL
        const scrapeStart = Date.now();
        
        for (const searchItem of filteredResults) {
            result.stats.urlsScraped++;
            
            try {
                logger.debug({ url: searchItem.url }, 'Scraping URL');
                
                const productData = await scrapeWithRetry(searchItem.url);
                
                if (productData) {
                    result.scrapedProducts.push({
                        ...productData,
                        searchTitle: searchItem.title,
                        searchSnippet: searchItem.snippet,
                    });
                    result.stats.successfulScrapes++;
                } else {
                    result.stats.failedScrapes++;
                    result.errors.push(`Failed to scrape: ${searchItem.url}`);
                }
                
            } catch (err) {
                result.stats.failedScrapes++;
                result.errors.push(`Error scraping ${searchItem.url}: ${err.message}`);
                logger.error({ url: searchItem.url, error: err.message }, 'Scrape error');
            }
            
            // Delay between scrapes
            if (filteredResults.indexOf(searchItem) < filteredResults.length - 1) {
                await delay(CONFIG.delayBetweenScrapes);
            }
        }
        
        result.timing.scrapeMs = Date.now() - scrapeStart;
        
        logger.info({
            ...context,
            scraped: result.stats.urlsScraped,
            successful: result.stats.successfulScrapes,
            failed: result.stats.failedScrapes,
        }, 'Scraping completed');
        
        // Step 4: Match and score results
        if (result.scrapedProducts.length > 0) {
            const matchResult = findBestMatch(
                productName,
                keywords,
                result.scrapedProducts,
                {
                    expectedPrice,
                    minScore: CONFIG.minMatchScore,
                    requireAvailable: !includeUnavailable,
                }
            );
            
            result.bestMatch = matchResult.bestMatch;
            
            // Add match scores to products
            result.scrapedProducts = matchResult.scoredResults;
        }
        
        // Step 5: Compare prices
        result.priceComparison = comparePrices(result.scrapedProducts);
        
        result.timing.totalMs = Date.now() - startTime;
        
        logger.info({
            ...context,
            totalTimeMs: result.timing.totalMs,
            productsFound: result.scrapedProducts.length,
            bestMatchScore: result.bestMatch?.matchScore,
            lowestPrice: result.priceComparison?.lowestPrice?.price,
        }, 'Search and scrape completed');
        
        return result;
        
    } catch (err) {
        result.errors.push(`Orchestration error: ${err.message}`);
        result.timing.totalMs = Date.now() - startTime;
        logger.error({ ...context, error: err }, 'Search orchestration failed');
        
        return result;
    }
}

/**
 * Search for a product and return only the best match
 * Simpler API for when you just need one result
 * 
 * @param {string} productName - Product name to search
 * @param {Object} options - Search options
 * @returns {Promise<Object|null>} Best matching product or null
 */
export async function findProduct(productName, options = {}) {
    const result = await searchAndScrape(productName, options);
    
    if (result.bestMatch) {
        return {
            product: result.bestMatch,
            alternatives: result.scrapedProducts.filter(p => p !== result.bestMatch),
            priceComparison: result.priceComparison,
        };
    }
    
    return null;
}

/**
 * Search for a product across specific sites only
 * 
 * @param {string} productName - Product name to search
 * @param {Array<string>} sites - Sites to search (e.g., ['amazon', 'walmart'])
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function searchProductOnSites(productName, sites, options = {}) {
    // Build site-specific search query
    const siteQueries = sites.map(site => `site:${site}.com`).join(' OR ');
    const fullQuery = `${productName} (${siteQueries})`;
    
    return searchAndScrape(productName, {
        ...options,
        preferredSites: sites,
    });
}

/**
 * Batch search for multiple products
 * 
 * @param {Array<Object>} products - Array of { name, keywords, expectedPrice }
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of search results
 */
export async function batchSearch(products, options = {}) {
    const {
        delayBetweenProducts = 5000,  // 5 seconds between products
        continueOnError = true,
    } = options;
    
    const results = [];
    
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
            logger.info({
                productIndex: i + 1,
                totalProducts: products.length,
                productName: product.name,
            }, 'Processing batch product');
            
            const result = await searchAndScrape(product.name, {
                keywords: product.keywords || [],
                expectedPrice: product.expectedPrice,
                trackingContext: { batchIndex: i },
            });
            
            results.push({
                input: product,
                result,
                success: result.scrapedProducts.length > 0,
            });
            
        } catch (err) {
            results.push({
                input: product,
                result: null,
                success: false,
                error: err.message,
            });
            
            if (!continueOnError) {
                throw err;
            }
        }
        
        // Delay between products (except last one)
        if (i < products.length - 1) {
            await delay(delayBetweenProducts);
        }
    }
    
    return results;
}

/**
 * Get orchestrator statistics
 */
export function getOrchestratorStats() {
    return {
        config: { ...CONFIG },
        proxyStats: getProxyStats(),
    };
}

export default {
    searchAndScrape,
    findProduct,
    searchProductOnSites,
    batchSearch,
    getOrchestratorStats,
};

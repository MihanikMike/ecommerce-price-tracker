/**
 * Search-Based Price Monitor
 * 
 * New monitoring workflow that:
 * 1. Takes a product name (no URL required)
 * 2. Searches for the product across e-commerce sites
 * 3. Scrapes and compares prices
 * 4. Stores results for tracking over time
 * 
 * This works alongside the existing URL-based price-monitor.js
 */

import logger from "../utils/logger.js";
import { searchAndScrape } from "../search/search-orchestrator.js";
import { 
    getSearchProductsToCheck, 
    updateSearchResult,
    saveSearchResults,
    addSearchBasedProduct,
} from "../db/trackedProductsRepository.js";
import { upsertProductAndHistory } from "../db/productRepository.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import { recordScrape, recordPriceChange, monitoringCycleDuration, lastSuccessfulRun } from "../utils/metrics.js";
import config from "../config/index.js";

/**
 * Delay helper
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process a single search-based product
 * @param {Object} trackedProduct - Product from database
 * @returns {Promise<Object>} Processing result
 */
async function processSearchProduct(trackedProduct) {
    const { 
        id: trackedProductId, 
        product_name: productName, 
        site,
        search_keywords: keywords = [],
        last_found_url: lastFoundUrl,
    } = trackedProduct;
    
    logger.info({ 
        trackedProductId, 
        productName, 
        site,
        keywords 
    }, 'Processing search-based product');
    
    const startTime = Date.now();
    
    try {
        // Search and scrape
        const searchResult = await searchAndScrape(productName, {
            keywords: keywords || [],
            maxResults: 5,
            preferredSites: site !== 'any' ? [site] : [],
            trackingContext: { trackedProductId, productName },
        });
        
        const durationSeconds = (Date.now() - startTime) / 1000;
        
        // Check if we got results
        if (searchResult.scrapedProducts.length === 0) {
            logger.warn({ trackedProductId, productName }, 'No products found in search');
            
            await updateSearchResult(trackedProductId, {
                success: false,
            });
            
            recordScrape('search', false, durationSeconds);
            
            return {
                success: false,
                trackedProductId,
                productName,
                error: 'No products found',
                searchResults: 0,
            };
        }
        
        // Save all search results for comparison
        await saveSearchResults(
            trackedProductId, 
            productName, 
            searchResult.scrapedProducts
        );
        
        // Get the best match
        const bestMatch = searchResult.bestMatch;
        
        if (bestMatch) {
            // Update the tracked product with the best match info
            await updateSearchResult(trackedProductId, {
                lastFoundUrl: bestMatch.url,
                matchConfidence: bestMatch.matchScore,
                success: true,
            });
            
            // Save to product history (for price tracking over time)
            try {
                await upsertProductAndHistory({
                    site: bestMatch.site,
                    url: bestMatch.url,
                    title: bestMatch.title,
                    price: bestMatch.price,
                    currency: bestMatch.currency,
                    timestamp: new Date(),
                });
            } catch (dbError) {
                logger.warn({ error: dbError, url: bestMatch.url }, 'Failed to save to product history');
            }
            
            recordScrape('search', true, durationSeconds);
        }
        
        logger.info({
            trackedProductId,
            productName,
            productsFound: searchResult.scrapedProducts.length,
            bestMatchTitle: bestMatch?.title?.substring(0, 50),
            bestMatchPrice: bestMatch?.price,
            bestMatchScore: bestMatch?.matchScore,
            lowestPrice: searchResult.priceComparison?.lowestPrice?.price,
            durationSeconds,
        }, 'Search product processed successfully');
        
        return {
            success: true,
            trackedProductId,
            productName,
            productsFound: searchResult.scrapedProducts.length,
            bestMatch: bestMatch ? {
                title: bestMatch.title,
                price: bestMatch.price,
                site: bestMatch.site,
                url: bestMatch.url,
                matchScore: bestMatch.matchScore,
            } : null,
            priceComparison: searchResult.priceComparison,
            durationSeconds,
        };
        
    } catch (error) {
        const durationSeconds = (Date.now() - startTime) / 1000;
        
        logger.error({ 
            error, 
            trackedProductId, 
            productName 
        }, 'Failed to process search product');
        
        await updateSearchResult(trackedProductId, {
            success: false,
        });
        
        recordScrape('search', false, durationSeconds);
        
        return {
            success: false,
            trackedProductId,
            productName,
            error: error.message,
            durationSeconds,
        };
    }
}

/**
 * Run the search-based price monitor
 * @param {Object} options - Monitor options
 * @returns {Promise<Object>} Monitoring results
 */
export async function runSearchMonitor(options = {}) {
    const {
        limit = 50,
        delayBetweenProducts = 10000,  // 10 seconds between products
    } = options;
    
    const startTime = Date.now();
    logger.info({ limit }, 'Starting search-based price monitoring cycle');
    
    // Load search-based products from database
    const trackedProducts = await getSearchProductsToCheck(limit);
    
    if (trackedProducts.length === 0) {
        logger.info('No search-based products found to check');
        return { 
            total: 0, 
            successful: 0, 
            failed: 0,
            results: [],
        };
    }
    
    logger.info({ count: trackedProducts.length }, 'Loaded search-based products from database');
    
    const results = {
        total: trackedProducts.length,
        successful: 0,
        failed: 0,
        results: [],
    };
    
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 3;
    
    for (const trackedProduct of trackedProducts) {
        try {
            const result = await processSearchProduct(trackedProduct);
            results.results.push(result);
            
            if (result.success) {
                results.successful++;
                consecutiveFailures = 0;
            } else {
                results.failed++;
                consecutiveFailures++;
            }
            
            // Circuit breaker
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                logger.error({ consecutiveFailures }, 'Too many consecutive failures, stopping search cycle');
                break;
            }
            
            // Delay between products
            if (trackedProducts.indexOf(trackedProduct) < trackedProducts.length - 1) {
                logger.debug({ delayMs: delayBetweenProducts }, 'Waiting before next search');
                await delay(delayBetweenProducts);
            }
            
        } catch (error) {
            logger.error({ 
                error, 
                productName: trackedProduct.product_name 
            }, 'Unexpected error processing search product');
            
            results.failed++;
            consecutiveFailures++;
            
            results.results.push({
                success: false,
                trackedProductId: trackedProduct.id,
                productName: trackedProduct.product_name,
                error: error.message,
            });
            
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                logger.error({ consecutiveFailures }, 'Too many consecutive failures, stopping search cycle');
                break;
            }
        }
    }
    
    const duration = Date.now() - startTime;
    const durationSeconds = duration / 1000;
    
    // Record metrics
    monitoringCycleDuration.observe(durationSeconds);
    if (results.successful > 0) {
        lastSuccessfulRun.set(Date.now() / 1000);
    }
    
    logger.info({ 
        results: {
            total: results.total,
            successful: results.successful,
            failed: results.failed,
        }, 
        durationMs: duration 
    }, 'Search-based price monitoring cycle completed');
    
    return results;
}

/**
 * Quick search for a product (one-off, not tracked)
 * @param {string} productName - Product name to search
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results with price comparison
 */
export async function quickSearch(productName, options = {}) {
    logger.info({ productName }, 'Performing quick search');
    
    const result = await searchAndScrape(productName, {
        keywords: options.keywords || [],
        maxResults: options.maxResults || 5,
        preferredSites: options.preferredSites || [],
    });
    
    return {
        query: productName,
        productsFound: result.scrapedProducts.length,
        bestMatch: result.bestMatch,
        priceComparison: result.priceComparison,
        allProducts: result.scrapedProducts,
        timing: result.timing,
    };
}

/**
 * Add a product to search-based tracking
 * @param {string} productName - Product name
 * @param {Object} options - Tracking options
 * @returns {Promise<number>} Tracked product ID
 */
export async function trackProduct(productName, options = {}) {
    const {
        site = 'any',
        keywords = [],
        checkIntervalMinutes = 60,
    } = options;
    
    const id = await addSearchBasedProduct({
        productName,
        site,
        keywords,
        enabled: true,
        checkIntervalMinutes,
    });
    
    logger.info({ id, productName, site }, 'Product added to search-based tracking');
    
    return id;
}

export default {
    runSearchMonitor,
    quickSearch,
    trackProduct,
};

import logger from "../utils/logger.js";
import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import { upsertProductAndHistory, getAllProductsWithLatestPrice } from "../db/productRepository.js";
import { getProductsToCheck, updateProductCheckTime } from "../db/trackedProductsRepository.js";
import { exportToJSON } from "../services/exportService.js";
import { retry } from "../utils/retry.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import { recordScrapeAttempt, recordError } from "../server/health-server.js";
import { recordScrape, recordPriceChange, recordRateLimitDelay, lastSuccessfulRun, monitoringCycleDuration } from "../utils/metrics.js";
import config from "../config/index.js";

/**
 * Get site name from URL for metrics
 */
function getSiteFromUrl(url) {
    if (url.includes("amazon.com")) return 'amazon';
    if (url.includes("burton.com")) return 'burton';
    return 'unknown';
}

/**
 * Determine which scraper to use based on URL
 */
function getScraperForUrl(url) {
    if (url.includes("amazon.com")) return { name: 'Amazon', scraper: scrapeAmazon };
    if (url.includes("burton.com")) return { name: 'Burton', scraper: scrapeBurton };
    return null;
}

/**
 * Scrape a single product with retry logic and rate limiting
 */
async function scrapeProductWithRetry(url) {
    const scraperInfo = getScraperForUrl(url);
    const site = getSiteFromUrl(url);
    
    if (!scraperInfo) {
        logger.warn({ url }, 'No scraper available for URL');
        return null;
    }

    // Wait for rate limit before making request
    const delayApplied = await rateLimiter.waitForRateLimit(url);
    logger.debug({ url, delayMs: delayApplied, site: scraperInfo.name }, 'Rate limit delay applied');
    
    // Record rate limit delay in metrics
    if (delayApplied > 0) {
        recordRateLimitDelay(site, delayApplied / 1000);
    }

    const startTime = Date.now();
    
    try {
        const data = await retry(
            () => scraperInfo.scraper(url),
            {
                retries: config.scraper.retries,
                minDelay: config.scraper.minDelay,
                maxDelay: config.scraper.maxDelay,
            }
        );

        const durationSeconds = (Date.now() - startTime) / 1000;

        // Report success to rate limiter
        if (data) {
            rateLimiter.reportSuccess(url);
            recordScrapeAttempt(true);
            recordScrape(site, true, durationSeconds);
        } else {
            recordScrapeAttempt(false);
            recordScrape(site, false, durationSeconds);
        }

        return data;
        
    } catch (error) {
        const durationSeconds = (Date.now() - startTime) / 1000;
        
        // Report error to rate limiter (may increase backoff)
        rateLimiter.reportError(url, error);
        recordScrapeAttempt(false);
        recordError(error);
        recordScrape(site, false, durationSeconds);
        logger.error({ error, url, scraper: scraperInfo.name }, 'Failed to scrape product after retries');
        return null;
    }
}

/**
 * Process a single product: scrape and save
 */
async function processProduct(trackedProduct) {
    const { id: trackedProductId, url } = trackedProduct;
    logger.info({ url, trackedProductId }, 'Processing product');

    const data = await scrapeProductWithRetry(url);

    if (!data) {
        logger.warn({ url, trackedProductId }, 'Scraping returned no data, skipping');
        await updateProductCheckTime(trackedProductId, false);
        return false;
    }

    try {
        const productId = await upsertProductAndHistory(data);
        await updateProductCheckTime(trackedProductId, true);
        logger.info({ productId, trackedProductId, url, title: data.title, price: data.price }, 'Product saved successfully');
        return true;
        
    } catch (error) {
        logger.error({ error, url, trackedProductId }, 'Failed to save product to database');
        await updateProductCheckTime(trackedProductId, false);
        return false;
    }
}

/**
 * Main price monitoring function
 */
export async function runPriceMonitor() {
    const startTime = Date.now();
    logger.info('Starting price monitoring cycle');

    // Load products from database
    const trackedProducts = await getProductsToCheck(100);
    
    if (trackedProducts.length === 0) {
        logger.warn('No products found to check. Run seed script to add products.');
        return { total: 0, successful: 0, failed: 0 };
    }

    logger.info({ count: trackedProducts.length }, 'Loaded products from database');

    const results = {
        total: trackedProducts.length,
        successful: 0,
        failed: 0,
    };

    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    for (const trackedProduct of trackedProducts) {
        try {
            const success = await processProduct(trackedProduct);
            
            if (success) {
                results.successful++;
                consecutiveFailures = 0; // Reset on success
            } else {
                results.failed++;
                consecutiveFailures++;
            }

            // Circuit breaker: stop if too many consecutive failures
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                logger.error({ consecutiveFailures }, 'Too many consecutive failures, stopping scraping cycle');
                break;
            }

            // Rate limiting: delay between requests
            const delayMs = Math.floor(
                Math.random() * (config.scraper.maxDelay - config.scraper.minDelay) + config.scraper.minDelay
            );
            logger.debug({ delayMs }, 'Waiting before next request');
            await delay(delayMs);
            
        } catch (error) {
            logger.error({ error, url: trackedProduct.url }, 'Unexpected error processing product');
            results.failed++;
            consecutiveFailures++;
            
            // Circuit breaker check
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                logger.error({ consecutiveFailures }, 'Too many consecutive failures, stopping scraping cycle');
                break;
            }
        }
    }

    // Export results
    try {
        const products = await getAllProductsWithLatestPrice();
        await exportToJSON(products, 'products.json');
        logger.info({ count: products.length }, 'Products exported to JSON');
    } catch (error) {
        logger.error({ error }, 'Failed to export products');
    }

    const duration = Date.now() - startTime;
    const durationSeconds = duration / 1000;
    
    // Record metrics
    monitoringCycleDuration.observe(durationSeconds);
    if (results.successful > 0) {
        lastSuccessfulRun.set(Date.now() / 1000);
    }
    
    logger.info({ results, durationMs: duration }, 'Price monitoring cycle completed');

    return results;
}
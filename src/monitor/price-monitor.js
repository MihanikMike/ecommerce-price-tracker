import logger from "../utils/logger.js";
import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import { upsertProductAndHistory, getAllProductsWithLatestPrice } from "../db/productRepository.js";
import { exportToJSON } from "../services/exportService.js";
import { retry } from "../utils/retry.js";
import { delay } from "../utils/delay.js";
import config from "../config/index.js";

// Product URLs - TODO: Move to database
const PRODUCT_URLS = [
    "https://www.amazon.com/dp/B0DHS3B7S1",
    "https://www.amazon.com/dp/B0DHS5F4PZ",
    "https://www.burton.com/us/en/p/mens-burton-freestyle-reflex-snowboard-bindings/W26-105441B27ORG00M.html"
];

/**
 * Determine which scraper to use based on URL
 */
function getScraperForUrl(url) {
    if (url.includes("amazon.com")) return { name: 'Amazon', scraper: scrapeAmazon };
    if (url.includes("burton.com")) return { name: 'Burton', scraper: scrapeBurton };
    return null;
}

/**
 * Scrape a single product with retry logic
 */
async function scrapeProductWithRetry(url) {
    const scraperInfo = getScraperForUrl(url);
    
    if (!scraperInfo) {
        logger.warn({ url }, 'No scraper available for URL');
        return null;
    }

    try {
        const data = await retry(
            () => scraperInfo.scraper(url),
            {
                retries: config.scraper.retries,
                minDelay: config.scraper.minDelay,
                maxDelay: config.scraper.maxDelay,
            }
        );

        return data;
        
    } catch (error) {
        logger.error({ error, url, scraper: scraperInfo.name }, 'Failed to scrape product after retries');
        return null;
    }
}

/**
 * Process a single product: scrape and save
 */
async function processProduct(url) {
    logger.info({ url }, 'Processing product');

    const data = await scrapeProductWithRetry(url);

    if (!data) {
        logger.warn({ url }, 'Scraping returned no data, skipping');
        return false;
    }

    try {
        const productId = await upsertProductAndHistory(data);
        logger.info({ productId, url, title: data.title, price: data.price }, 'Product saved successfully');
        return true;
        
    } catch (error) {
        logger.error({ error, url }, 'Failed to save product to database');
        return false;
    }
}

/**
 * Main price monitoring function
 */
export async function runPriceMonitor() {
    const startTime = Date.now();
    logger.info('Starting price monitoring cycle');

    const results = {
        total: PRODUCT_URLS.length,
        successful: 0,
        failed: 0,
    };

    for (const url of PRODUCT_URLS) {
        try {
            const success = await processProduct(url);
            
            if (success) {
                results.successful++;
            } else {
                results.failed++;
            }

            // Rate limiting: delay between requests
            const delayMs = Math.floor(
                Math.random() * (config.scraper.maxDelay - config.scraper.minDelay) + config.scraper.minDelay
            );
            logger.debug({ delayMs }, 'Waiting before next request');
            await delay(delayMs);
            
        } catch (error) {
            logger.error({ error, url }, 'Unexpected error processing product');
            results.failed++;
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
    logger.info({ results, durationMs: duration }, 'Price monitoring cycle completed');

    return results;
}
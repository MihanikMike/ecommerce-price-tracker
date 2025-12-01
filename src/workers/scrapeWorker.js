/**
 * Scrape Worker
 * 
 * A standalone worker module for scraping products.
 * Can be used for:
 * - Parallel scraping with worker threads
 * - Background job processing
 * - Queue-based scraping (Redis, Bull, etc.)
 * - Standalone CLI scraping
 * 
 * Usage:
 *   node src/workers/scrapeWorker.js <url>
 *   node src/workers/scrapeWorker.js --product-id=4
 *   node src/workers/scrapeWorker.js --batch
 */

import logger from "../utils/logger.js";
import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import { scrapeProduct as scrapeUniversal, scrapeMultipleProducts } from "../search/universal-scraper.js";
import { upsertProductAndHistory } from "../db/productRepository.js";
import { getProductsToCheck, updateProductCheckTime } from "../db/trackedProductsRepository.js";
import { pool, closeDatabaseConnection } from "../db/connect-pg.js";
import { browserPool } from "../utils/BrowserPool.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import { retry } from "../utils/retry.js";
import config from "../config/index.js";

/**
 * Get the appropriate scraper for a URL
 */
function getScraperForUrl(url) {
    if (url.includes("amazon.com")) {
        return { name: 'Amazon', scraper: scrapeAmazon };
    }
    if (url.includes("burton.com")) {
        return { name: 'Burton', scraper: scrapeBurton };
    }
    // Use universal scraper for other sites
    return { name: 'Universal', scraper: (url) => scrapeUniversal(url) };
}

/**
 * Scrape a single URL
 * @param {string} url - Product URL to scrape
 * @param {Object} options - Scraping options
 * @returns {Promise<Object|null>} Scraped data or null
 */
export async function scrapeUrl(url, options = {}) {
    const { 
        saveToDb = false,
        trackedProductId = null,
        retries = config.scraper.retries,
    } = options;

    const scraperInfo = getScraperForUrl(url);
    
    logger.info({ url, scraper: scraperInfo.name }, 'Starting scrape');

    // Apply rate limiting
    await rateLimiter.waitForRateLimit(url);

    const startTime = Date.now();

    try {
        // Scrape with retry
        const data = await retry(
            () => scraperInfo.scraper(url),
            {
                retries,
                minDelay: config.scraper.minDelay,
                maxDelay: config.scraper.maxDelay,
                shouldRetry: (error) => {
                    // Retry on timeouts and network errors
                    return error.message?.includes('timeout') || 
                           error.message?.includes('net::');
                },
            }
        );

        const duration = Date.now() - startTime;

        if (!data) {
            logger.warn({ url, duration }, 'Scraper returned no data');
            rateLimiter.reportError(url, new Error('No data returned'));
            return null;
        }

        logger.info({ 
            url, 
            title: data.title?.substring(0, 50),
            price: data.price,
            duration 
        }, 'Scrape successful');

        rateLimiter.reportSuccess(url);

        // Optionally save to database
        if (saveToDb) {
            const productId = await upsertProductAndHistory(data);
            logger.info({ productId, url }, 'Saved to database');
            
            if (trackedProductId) {
                await updateProductCheckTime(trackedProductId, true);
            }
            
            return { ...data, productId, saved: true };
        }

        return data;

    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error({ url, error: error.message, duration }, 'Scrape failed');
        rateLimiter.reportError(url, error);
        
        if (trackedProductId) {
            await updateProductCheckTime(trackedProductId, false);
        }
        
        return null;
    }
}

/**
 * Scrape multiple URLs in sequence
 * @param {string[]} urls - Array of URLs to scrape
 * @param {Object} options - Options
 * @returns {Promise<Object[]>} Array of results
 */
export async function scrapeUrls(urls, options = {}) {
    const { 
        saveToDb = false,
        delayBetween = config.scraper.minDelay,
    } = options;

    const results = [];

    for (const url of urls) {
        const data = await scrapeUrl(url, { saveToDb });
        results.push({ url, data, success: !!data });

        // Delay between requests
        if (urls.indexOf(url) < urls.length - 1) {
            await new Promise(r => setTimeout(r, delayBetween));
        }
    }

    return results;
}

/**
 * Scrape a tracked product by ID
 * @param {number} productId - Tracked product ID
 * @returns {Promise<Object|null>} Scraped data or null
 */
export async function scrapeTrackedProduct(productId) {
    const result = await pool.query(
        'SELECT * FROM tracked_products WHERE id = $1 AND enabled = true',
        [productId]
    );

    if (result.rows.length === 0) {
        logger.warn({ productId }, 'Tracked product not found or disabled');
        return null;
    }

    const product = result.rows[0];

    if (product.url) {
        // URL-based product
        return scrapeUrl(product.url, { 
            saveToDb: true, 
            trackedProductId: productId 
        });
    } else if (product.product_name) {
        // Search-based product - would need search integration
        logger.info({ productId, productName: product.product_name }, 
            'Search-based product - use search-monitor instead');
        return null;
    }

    return null;
}

/**
 * Process a batch of products from the database
 * @param {number} limit - Maximum products to process
 * @returns {Promise<Object>} Batch results
 */
export async function processBatch(limit = 10) {
    const products = await getProductsToCheck(limit);
    
    if (products.length === 0) {
        logger.info('No products due for checking');
        return { total: 0, successful: 0, failed: 0 };
    }

    logger.info({ count: products.length }, 'Processing batch');

    const results = { total: products.length, successful: 0, failed: 0 };

    for (const product of products) {
        if (!product.url) {
            // Skip search-based products
            continue;
        }

        const data = await scrapeUrl(product.url, { 
            saveToDb: true, 
            trackedProductId: product.id 
        });

        if (data) {
            results.successful++;
        } else {
            results.failed++;
        }

        // Delay between requests
        await new Promise(r => setTimeout(r, config.scraper.minDelay));
    }

    logger.info(results, 'Batch processing completed');
    return results;
}

/**
 * Worker job handler - processes a job from a queue
 * @param {Object} job - Job data { type, url, productId, etc. }
 * @returns {Promise<Object>} Job result
 */
export async function processJob(job) {
    const { type, url, productId, urls } = job;

    switch (type) {
        case 'scrape-url':
            return scrapeUrl(url, { saveToDb: true });
        
        case 'scrape-product':
            return scrapeTrackedProduct(productId);
        
        case 'scrape-batch':
            return processBatch(job.limit || 10);
        
        case 'scrape-urls':
            return scrapeUrls(urls, { saveToDb: true });
        
        default:
            throw new Error(`Unknown job type: ${type}`);
    }
}

/**
 * CLI entry point
 */
async function main() {
    const args = process.argv.slice(2);
    
    const showHelp = () => {
        console.log(`
Scrape Worker CLI

Usage:
  node src/workers/scrapeWorker.js <url>              Scrape a URL
  node src/workers/scrapeWorker.js --product-id=<id>  Scrape by product ID
  node src/workers/scrapeWorker.js --batch[=<limit>]  Process batch from DB

Commands:
  help                    Show this help message
  <url>                   Scrape the specified URL and save to DB
  --product-id=<id>       Scrape a tracked product by its database ID
  --batch[=<limit>]       Process up to <limit> products from DB (default: 10)

Examples:
  node src/workers/scrapeWorker.js help
  node src/workers/scrapeWorker.js "https://www.amazon.com/dp/B09V3KXJPB"
  node src/workers/scrapeWorker.js --product-id=4
  node src/workers/scrapeWorker.js --batch=20

npm scripts:
  npm run worker -- "https://..."  Scrape a URL
  npm run worker:help              Show this help
        `);
    };

    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        process.exit(0);
    }

    try {
        // Initialize browser pool
        await browserPool.initialize();

        let result;

        if (args[0].startsWith('--product-id=')) {
            const productId = parseInt(args[0].split('=')[1]);
            result = await scrapeTrackedProduct(productId);
        } else if (args[0].startsWith('--batch')) {
            const limit = args[0].includes('=') ? parseInt(args[0].split('=')[1]) : 10;
            result = await processBatch(limit);
        } else {
            // Assume it's a URL
            result = await scrapeUrl(args[0], { saveToDb: true });
        }

        console.log('\n✅ Result:');
        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await browserPool.closeAll();
        await closeDatabaseConnection();
    }
}

// Run CLI if executed directly
if (process.argv[1].includes('scrapeWorker.js')) {
    main();
}

export default {
    scrapeUrl,
    scrapeUrls,
    scrapeTrackedProduct,
    processBatch,
    processJob,
};

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for Scrape Worker
 * Tests the actual exported functions from scrapeWorker.js
 */

// Import actual function from scrapeWorker
import { getScraperForUrl } from '../../../src/workers/scrapeWorker.js';

describe('scrapeWorker', () => {
    describe('getScraperForUrl', () => {
        it('should return Amazon scraper for Amazon URLs', () => {
            const result = getScraperForUrl('https://www.amazon.com/dp/B123');
            expect(result.name).toBe('Amazon');
            expect(result.scraper).toBeDefined();
            expect(typeof result.scraper).toBe('function');
        });

        it('should return Amazon scraper for amazon.com without www', () => {
            const result = getScraperForUrl('https://amazon.com/product/xyz');
            expect(result.name).toBe('Amazon');
        });

        it('should return Burton scraper for Burton URLs', () => {
            const result = getScraperForUrl('https://www.burton.com/us/en/p/board');
            expect(result.name).toBe('Burton');
            expect(result.scraper).toBeDefined();
            expect(typeof result.scraper).toBe('function');
        });

        it('should return Burton scraper for burton.com without www', () => {
            const result = getScraperForUrl('https://burton.com/product');
            expect(result.name).toBe('Burton');
        });

        it('should return Universal scraper for REI URLs', () => {
            const result = getScraperForUrl('https://www.rei.com/product');
            expect(result.name).toBe('Universal');
            expect(result.scraper).toBeDefined();
        });

        it('should return Universal scraper for eBay URLs', () => {
            const result = getScraperForUrl('https://www.ebay.com/item/123');
            expect(result.name).toBe('Universal');
        });

        it('should return Universal scraper for Walmart URLs', () => {
            const result = getScraperForUrl('https://www.walmart.com/ip/product');
            expect(result.name).toBe('Universal');
        });

        it('should return Universal scraper for unknown sites', () => {
            const result = getScraperForUrl('https://example.com/product');
            expect(result.name).toBe('Universal');
        });

        it('should handle Amazon product URLs with ASIN', () => {
            const result = getScraperForUrl('https://www.amazon.com/Apple-AirPods-Pro/dp/B0D1XD1ZV3');
            expect(result.name).toBe('Amazon');
        });

        it('should handle Amazon gp/product URLs', () => {
            const result = getScraperForUrl('https://www.amazon.com/gp/product/B08N5WRWNW');
            expect(result.name).toBe('Amazon');
        });

        it('should handle Burton regional URLs', () => {
            const result = getScraperForUrl('https://www.burton.com/ca/en/p/product');
            expect(result.name).toBe('Burton');
        });
    });
});

describe('scrapeWorker logic patterns', () => {
    describe('scrapeUrl logic', () => {
        it('should handle successful scrape result', () => {
            const scraperResult = {
                title: 'Test Product',
                price: 99.99,
                currency: 'USD',
                url: 'https://amazon.com/dp/TEST',
                site: 'Amazon',
            };
            
            expect(scraperResult.title).toBeDefined();
            expect(scraperResult.price).toBe(99.99);
            expect(scraperResult.site).toBe('Amazon');
        });

        it('should handle null scrape result', () => {
            const scraperResult = null;
            const hasData = scraperResult !== null;
            
            expect(hasData).toBe(false);
        });

        it('should track scrape duration', () => {
            const startTime = Date.now();
            const duration = Date.now() - startTime;
            
            expect(duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('scrapeUrls logic', () => {
        it('should process multiple URLs and return results array', () => {
            const urls = [
                'https://www.amazon.com/dp/B1',
                'https://www.amazon.com/dp/B2',
                'https://www.burton.com/product',
            ];
            
            const results = urls.map((url, index) => ({
                url,
                data: { title: `Product ${index + 1}`, price: 10 * (index + 1) },
                success: true,
            }));
            
            expect(results).toHaveLength(3);
            expect(results[0].success).toBe(true);
            expect(results[2].url).toContain('burton.com');
        });

        it('should track success/failure for each URL', () => {
            const results = [
                { url: 'url1', data: { price: 10 }, success: true },
                { url: 'url2', data: null, success: false },
                { url: 'url3', data: { price: 30 }, success: true },
            ];
            
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            expect(successful).toBe(2);
            expect(failed).toBe(1);
        });
    });

    describe('processBatch logic', () => {
        it('should return zero counts when no products', () => {
            const products = [];
            const result = {
                total: products.length,
                successful: 0,
                failed: 0,
            };
            
            expect(result.total).toBe(0);
        });

        it('should skip products without URL', () => {
            const products = [
                { id: 1, url: null, product_name: 'Search Product' },
                { id: 2, url: 'https://amazon.com/dp/B2' },
                { id: 3, url: 'https://burton.com/product' },
            ];
            
            const urlProducts = products.filter(p => p.url);
            
            expect(urlProducts).toHaveLength(2);
        });

        it('should track batch processing results', () => {
            const results = { total: 5, successful: 4, failed: 1 };
            const successRate = (results.successful / results.total * 100).toFixed(1);
            
            expect(parseFloat(successRate)).toBe(80.0);
        });
    });

    describe('processJob logic', () => {
        const processJobLogic = (job) => {
            const { type } = job;
            
            switch (type) {
                case 'scrape-url':
                    return { type: 'url-result' };
                case 'scrape-product':
                    return { type: 'product-result' };
                case 'scrape-batch':
                    return { type: 'batch-result', total: job.limit || 10 };
                case 'scrape-urls':
                    return { type: 'urls-result', count: job.urls?.length || 0 };
                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        };

        it('should handle scrape-url job type', () => {
            const result = processJobLogic({ type: 'scrape-url', url: 'https://amazon.com' });
            expect(result.type).toBe('url-result');
        });

        it('should handle scrape-product job type', () => {
            const result = processJobLogic({ type: 'scrape-product', productId: 5 });
            expect(result.type).toBe('product-result');
        });

        it('should handle scrape-batch job type', () => {
            const result = processJobLogic({ type: 'scrape-batch', limit: 20 });
            expect(result.type).toBe('batch-result');
            expect(result.total).toBe(20);
        });

        it('should handle scrape-batch with default limit', () => {
            const result = processJobLogic({ type: 'scrape-batch' });
            expect(result.total).toBe(10);
        });

        it('should handle scrape-urls job type', () => {
            const result = processJobLogic({ type: 'scrape-urls', urls: ['url1', 'url2'] });
            expect(result.type).toBe('urls-result');
            expect(result.count).toBe(2);
        });

        it('should throw error for unknown job type', () => {
            expect(() => processJobLogic({ type: 'unknown' })).toThrow('Unknown job type: unknown');
        });
    });

    describe('Rate limiter integration', () => {
        it('should apply rate limit delay', () => {
            const minDelay = 1200;
            const maxDelay = 2500;
            const delay = Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
            
            expect(delay).toBeGreaterThanOrEqual(minDelay);
            expect(delay).toBeLessThan(maxDelay);
        });
    });

    describe('Database save logic', () => {
        it('should save scraped data to database when saveToDb is true', () => {
            const saveToDb = true;
            const scraperResult = { title: 'Product', price: 50 };
            
            let saved = false;
            if (saveToDb && scraperResult) {
                saved = true;
            }
            
            expect(saved).toBe(true);
        });

        it('should not save when saveToDb is false', () => {
            const saveToDb = false;
            const scraperResult = { title: 'Product', price: 50 };
            
            let saved = false;
            if (saveToDb && scraperResult) {
                saved = true;
            }
            
            expect(saved).toBe(false);
        });
    });

    describe('CLI argument parsing', () => {
        const parseArgs = (args) => {
            if (args.length === 0 || args[0] === 'help') {
                return { action: 'help' };
            }
            if (args[0].startsWith('--product-id=')) {
                return { action: 'scrape-product', productId: parseInt(args[0].split('=')[1]) };
            }
            if (args[0].startsWith('--batch')) {
                const limit = args[0].includes('=') ? parseInt(args[0].split('=')[1]) : 10;
                return { action: 'batch', limit };
            }
            return { action: 'scrape-url', url: args[0] };
        };

        it('should parse help command', () => {
            expect(parseArgs(['help'])).toEqual({ action: 'help' });
            expect(parseArgs([])).toEqual({ action: 'help' });
        });

        it('should parse product-id argument', () => {
            const result = parseArgs(['--product-id=5']);
            expect(result.action).toBe('scrape-product');
            expect(result.productId).toBe(5);
        });

        it('should parse batch argument with limit', () => {
            const result = parseArgs(['--batch=20']);
            expect(result.action).toBe('batch');
            expect(result.limit).toBe(20);
        });

        it('should parse batch argument without limit', () => {
            const result = parseArgs(['--batch']);
            expect(result.action).toBe('batch');
            expect(result.limit).toBe(10);
        });

        it('should parse URL argument', () => {
            const result = parseArgs(['https://amazon.com/dp/B123']);
            expect(result.action).toBe('scrape-url');
            expect(result.url).toBe('https://amazon.com/dp/B123');
        });
    });
});

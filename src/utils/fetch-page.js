import { getNextProxy, refreshProxyCache, markProxyFailed, getProxyStats } from "./proxy-manager.js";
import { randomUA } from "./useragents.js";
import { browserPool } from "./BrowserPool.js";
import logger from "./logger.js";

/** Maximum retries with different proxies */
const MAX_PROXY_RETRIES = 3;

/**
 * Fetch a page using a browser from the pool
 * @param {string} url - URL to fetch
 * @param {Object} options - Options for fetching
 * @returns {Object} { page, context, browser } - Must call releaseBrowser() when done
 */
export async function fetchPage(url, options = {}) {
    let lastError = null;
    let proxyUsed = null;
    
    // Try with proxy rotation
    for (let attempt = 0; attempt < MAX_PROXY_RETRIES; attempt++) {
        // Get proxy from manager if enabled
        let proxy = null;
        if (options.useProxy !== false) {
            proxy = getNextProxy();  // Use rotation instead of random
            if (!proxy && attempt === 0) {
                await refreshProxyCache();
                proxy = getNextProxy();
            }
            if (proxy) {
                logger.debug({ proxy, attempt: attempt + 1 }, 'Using proxy for request');
                proxyUsed = proxy;
            }
        }
        
        const userAgent = randomUA();

        // Acquire browser from pool
        const browser = await browserPool.acquire();

        try {
            const context = await browser.newContext({
                userAgent,
                viewport: { width: 1920, height: 1080 },
                locale: 'en-US',
                timezoneId: 'America/New_York',
                proxy: proxy ? { server: proxy } : undefined,
            });

            const page = await context.newPage();

            // Minimal delay before navigation
            if (options.antiBot !== false) {
                await page.waitForTimeout(Math.floor(Math.random() * 500 + 500));
            }

            // Navigate to page
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for body to be ready
            await page.waitForSelector('body', { timeout: 15000 });

            return { page, context, browser, proxyUsed };
        } catch (error) {
            lastError = error;
            
            // Release browser back to pool on error
            browserPool.release(browser);
            
            // Mark proxy as failed and try again
            if (proxy) {
                markProxyFailed(proxy);
                logger.warn({ 
                    proxy, 
                    attempt: attempt + 1, 
                    error: error.message 
                }, 'Proxy failed, trying next');
            }
            
            // If it's not a proxy-related error, don't retry
            const isProxyError = error.message.includes('proxy') || 
                                 error.message.includes('ECONNREFUSED') ||
                                 error.message.includes('ETIMEDOUT') ||
                                 error.message.includes('ECONNRESET');
            
            if (!isProxyError && !proxy) {
                throw error;
            }
        }
    }
    
    // All retries failed
    logger.error({ 
        url, 
        attempts: MAX_PROXY_RETRIES,
        proxyStats: getProxyStats()
    }, 'All proxy attempts failed');
    
    throw lastError || new Error('Failed to fetch page after proxy retries');
}

/**
 * Release browser back to the pool after use
 * @param {Object} param - { page, context, browser } from fetchPage
 */
export async function releaseBrowser({ page, context, browser }) {
    try {
        if (page && !page.isClosed()) {
            await page.close();
        }
        if (context) {
            await context.close();
        }
    } catch (error) {
        logger.error({ error }, 'Error closing page/context');
    } finally {
        // Always release browser back to pool
        if (browser) {
            browserPool.release(browser);
        }
    }
}
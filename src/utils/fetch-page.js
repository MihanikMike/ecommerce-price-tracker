import { getNextProxy, refreshProxyCache, markProxyFailed, getProxyStats } from "./proxy-manager.js";
import { randomUA } from "./useragents.js";
import { browserPool } from "./BrowserPool.js";
import logger from "./logger.js";

/** Maximum retries with different proxies */
const MAX_PROXY_RETRIES = 3;

/** Timeout for proxy connections (faster fail) */
const PROXY_TIMEOUT = 15000;

/** Timeout for direct connections (more patient) */
const DIRECT_TIMEOUT = 30000;

/**
 * Try to fetch with a specific configuration (proxy or direct)
 * @private
 */
async function tryFetch(url, options, proxy = null) {
    const userAgent = randomUA();
    const browser = await browserPool.acquire();
    const timeout = proxy ? PROXY_TIMEOUT : DIRECT_TIMEOUT;
    
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

        // Navigate to page (use shorter timeout for proxies)
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

        // Wait for body to be ready
        await page.waitForSelector('body', { timeout: 10000 });

        return { page, context, browser, proxyUsed: proxy };
    } catch (error) {
        // Release browser back to pool on error
        browserPool.release(browser);
        throw error;
    }
}

/**
 * Fetch a page using a browser from the pool
 * @param {string} url - URL to fetch
 * @param {Object} options - Options for fetching
 * @returns {Object} { page, context, browser } - Must call releaseBrowser() when done
 */
export async function fetchPage(url, options = {}) {
    let lastError = null;
    
    // Skip proxy attempts if explicitly disabled
    const useProxy = options.useProxy !== false;
    const allowDirectFallback = options.directFallback !== false;
    
    // Try with proxy rotation
    if (useProxy) {
        for (let attempt = 0; attempt < MAX_PROXY_RETRIES; attempt++) {
            let proxy = getNextProxy();
            if (!proxy && attempt === 0) {
                await refreshProxyCache();
                proxy = getNextProxy();
            }
            
            if (!proxy) {
                logger.info('No proxies available, will try direct connection');
                break;
            }
            
            logger.debug({ proxy, attempt: attempt + 1 }, 'Using proxy for request');
            
            try {
                return await tryFetch(url, options, proxy);
            } catch (error) {
                lastError = error;
                
                // Mark proxy as failed
                markProxyFailed(proxy);
                logger.warn({ 
                    proxy, 
                    attempt: attempt + 1, 
                    error: error.message 
                }, 'Proxy failed, trying next');
                
                // Browser crash - don't count against retries, just continue
                const isBrowserError = error.message.includes('Target page, context or browser has been closed') ||
                                       error.message.includes('Browser has been closed');
                if (isBrowserError) {
                    logger.warn('Browser crashed, will retry with fresh browser');
                }
            }
        }
    }
    
    // Try direct connection as fallback
    if (allowDirectFallback) {
        logger.info({ url }, 'Trying direct connection (no proxy)');
        try {
            return await tryFetch(url, options, null);
        } catch (error) {
            lastError = error;
            logger.error({ url, error: error.message }, 'Direct connection also failed');
        }
    }
    
    // All attempts failed
    logger.error({ 
        url, 
        attempts: useProxy ? MAX_PROXY_RETRIES : 0,
        directTried: allowDirectFallback,
        proxyStats: getProxyStats()
    }, 'All fetch attempts failed');
    
    throw lastError || new Error('Failed to fetch page');
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
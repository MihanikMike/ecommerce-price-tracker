/**
 * Universal Product Scraper
 * 
 * A generic scraper that can extract product data from any e-commerce site
 * by using site-specific selectors or falling back to generic patterns.
 * 
 * Features:
 * - Automatic site detection
 * - Fallback selector chains
 * - Schema.org/JSON-LD extraction
 * - Proxy rotation integration
 */

import { fetchPage, releaseBrowser } from "../utils/fetch-page.js";
import { detectSite, getSelectorsForUrl } from "./site-registry.js";
import { rateLimiter } from "../utils/rate-limiter.js";
import logger from "../utils/logger.js";
import { validateScrapedData, logValidationErrors } from "../utils/validation.js";

/**
 * Try multiple selectors until one returns a value
 * @param {Page} page - Playwright page
 * @param {Array<string>} selectors - Array of CSS selectors
 * @param {string} fieldName - Field name for logging
 * @returns {Promise<string|null>} Extracted text or null
 */
async function trySelectors(page, selectors, fieldName) {
    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                const text = await element.innerText();
                if (text && text.trim()) {
                    logger.debug({ selector, fieldName }, 'Selector succeeded');
                    return text.trim();
                }
            }
        } catch (error) {
            logger.debug({ selector, fieldName, error: error.message }, 'Selector failed');
        }
    }
    
    logger.debug({ selectors, fieldName }, 'All selectors failed for field');
    return null;
}

/**
 * Extract product data from JSON-LD schema (Schema.org)
 * Many e-commerce sites include structured data
 * @param {Page} page - Playwright page
 * @returns {Promise<Object|null>} Extracted data or null
 */
async function extractSchemaOrg(page) {
    try {
        const scripts = await page.$$('script[type="application/ld+json"]');
        
        for (const script of scripts) {
            try {
                const content = await script.textContent();
                const data = JSON.parse(content);
                
                // Handle array of schemas
                const schemas = Array.isArray(data) ? data : [data];
                
                for (const schema of schemas) {
                    // Look for Product schema
                    if (schema['@type'] === 'Product' || 
                        schema['@type']?.includes('Product')) {
                        
                        const result = {
                            title: schema.name,
                            price: null,
                            currency: null,
                            availability: null,
                            image: schema.image,
                            brand: schema.brand?.name || schema.brand,
                            sku: schema.sku,
                            description: schema.description,
                        };
                        
                        // Extract price from offers
                        const offers = schema.offers || schema.Offers;
                        if (offers) {
                            const offer = Array.isArray(offers) ? offers[0] : offers;
                            result.price = parseFloat(offer.price || offer.lowPrice);
                            result.currency = offer.priceCurrency;
                            result.availability = offer.availability;
                        }
                        
                        if (result.title && result.price) {
                            logger.debug({ schema: 'Product' }, 'Extracted data from JSON-LD');
                            return result;
                        }
                    }
                }
            } catch (parseErr) {
                logger.debug({ error: parseErr.message }, 'Failed to parse JSON-LD script');
            }
        }
    } catch (err) {
        logger.debug({ error: err.message }, 'Failed to extract Schema.org data');
    }
    
    return null;
}

/**
 * Extract price from text
 * @param {string} text - Price text
 * @returns {number|null} Parsed price or null
 */
function parsePrice(text) {
    if (!text) return null;
    
    // Remove currency symbols and commas
    const cleaned = text.replace(/[^\d.,]/g, '');
    
    // Handle different formats: 1,234.56 or 1.234,56
    let price;
    if (cleaned.includes(',') && cleaned.includes('.')) {
        // Determine format by position of last separator
        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        
        if (lastComma > lastDot) {
            // European format: 1.234,56
            price = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        } else {
            // US format: 1,234.56
            price = parseFloat(cleaned.replace(/,/g, ''));
        }
    } else if (cleaned.includes(',')) {
        // Could be 1,234 (thousands) or 12,34 (decimal)
        const parts = cleaned.split(',');
        if (parts[parts.length - 1].length === 2) {
            // Likely decimal: 12,34
            price = parseFloat(cleaned.replace(',', '.'));
        } else {
            // Likely thousands: 1,234
            price = parseFloat(cleaned.replace(/,/g, ''));
        }
    } else {
        price = parseFloat(cleaned);
    }
    
    return isNaN(price) ? null : price;
}

/**
 * Detect currency from page
 * @param {Page} page - Playwright page
 * @param {string} priceText - Original price text
 * @returns {string} Detected currency code
 */
function detectCurrency(priceText) {
    if (!priceText) return 'USD';
    
    const currencyMap = {
        '$': 'USD',
        '€': 'EUR',
        '£': 'GBP',
        '¥': 'JPY',
        'C$': 'CAD',
        'A$': 'AUD',
        'CHF': 'CHF',
        'kr': 'SEK',
    };
    
    for (const [symbol, code] of Object.entries(currencyMap)) {
        if (priceText.includes(symbol)) {
            return code;
        }
    }
    
    return 'USD';  // Default
}

/**
 * Check product availability
 * @param {Page} page - Playwright page
 * @param {Array<string>} selectors - Availability selectors
 * @returns {Promise<Object>} Availability info
 */
async function checkAvailability(page, selectors) {
    const text = await trySelectors(page, selectors, 'availability');
    
    if (!text) {
        // Try to detect by add-to-cart button
        const cartButton = await page.$('button[id*="add-to-cart"], button[class*="add-to-cart"], [data-action="add-to-cart"]');
        if (cartButton) {
            return { available: true, text: 'In Stock' };
        }
        return { available: null, text: null };
    }
    
    const lowerText = text.toLowerCase();
    const available = !lowerText.includes('out of stock') && 
                      !lowerText.includes('unavailable') &&
                      !lowerText.includes('sold out') &&
                      !lowerText.includes('currently unavailable');
    
    return { available, text };
}

/**
 * Scrape product data from any URL
 * 
 * @param {string} url - Product URL to scrape
 * @param {Object} options - Scraping options
 * @returns {Promise<Object|null>} Product data or null
 */
export async function scrapeProduct(url, options = {}) {
    const {
        useSchemaOrg = true,
        customSelectors = null,
        useProxy = false,  // Default to direct connection (faster, more reliable)
    } = options;
    
    const siteInfo = detectSite(url);
    if (!siteInfo) {
        logger.error({ url }, 'Could not detect site for URL');
        return null;
    }
    
    // If site has a dedicated scraper, use it
    if (siteInfo.scraper) {
        logger.debug({ url, site: siteInfo.name }, 'Using dedicated scraper');
        return siteInfo.scraper(url);
    }
    
    // Otherwise, use generic scraping
    logger.info({ url, site: siteInfo.name }, 'Using universal scraper');
    
    // Apply rate limiting
    await rateLimiter.waitForRateLimit(url);
    
    let browserContext = null;
    
    try {
        browserContext = await fetchPage(url, { 
            useProxy: useProxy,
            directFallback: true,  // Always try direct if proxy fails
        });
        const { page } = browserContext;
        
        // Wait for page to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);  // Allow dynamic content
        
        let data = null;
        
        // Try Schema.org first (most reliable when available)
        if (useSchemaOrg) {
            data = await extractSchemaOrg(page);
        }
        
        // Fall back to selector-based extraction
        if (!data || !data.price) {
            const selectors = customSelectors || siteInfo.selectors;
            
            const title = await trySelectors(page, selectors.title, 'title');
            const priceText = await trySelectors(page, selectors.price, 'price');
            const availability = await checkAvailability(page, selectors.availability);
            
            if (!title) {
                throw new Error('Could not find product title');
            }
            
            if (!priceText) {
                throw new Error('Could not find product price');
            }
            
            const price = parsePrice(priceText);
            const currency = detectCurrency(priceText);
            
            data = {
                title,
                price,
                currency,
                availability: availability.text,
                available: availability.available,
            };
        }
        
        // Build final result
        const result = {
            site: siteInfo.name,
            url,
            title: data.title,
            price: data.price,
            currency: data.currency || 'USD',
            availability: data.availability,
            available: data.available,
            brand: data.brand,
            sku: data.sku,
            image: data.image,
            timestamp: new Date(),
            scrapedBy: 'universal',
        };
        
        // Validate
        const validation = validateScrapedData(result);
        if (!validation.valid) {
            logValidationErrors('scrapeProduct', validation.errors);
            logger.warn({ url, errors: validation.errors }, 'Validation failed');
            return null;
        }
        
        logger.info({ 
            url, 
            site: siteInfo.name,
            title: result.title,
            price: result.price 
        }, 'Universal scrape successful');
        
        return result;
        
    } catch (err) {
        logger.error({ error: err, url, site: siteInfo?.name }, 'Universal scraping failed');
        return null;
    } finally {
        if (browserContext) {
            await releaseBrowser(browserContext);
        }
    }
}

/**
 * Scrape multiple URLs in sequence with rate limiting
 * 
 * @param {Array<string>} urls - URLs to scrape
 * @param {Object} options - Scraping options
 * @returns {Promise<Array>} Array of results
 */
export async function scrapeMultipleProducts(urls, options = {}) {
    const {
        continueOnError = true,
        maxConcurrent = 1,  // Sequential by default for safety
    } = options;
    
    const results = [];
    
    for (const url of urls) {
        try {
            const data = await scrapeProduct(url, options);
            results.push({
                url,
                success: !!data,
                data,
                error: null,
            });
        } catch (err) {
            results.push({
                url,
                success: false,
                data: null,
                error: err.message,
            });
            
            if (!continueOnError) {
                throw err;
            }
        }
    }
    
    return results;
}

export default {
    scrapeProduct,
    scrapeMultipleProducts,
    parsePrice,
    detectCurrency,
};

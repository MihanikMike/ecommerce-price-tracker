/**
 * Site Registry
 * 
 * Centralized registry of supported e-commerce sites with:
 * - Domain patterns for detection
 * - Site-specific scraper functions
 * - Selector configurations
 * - Rate limit settings
 */

import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import logger from "../utils/logger.js";

/**
 * Selector configurations for product data extraction
 * Each site can have multiple selectors in priority order
 */
const SITE_SELECTORS = {
    amazon: {
        title: [
            "#productTitle",
            "#title",
            ".product-title-word-break",
            "h1.a-size-large",
            "h1 span#productTitle",
            "[data-feature-name='title'] h1",
            "h1"
        ],
        price: [
            ".a-price > .a-offscreen",
            "#priceblock_ourprice",
            "#priceblock_dealprice",
            ".a-price .a-offscreen:first-child",
            "span.a-price-whole",
            ".a-color-price",
            "#price_inside_buybox",
            ".apexPriceToPay .a-offscreen"
        ],
        availability: [
            "#availability span",
            "#outOfStock",
            ".a-color-success",
            "#add-to-cart-button"  // If exists, product is available
        ],
        image: [
            "#landingImage",
            "#imgBlkFront",
            ".a-dynamic-image"
        ]
    },
    
    burton: {
        title: [
            "h1.product-name",
            ".product-name",
            "h1.pdp-title",
            ".product-title",
            "[data-product-title]",
            "h1"
        ],
        price: [
            "span.standard-price",
            ".price-value",
            ".product-price",
            "[data-product-price]",
            ".price",
            "span[itemprop='price']",
            ".pdp-price"
        ],
        availability: [
            ".availability-message",
            ".in-stock",
            ".out-of-stock",
            "[data-availability]"
        ],
        image: [
            ".product-image img",
            "[data-product-image]",
            "img.primary-image"
        ]
    },
    
    // Generic selectors for unknown sites
    generic: {
        title: [
            "h1[itemprop='name']",
            "[itemprop='name']",
            "h1.product-title",
            "h1.product-name",
            ".product-title",
            ".product-name",
            "h1"
        ],
        price: [
            "[itemprop='price']",
            ".price",
            ".product-price",
            ".current-price",
            ".sale-price",
            ".regular-price",
            "[data-price]",
            ".price-value"
        ],
        availability: [
            "[itemprop='availability']",
            ".availability",
            ".stock-status",
            ".in-stock",
            ".out-of-stock"
        ],
        image: [
            "[itemprop='image']",
            ".product-image img",
            "#product-image",
            "img.product"
        ]
    },
    
    walmart: {
        title: [
            "h1[itemprop='name']",
            "h1.prod-ProductTitle",
            "[data-automation-id='product-title']",
            "h1"
        ],
        price: [
            "[itemprop='price']",
            ".price-characteristic",
            "[data-automation-id='product-price'] span",
            ".price-group"
        ],
        availability: [
            ".prod-fulfillment-shipping-text",
            "[data-automation-id='fulfillment-shipping']",
            ".fulfillment-shipping-text"
        ],
        image: [
            "[data-automation-id='hero-image'] img",
            ".hover-zoom-hero-image img"
        ]
    },
    
    target: {
        title: [
            "h1[data-test='product-title']",
            "h1.Heading",
            "[data-test='@web/ProductDetailPage/Title']",
            "h1"
        ],
        price: [
            "[data-test='product-price']",
            ".styles__CurrentPriceFontSize",
            "[data-test='@web/ProductDetailPage/SalePrice']"
        ],
        availability: [
            "[data-test='fulfillment-cell']",
            ".styles__StyledFulfillmentSection"
        ],
        image: [
            "[data-test='product-image'] img",
            "picture img"
        ]
    },
    
    bestbuy: {
        title: [
            ".sku-title h1",
            "h1.heading-5",
            "[data-track='product-title']",
            "h1"
        ],
        price: [
            ".priceView-hero-price span",
            ".priceView-customer-price span",
            "[data-track='product-price']"
        ],
        availability: [
            ".fulfillment-fulfillment-summary",
            "[data-track='pickup-availability']",
            ".add-to-cart-button"
        ],
        image: [
            ".primary-image",
            "img.product-image"
        ]
    },
    
    ebay: {
        title: [
            "h1.x-item-title__mainTitle",
            "h1[itemprop='name']",
            "#itemTitle",
            "h1"
        ],
        price: [
            ".x-price-primary span",
            "#prcIsum",
            "[itemprop='price']",
            ".vi-VR-cvipPrice"
        ],
        availability: [
            "#qtySubTxt",
            ".d-quantity__availability",
            "#vi-quantity"
        ],
        image: [
            "#icImg",
            "[data-zoom-src]",
            ".ux-image-magnify__container img"
        ]
    }
};

/**
 * Site configuration registry
 */
const SITE_REGISTRY = {
    amazon: {
        name: 'Amazon',
        domains: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr'],
        scraper: scrapeAmazon,
        selectors: SITE_SELECTORS.amazon,
        rateLimit: { minDelay: 2000, maxDelay: 5000 },
        currency: 'USD',
        supported: true
    },
    
    burton: {
        name: 'Burton',
        domains: ['burton.com'],
        scraper: scrapeBurton,
        selectors: SITE_SELECTORS.burton,
        rateLimit: { minDelay: 1000, maxDelay: 3000 },
        currency: 'USD',
        supported: true
    },
    
    walmart: {
        name: 'Walmart',
        domains: ['walmart.com'],
        scraper: null,  // Will use generic scraper
        selectors: SITE_SELECTORS.walmart,
        rateLimit: { minDelay: 2000, maxDelay: 4000 },
        currency: 'USD',
        supported: true
    },
    
    target: {
        name: 'Target',
        domains: ['target.com'],
        scraper: null,
        selectors: SITE_SELECTORS.target,
        rateLimit: { minDelay: 2000, maxDelay: 4000 },
        currency: 'USD',
        supported: true
    },
    
    bestbuy: {
        name: 'Best Buy',
        domains: ['bestbuy.com'],
        scraper: null,
        selectors: SITE_SELECTORS.bestbuy,
        rateLimit: { minDelay: 2000, maxDelay: 4000 },
        currency: 'USD',
        supported: true
    },
    
    ebay: {
        name: 'eBay',
        domains: ['ebay.com', 'ebay.co.uk'],
        scraper: null,
        selectors: SITE_SELECTORS.ebay,
        rateLimit: { minDelay: 1500, maxDelay: 3500 },
        currency: 'USD',
        supported: true
    },
    
    // Generic fallback for unknown sites
    generic: {
        name: 'Generic',
        domains: [],
        scraper: null,
        selectors: SITE_SELECTORS.generic,
        rateLimit: { minDelay: 2000, maxDelay: 5000 },
        currency: 'USD',
        supported: true
    }
};

/**
 * Detect site from URL
 * @param {string} url - URL to check
 * @returns {Object|null} Site configuration or null
 */
export function detectSite(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/^www\./, '').toLowerCase();
        
        for (const [siteKey, config] of Object.entries(SITE_REGISTRY)) {
            if (siteKey === 'generic') continue;
            
            if (config.domains.some(domain => hostname.includes(domain))) {
                logger.debug({ url, site: config.name }, 'Site detected');
                return { key: siteKey, ...config };
            }
        }
        
        // Return generic config for unknown sites
        logger.debug({ url, hostname }, 'Unknown site, using generic scraper');
        return { key: 'generic', ...SITE_REGISTRY.generic };
        
    } catch (err) {
        logger.error({ url, error: err.message }, 'Failed to parse URL');
        return null;
    }
}

/**
 * Get scraper function for a URL
 * @param {string} url - URL to scrape
 * @returns {Function|null} Scraper function or null
 */
export function getScraperForUrl(url) {
    const site = detectSite(url);
    if (!site) return null;
    
    return site.scraper;
}

/**
 * Get selectors for a URL
 * @param {string} url - URL to scrape
 * @returns {Object} Selector configuration
 */
export function getSelectorsForUrl(url) {
    const site = detectSite(url);
    return site?.selectors || SITE_SELECTORS.generic;
}

/**
 * Get rate limit config for a URL
 * @param {string} url - URL to check
 * @returns {Object} Rate limit configuration
 */
export function getRateLimitForUrl(url) {
    const site = detectSite(url);
    return site?.rateLimit || { minDelay: 2000, maxDelay: 5000 };
}

/**
 * Check if a URL is from a supported site
 * @param {string} url - URL to check
 * @returns {boolean} True if supported
 */
export function isSupportedSite(url) {
    const site = detectSite(url);
    return site?.supported === true;
}

/**
 * Get site name from URL
 * @param {string} url - URL to check
 * @returns {string} Site name
 */
export function getSiteName(url) {
    const site = detectSite(url);
    return site?.name || 'Unknown';
}

/**
 * Get all registered sites
 * @returns {Object} All site configurations
 */
export function getAllSites() {
    return { ...SITE_REGISTRY };
}

/**
 * Register a new site configuration
 * @param {string} key - Site key
 * @param {Object} config - Site configuration
 */
export function registerSite(key, config) {
    SITE_REGISTRY[key] = {
        ...SITE_REGISTRY.generic,
        ...config,
        supported: true
    };
    
    if (config.selectors) {
        SITE_SELECTORS[key] = config.selectors;
    }
    
    logger.info({ site: key, name: config.name }, 'Registered new site');
}

export default {
    detectSite,
    getScraperForUrl,
    getSelectorsForUrl,
    getRateLimitForUrl,
    isSupportedSite,
    getSiteName,
    getAllSites,
    registerSite,
    SITE_SELECTORS,
};

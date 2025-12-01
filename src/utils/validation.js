import logger from './logger.js';

/**
 * Validation utilities for user inputs and scraped data
 */

const SUPPORTED_SITES = ['Amazon', 'Burton'];
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const MAX_PRICE = 99999999.99; // Database limit: NUMERIC(10,2)
const MIN_PRICE = 0.01;
const MAX_TITLE_LENGTH = 1000;
const MIN_CHECK_INTERVAL = 1; // minutes
const MAX_CHECK_INTERVAL = 10080; // 1 week

/**
 * Validate URL format and domain
 */
export function validateURL(url) {
    const errors = [];
    
    if (!url || typeof url !== 'string') {
        errors.push('URL is required and must be a string');
        return { valid: false, errors };
    }
    
    // Trim whitespace
    url = url.trim();
    
    // Check basic URL format
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch (err) {
        errors.push('Invalid URL format');
        return { valid: false, errors };
    }
    
    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('URL must use HTTP or HTTPS protocol');
    }
    
    // Check if domain is supported
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAmazon = hostname.includes('amazon.com');
    const isBurton = hostname.includes('burton.com');
    
    if (!isAmazon && !isBurton) {
        errors.push('URL must be from supported domain (amazon.com or burton.com)');
    }
    
    return { 
        valid: errors.length === 0, 
        errors,
        sanitized: url 
    };
}

/**
 * Validate site name
 */
export function validateSite(site) {
    const errors = [];
    
    if (!site || typeof site !== 'string') {
        errors.push('Site is required and must be a string');
        return { valid: false, errors };
    }
    
    if (!SUPPORTED_SITES.includes(site)) {
        errors.push(`Site must be one of: ${SUPPORTED_SITES.join(', ')}`);
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Validate price value
 */
export function validatePrice(price) {
    const errors = [];
    
    if (price === null || price === undefined) {
        errors.push('Price is required');
        return { valid: false, errors };
    }
    
    // Convert to number if string
    if (typeof price === 'string') {
        price = parseFloat(price);
    }
    
    if (typeof price !== 'number' || isNaN(price)) {
        errors.push('Price must be a valid number');
        return { valid: false, errors };
    }
    
    if (!isFinite(price)) {
        errors.push('Price must be a finite number');
        return { valid: false, errors };
    }
    
    if (price < MIN_PRICE) {
        errors.push(`Price must be at least ${MIN_PRICE}`);
    }
    
    if (price > MAX_PRICE) {
        errors.push(`Price cannot exceed ${MAX_PRICE}`);
    }
    
    // Round to 2 decimal places
    const sanitized = Math.round(price * 100) / 100;
    
    return { valid: errors.length === 0, errors, sanitized };
}

/**
 * Validate currency code
 */
export function validateCurrency(currency) {
    const errors = [];
    
    if (!currency || typeof currency !== 'string') {
        errors.push('Currency is required and must be a string');
        return { valid: false, errors };
    }
    
    const upper = currency.toUpperCase();
    
    if (!SUPPORTED_CURRENCIES.includes(upper)) {
        errors.push(`Currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }
    
    return { valid: errors.length === 0, errors, sanitized: upper };
}

/**
 * Validate product title
 */
export function validateTitle(title) {
    const errors = [];
    
    if (!title || typeof title !== 'string') {
        errors.push('Title is required and must be a string');
        return { valid: false, errors };
    }
    
    const trimmed = title.trim();
    
    if (trimmed.length === 0) {
        errors.push('Title cannot be empty');
    }
    
    if (trimmed.length > MAX_TITLE_LENGTH) {
        errors.push(`Title cannot exceed ${MAX_TITLE_LENGTH} characters`);
    }
    
    return { valid: errors.length === 0, errors, sanitized: trimmed };
}

/**
 * Validate check interval (minutes)
 */
export function validateCheckInterval(minutes) {
    const errors = [];
    
    if (minutes === null || minutes === undefined) {
        errors.push('Check interval is required');
        return { valid: false, errors };
    }
    
    const num = parseInt(minutes, 10);
    
    if (isNaN(num)) {
        errors.push('Check interval must be a valid number');
        return { valid: false, errors };
    }
    
    if (num < MIN_CHECK_INTERVAL) {
        errors.push(`Check interval must be at least ${MIN_CHECK_INTERVAL} minute(s)`);
    }
    
    if (num > MAX_CHECK_INTERVAL) {
        errors.push(`Check interval cannot exceed ${MAX_CHECK_INTERVAL} minutes (1 week)`);
    }
    
    return { valid: errors.length === 0, errors, sanitized: num };
}

/**
 * Validate product ID
 */
export function validateProductId(id) {
    const errors = [];
    
    if (id === null || id === undefined) {
        errors.push('Product ID is required');
        return { valid: false, errors };
    }
    
    const num = parseInt(id, 10);
    
    if (isNaN(num) || num < 1) {
        errors.push('Product ID must be a positive integer');
        return { valid: false, errors };
    }
    
    return { valid: errors.length === 0, errors, sanitized: num };
}

/**
 * Validate complete scraped data object
 */
export function validateScrapedData(data) {
    const errors = [];
    const sanitized = {};
    
    if (!data || typeof data !== 'object') {
        errors.push('Data must be an object');
        return { valid: false, errors };
    }
    
    // Validate URL
    const urlResult = validateURL(data.url);
    if (!urlResult.valid) {
        errors.push(...urlResult.errors.map(e => `URL: ${e}`));
    } else {
        sanitized.url = urlResult.sanitized;
    }
    
    // Validate site
    const siteResult = validateSite(data.site);
    if (!siteResult.valid) {
        errors.push(...siteResult.errors.map(e => `Site: ${e}`));
    } else {
        sanitized.site = data.site;
    }
    
    // Validate title
    const titleResult = validateTitle(data.title);
    if (!titleResult.valid) {
        errors.push(...titleResult.errors.map(e => `Title: ${e}`));
    } else {
        sanitized.title = titleResult.sanitized;
    }
    
    // Validate price
    const priceResult = validatePrice(data.price);
    if (!priceResult.valid) {
        errors.push(...priceResult.errors.map(e => `Price: ${e}`));
    } else {
        sanitized.price = priceResult.sanitized;
    }
    
    // Validate currency (optional, defaults to USD)
    const currency = data.currency || 'USD';
    const currencyResult = validateCurrency(currency);
    if (!currencyResult.valid) {
        errors.push(...currencyResult.errors.map(e => `Currency: ${e}`));
    } else {
        sanitized.currency = currencyResult.sanitized;
    }
    
    return { 
        valid: errors.length === 0, 
        errors,
        sanitized: errors.length === 0 ? sanitized : null
    };
}

/**
 * Validate tracked product data
 */
export function validateTrackedProduct(data) {
    const errors = [];
    const sanitized = {};
    
    if (!data || typeof data !== 'object') {
        errors.push('Data must be an object');
        return { valid: false, errors };
    }
    
    // Validate URL
    const urlResult = validateURL(data.url);
    if (!urlResult.valid) {
        errors.push(...urlResult.errors.map(e => `URL: ${e}`));
    } else {
        sanitized.url = urlResult.sanitized;
    }
    
    // Validate site
    const siteResult = validateSite(data.site);
    if (!siteResult.valid) {
        errors.push(...siteResult.errors.map(e => `Site: ${e}`));
    } else {
        sanitized.site = data.site;
    }
    
    // Validate enabled (optional, defaults to true)
    if (data.enabled !== undefined) {
        if (typeof data.enabled !== 'boolean') {
            errors.push('Enabled must be a boolean');
        } else {
            sanitized.enabled = data.enabled;
        }
    } else {
        sanitized.enabled = true;
    }
    
    // Validate check interval (optional, defaults to 60)
    const intervalMinutes = data.checkIntervalMinutes || data.check_interval_minutes || 60;
    const intervalResult = validateCheckInterval(intervalMinutes);
    if (!intervalResult.valid) {
        errors.push(...intervalResult.errors.map(e => `Check interval: ${e}`));
    } else {
        sanitized.checkIntervalMinutes = intervalResult.sanitized;
    }
    
    return { 
        valid: errors.length === 0, 
        errors,
        sanitized: errors.length === 0 ? sanitized : null
    };
}

/**
 * Sanitize and log validation errors
 */
export function logValidationErrors(context, errors) {
    logger.warn({ context, errors: errors.join('; ') }, 'Validation failed');
}

export default {
    validateURL,
    validateSite,
    validatePrice,
    validateCurrency,
    validateTitle,
    validateCheckInterval,
    validateProductId,
    validateScrapedData,
    validateTrackedProduct,
    logValidationErrors
};

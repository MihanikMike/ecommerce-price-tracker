import logger from "./logger.js";

/**
 * Site-Specific Error Handler
 * 
 * Provides intelligent error classification and handling for different e-commerce sites.
 * Each site has unique error patterns (CAPTCHA, rate limits, selectors, etc.)
 */

// Error categories
export const ErrorCategory = {
    CAPTCHA: 'captcha',
    RATE_LIMIT: 'rate_limit',
    BLOCKED: 'blocked',
    NOT_FOUND: 'not_found',
    SELECTOR_FAILED: 'selector_failed',
    NETWORK: 'network',
    TIMEOUT: 'timeout',
    PARSE_ERROR: 'parse_error',
    AUTH_REQUIRED: 'auth_required',
    OUT_OF_STOCK: 'out_of_stock',
    GEO_BLOCKED: 'geo_blocked',
    UNKNOWN: 'unknown',
};

// Severity levels
export const ErrorSeverity = {
    LOW: 'low',           // Retry immediately
    MEDIUM: 'medium',     // Retry with backoff
    HIGH: 'high',         // Skip this URL, try others
    CRITICAL: 'critical', // Stop all requests to this site
};

// Site-specific error patterns
const siteErrorPatterns = {
    amazon: {
        captcha: [
            /captcha/i,
            /robot check/i,
            /automated access/i,
            /enter the characters/i,
            /sorry, we just need to make sure/i,
            /to discuss automated access/i,
        ],
        rateLimit: [
            /too many requests/i,
            /request was throttled/i,
            /slow down/i,
            /rate limit/i,
        ],
        blocked: [
            /access denied/i,
            /page not available/i,
            /something went wrong/i,
            /we're sorry/i,
        ],
        notFound: [
            /page not found/i,
            /dog.*404/i,
            /no longer available/i,
            /currently unavailable/i,
        ],
        outOfStock: [
            /currently unavailable/i,
            /out of stock/i,
            /not available/i,
        ],
    },
    burton: {
        captcha: [
            /verify you are human/i,
            /captcha/i,
        ],
        rateLimit: [
            /too many requests/i,
            /rate limit/i,
        ],
        blocked: [
            /access denied/i,
            /forbidden/i,
        ],
        notFound: [
            /page not found/i,
            /404/i,
            /product not found/i,
        ],
        outOfStock: [
            /sold out/i,
            /out of stock/i,
            /notify me/i,
        ],
    },
    target: {
        captcha: [
            /prove you're not a robot/i,
            /captcha/i,
            /verify/i,
        ],
        rateLimit: [
            /too many requests/i,
            /slow down/i,
        ],
        blocked: [
            /access denied/i,
            /something went wrong/i,
        ],
        notFound: [
            /page not found/i,
            /item not available/i,
        ],
    },
    walmart: {
        captcha: [
            /robot or human/i,
            /verify you're a human/i,
            /captcha/i,
            /press and hold/i,
        ],
        rateLimit: [
            /too many requests/i,
            /rate limit/i,
        ],
        blocked: [
            /access denied/i,
            /blocked/i,
        ],
        geoBlocked: [
            /not available in your location/i,
            /shipping restrictions/i,
        ],
    },
    bestbuy: {
        captcha: [
            /verify you're human/i,
            /captcha/i,
        ],
        rateLimit: [
            /too many requests/i,
        ],
        queuePage: [
            /you're in line/i,
            /queue/i,
            /high traffic/i,
        ],
    },
    default: {
        captcha: [
            /captcha/i,
            /robot/i,
            /verify/i,
            /human/i,
        ],
        rateLimit: [
            /429/i,
            /too many/i,
            /rate limit/i,
            /throttle/i,
        ],
        blocked: [
            /403/i,
            /forbidden/i,
            /access denied/i,
            /blocked/i,
        ],
        notFound: [
            /404/i,
            /not found/i,
        ],
        timeout: [
            /timeout/i,
            /timed out/i,
            /ETIMEDOUT/i,
            /ECONNRESET/i,
        ],
        network: [
            /ENOTFOUND/i,
            /ECONNREFUSED/i,
            /network/i,
            /connection/i,
        ],
    },
};

// Recommended actions based on error category
const errorActions = {
    [ErrorCategory.CAPTCHA]: {
        severity: ErrorSeverity.CRITICAL,
        retryable: false,
        cooldownMs: 300000, // 5 minutes
        recommendation: 'Stop requests to site, rotate proxy/IP, wait before retrying',
    },
    [ErrorCategory.RATE_LIMIT]: {
        severity: ErrorSeverity.HIGH,
        retryable: true,
        cooldownMs: 60000, // 1 minute
        recommendation: 'Increase delay between requests, use backoff',
    },
    [ErrorCategory.BLOCKED]: {
        severity: ErrorSeverity.HIGH,
        retryable: true,
        cooldownMs: 120000, // 2 minutes
        recommendation: 'Rotate proxy, change user agent',
    },
    [ErrorCategory.NOT_FOUND]: {
        severity: ErrorSeverity.LOW,
        retryable: false,
        cooldownMs: 0,
        recommendation: 'Mark product as unavailable, remove from tracking',
    },
    [ErrorCategory.SELECTOR_FAILED]: {
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        cooldownMs: 0,
        recommendation: 'Try alternative selectors, check if page layout changed',
    },
    [ErrorCategory.NETWORK]: {
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        cooldownMs: 5000,
        recommendation: 'Check network, rotate proxy',
    },
    [ErrorCategory.TIMEOUT]: {
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        cooldownMs: 10000,
        recommendation: 'Increase timeout, try different proxy',
    },
    [ErrorCategory.PARSE_ERROR]: {
        severity: ErrorSeverity.LOW,
        retryable: true,
        cooldownMs: 0,
        recommendation: 'Check page content format, update parser',
    },
    [ErrorCategory.AUTH_REQUIRED]: {
        severity: ErrorSeverity.HIGH,
        retryable: false,
        cooldownMs: 0,
        recommendation: 'Site requires login, cannot scrape this page',
    },
    [ErrorCategory.OUT_OF_STOCK]: {
        severity: ErrorSeverity.LOW,
        retryable: false,
        cooldownMs: 0,
        recommendation: 'Product out of stock, mark status, continue monitoring',
    },
    [ErrorCategory.GEO_BLOCKED]: {
        severity: ErrorSeverity.HIGH,
        retryable: true,
        cooldownMs: 60000,
        recommendation: 'Try proxy in different region',
    },
    [ErrorCategory.UNKNOWN]: {
        severity: ErrorSeverity.MEDIUM,
        retryable: true,
        cooldownMs: 30000,
        recommendation: 'Log for investigation, retry with caution',
    },
};

// Track site health
const siteHealth = new Map();

/**
 * Get site identifier from URL
 */
export function getSiteFromUrl(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('amazon.')) return 'amazon';
    if (urlLower.includes('burton.com')) return 'burton';
    if (urlLower.includes('target.com')) return 'target';
    if (urlLower.includes('walmart.com')) return 'walmart';
    if (urlLower.includes('bestbuy.com')) return 'bestbuy';
    if (urlLower.includes('newegg.com')) return 'newegg';
    if (urlLower.includes('bhphotovideo.com')) return 'bhphoto';
    if (urlLower.includes('rei.com')) return 'rei';
    return 'default';
}

/**
 * Classify an error for a specific site
 * @param {Error|string} error - The error to classify
 * @param {string} url - The URL that caused the error
 * @param {string} [pageContent] - Optional page HTML content for better classification
 * @returns {Object} Classification result
 */
export function classifyError(error, url, pageContent = null) {
    const site = getSiteFromUrl(url);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contentToCheck = pageContent || errorMessage;
    
    // Get patterns for this site (with fallback to default)
    const patterns = siteErrorPatterns[site] || siteErrorPatterns.default;
    const defaultPatterns = siteErrorPatterns.default;
    
    // Check for each error category
    for (const [category, categoryPatterns] of Object.entries(patterns)) {
        for (const pattern of categoryPatterns) {
            if (pattern.test(contentToCheck)) {
                const errorCat = mapCategoryName(category);
                return createClassification(errorCat, site, errorMessage, url);
            }
        }
    }
    
    // Check default patterns if not found in site-specific
    for (const [category, categoryPatterns] of Object.entries(defaultPatterns)) {
        for (const pattern of categoryPatterns) {
            if (pattern.test(contentToCheck)) {
                const errorCat = mapCategoryName(category);
                return createClassification(errorCat, site, errorMessage, url);
            }
        }
    }
    
    // Check for common error patterns
    if (errorMessage.includes('selector') || errorMessage.includes('Could not find')) {
        return createClassification(ErrorCategory.SELECTOR_FAILED, site, errorMessage, url);
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        return createClassification(ErrorCategory.TIMEOUT, site, errorMessage, url);
    }
    
    // Unknown error
    return createClassification(ErrorCategory.UNKNOWN, site, errorMessage, url);
}

/**
 * Map internal category names to ErrorCategory enum
 */
function mapCategoryName(name) {
    const mapping = {
        captcha: ErrorCategory.CAPTCHA,
        rateLimit: ErrorCategory.RATE_LIMIT,
        blocked: ErrorCategory.BLOCKED,
        notFound: ErrorCategory.NOT_FOUND,
        outOfStock: ErrorCategory.OUT_OF_STOCK,
        geoBlocked: ErrorCategory.GEO_BLOCKED,
        timeout: ErrorCategory.TIMEOUT,
        network: ErrorCategory.NETWORK,
        queuePage: ErrorCategory.RATE_LIMIT, // Treat queue pages as rate limits
    };
    return mapping[name] || ErrorCategory.UNKNOWN;
}

/**
 * Create classification result object
 */
function createClassification(category, site, errorMessage, url) {
    const action = errorActions[category];
    
    return {
        category,
        site,
        url,
        errorMessage,
        severity: action.severity,
        retryable: action.retryable,
        cooldownMs: action.cooldownMs,
        recommendation: action.recommendation,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Record an error for site health tracking
 */
export function recordSiteError(url, error, pageContent = null) {
    const classification = classifyError(error, url, pageContent);
    const site = classification.site;
    
    // Initialize site health if needed
    if (!siteHealth.has(site)) {
        siteHealth.set(site, {
            errors: [],
            totalErrors: 0,
            consecutiveErrors: 0,
            lastError: null,
            lastSuccess: null,
            cooldownUntil: null,
            status: 'healthy',
        });
    }
    
    const health = siteHealth.get(site);
    
    // Record error
    health.errors.push({
        ...classification,
        timestamp: Date.now(),
    });
    
    // Keep only last 100 errors
    if (health.errors.length > 100) {
        health.errors.shift();
    }
    
    health.totalErrors++;
    health.consecutiveErrors++;
    health.lastError = classification;
    
    // Update site status based on severity
    if (classification.severity === ErrorSeverity.CRITICAL) {
        health.status = 'critical';
        health.cooldownUntil = Date.now() + classification.cooldownMs;
    } else if (classification.severity === ErrorSeverity.HIGH && health.consecutiveErrors >= 3) {
        health.status = 'degraded';
        health.cooldownUntil = Date.now() + classification.cooldownMs;
    } else if (health.consecutiveErrors >= 5) {
        health.status = 'unhealthy';
    }
    
    // Log the classification
    logger.warn({
        site,
        category: classification.category,
        severity: classification.severity,
        retryable: classification.retryable,
        recommendation: classification.recommendation,
        consecutiveErrors: health.consecutiveErrors,
        siteStatus: health.status,
    }, `Site error classified: ${classification.category}`);
    
    return classification;
}

/**
 * Record a successful request for site health tracking
 */
export function recordSiteSuccess(url) {
    const site = getSiteFromUrl(url);
    
    if (!siteHealth.has(site)) {
        siteHealth.set(site, {
            errors: [],
            totalErrors: 0,
            consecutiveErrors: 0,
            lastError: null,
            lastSuccess: null,
            cooldownUntil: null,
            status: 'healthy',
        });
    }
    
    const health = siteHealth.get(site);
    health.consecutiveErrors = 0;
    health.lastSuccess = Date.now();
    
    // Recover status if it was degraded
    if (health.status === 'degraded' || health.status === 'unhealthy') {
        health.status = 'recovering';
    }
    
    // Full recovery after 3 consecutive successes tracked separately
    if (health.status === 'recovering') {
        health.status = 'healthy';
        health.cooldownUntil = null;
    }
}

/**
 * Check if a site is in cooldown period
 */
export function isSiteInCooldown(url) {
    const site = getSiteFromUrl(url);
    const health = siteHealth.get(site);
    
    if (!health || !health.cooldownUntil) {
        return { inCooldown: false };
    }
    
    const now = Date.now();
    if (now < health.cooldownUntil) {
        return {
            inCooldown: true,
            remainingMs: health.cooldownUntil - now,
            reason: health.lastError?.category,
        };
    }
    
    // Cooldown expired
    health.cooldownUntil = null;
    return { inCooldown: false };
}

/**
 * Get health status for a site
 */
export function getSiteHealth(site) {
    return siteHealth.get(site) || {
        status: 'unknown',
        errors: [],
        totalErrors: 0,
        consecutiveErrors: 0,
    };
}

/**
 * Get health status for all sites
 */
export function getAllSiteHealth() {
    const result = {};
    for (const [site, health] of siteHealth.entries()) {
        result[site] = {
            status: health.status,
            totalErrors: health.totalErrors,
            consecutiveErrors: health.consecutiveErrors,
            lastError: health.lastError ? {
                category: health.lastError.category,
                timestamp: health.lastError.timestamp,
            } : null,
            lastSuccess: health.lastSuccess,
            cooldownUntil: health.cooldownUntil,
        };
    }
    return result;
}

/**
 * Determine if an error should trigger a retry
 */
export function shouldRetry(error, url, attemptNumber = 1, maxAttempts = 3) {
    const classification = classifyError(error, url);
    
    // Don't retry if not retryable
    if (!classification.retryable) {
        return { shouldRetry: false, reason: classification.recommendation };
    }
    
    // Don't retry if max attempts reached
    if (attemptNumber >= maxAttempts) {
        return { shouldRetry: false, reason: 'Max retry attempts reached' };
    }
    
    // Don't retry if site is in critical cooldown
    const cooldown = isSiteInCooldown(url);
    if (cooldown.inCooldown && classification.severity === ErrorSeverity.CRITICAL) {
        return { 
            shouldRetry: false, 
            reason: `Site in cooldown for ${Math.round(cooldown.remainingMs / 1000)}s`,
        };
    }
    
    // Calculate recommended delay
    const baseDelay = classification.cooldownMs || 5000;
    const backoffDelay = baseDelay * Math.pow(2, attemptNumber - 1);
    
    return {
        shouldRetry: true,
        delayMs: Math.min(backoffDelay, 60000), // Max 1 minute
        reason: classification.recommendation,
    };
}

/**
 * Get a human-readable error summary
 */
export function getErrorSummary(error, url) {
    const classification = classifyError(error, url);
    
    return {
        site: classification.site,
        category: classification.category,
        severity: classification.severity,
        message: classification.errorMessage.substring(0, 200),
        retryable: classification.retryable,
        action: classification.recommendation,
    };
}

/**
 * Reset site health (useful for testing or manual recovery)
 */
export function resetSiteHealth(site = null) {
    if (site) {
        siteHealth.delete(site);
    } else {
        siteHealth.clear();
    }
}

export default {
    ErrorCategory,
    ErrorSeverity,
    classifyError,
    recordSiteError,
    recordSiteSuccess,
    isSiteInCooldown,
    getSiteHealth,
    getAllSiteHealth,
    shouldRetry,
    getErrorSummary,
    getSiteFromUrl,
    resetSiteHealth,
};

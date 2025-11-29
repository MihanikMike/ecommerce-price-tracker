import logger from './logger.js';

/**
 * Per-site rate limiter to prevent getting blocked
 * Each site has its own rate limit configuration and tracking
 */
class RateLimiter {
    constructor() {
        // Per-site rate limit configuration
        // Different sites have different tolerance for scraping
        this.siteConfigs = {
            'amazon.com': {
                minDelayMs: 2000,      // Minimum 2 seconds between requests
                maxDelayMs: 5000,      // Maximum 5 seconds (randomized)
                maxRequestsPerMinute: 10,
                backoffMultiplier: 2,  // Double delay on rate limit detection
                maxBackoffMs: 30000,   // Maximum 30 second delay
            },
            'burton.com': {
                minDelayMs: 1000,      // Burton is more tolerant
                maxDelayMs: 3000,
                maxRequestsPerMinute: 20,
                backoffMultiplier: 1.5,
                maxBackoffMs: 15000,
            },
            // Default for unknown sites
            'default': {
                minDelayMs: 3000,      // Conservative defaults
                maxDelayMs: 6000,
                maxRequestsPerMinute: 5,
                backoffMultiplier: 2,
                maxBackoffMs: 60000,
            }
        };

        // Track last request time per site
        this.lastRequestTime = new Map();
        
        // Track request counts per site (for rate limiting)
        this.requestCounts = new Map();
        
        // Track current backoff level per site
        this.backoffLevel = new Map();
        
        // Track consecutive errors per site
        this.consecutiveErrors = new Map();
    }

    /**
     * Get site key from URL
     */
    getSiteKey(url) {
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            // Match known sites
            if (hostname.includes('amazon.com')) return 'amazon.com';
            if (hostname.includes('burton.com')) return 'burton.com';
            return 'default';
        } catch (error) {
            return 'default';
        }
    }

    /**
     * Get configuration for a site
     */
    getConfig(siteKey) {
        return this.siteConfigs[siteKey] || this.siteConfigs['default'];
    }

    /**
     * Calculate delay before next request to a site
     */
    calculateDelay(url) {
        const siteKey = this.getSiteKey(url);
        const config = this.getConfig(siteKey);
        const backoff = this.backoffLevel.get(siteKey) || 0;
        
        // Base delay with randomization
        const baseDelay = config.minDelayMs + 
            Math.random() * (config.maxDelayMs - config.minDelayMs);
        
        // Apply backoff multiplier if we've hit rate limits
        const backoffMultiplier = Math.pow(config.backoffMultiplier, backoff);
        const delayWithBackoff = Math.min(
            baseDelay * backoffMultiplier,
            config.maxBackoffMs
        );
        
        return Math.floor(delayWithBackoff);
    }

    /**
     * Wait for rate limit before making request
     * Returns the actual delay that was applied
     */
    async waitForRateLimit(url) {
        const siteKey = this.getSiteKey(url);
        const config = this.getConfig(siteKey);
        const now = Date.now();
        
        // Check if we need to wait based on last request time
        const lastRequest = this.lastRequestTime.get(siteKey) || 0;
        const timeSinceLastRequest = now - lastRequest;
        
        // Calculate required delay
        const requiredDelay = this.calculateDelay(url);
        const actualDelay = Math.max(0, requiredDelay - timeSinceLastRequest);
        
        if (actualDelay > 0) {
            logger.debug({
                siteKey,
                delayMs: actualDelay,
                backoffLevel: this.backoffLevel.get(siteKey) || 0
            }, 'Rate limiting: waiting before request');
            
            await new Promise(resolve => setTimeout(resolve, actualDelay));
        }
        
        // Update last request time
        this.lastRequestTime.set(siteKey, Date.now());
        
        // Track request count
        this.incrementRequestCount(siteKey);
        
        return actualDelay;
    }

    /**
     * Track request count per minute
     */
    incrementRequestCount(siteKey) {
        const now = Date.now();
        const minute = Math.floor(now / 60000);
        
        if (!this.requestCounts.has(siteKey)) {
            this.requestCounts.set(siteKey, { minute, count: 0 });
        }
        
        const tracker = this.requestCounts.get(siteKey);
        
        // Reset if we're in a new minute
        if (tracker.minute !== minute) {
            tracker.minute = minute;
            tracker.count = 0;
        }
        
        tracker.count++;
        
        // Check if we're hitting rate limits
        const config = this.getConfig(siteKey);
        if (tracker.count >= config.maxRequestsPerMinute) {
            logger.warn({
                siteKey,
                requestsThisMinute: tracker.count,
                maxAllowed: config.maxRequestsPerMinute
            }, 'Approaching rate limit, increasing backoff');
            
            this.increaseBackoff(siteKey);
        }
    }

    /**
     * Report successful request (reduces backoff)
     */
    reportSuccess(url) {
        const siteKey = this.getSiteKey(url);
        
        // Reset consecutive errors
        this.consecutiveErrors.set(siteKey, 0);
        
        // Gradually reduce backoff on success
        const currentBackoff = this.backoffLevel.get(siteKey) || 0;
        if (currentBackoff > 0) {
            this.backoffLevel.set(siteKey, currentBackoff - 0.5);
            logger.debug({ siteKey, newBackoff: currentBackoff - 0.5 }, 'Reduced backoff after success');
        }
    }

    /**
     * Report failed request (increases backoff)
     */
    reportError(url, error) {
        const siteKey = this.getSiteKey(url);
        
        // Track consecutive errors
        const errors = (this.consecutiveErrors.get(siteKey) || 0) + 1;
        this.consecutiveErrors.set(siteKey, errors);
        
        // Increase backoff based on error type
        const isRateLimitError = this.isRateLimitError(error);
        
        if (isRateLimitError) {
            logger.warn({ siteKey, error: error.message }, 'Rate limit detected, increasing backoff');
            this.increaseBackoff(siteKey, 2); // Double increase for rate limits
        } else if (errors >= 3) {
            logger.warn({ siteKey, consecutiveErrors: errors }, 'Multiple failures, increasing backoff');
            this.increaseBackoff(siteKey);
        }
    }

    /**
     * Increase backoff level for a site
     */
    increaseBackoff(siteKey, amount = 1) {
        const currentBackoff = this.backoffLevel.get(siteKey) || 0;
        const newBackoff = Math.min(currentBackoff + amount, 5); // Max 5 levels
        this.backoffLevel.set(siteKey, newBackoff);
        
        logger.info({ siteKey, backoffLevel: newBackoff }, 'Backoff level increased');
    }

    /**
     * Check if error indicates rate limiting
     */
    isRateLimitError(error) {
        if (!error) return false;
        
        const message = error.message?.toLowerCase() || '';
        const code = error.code || error.status;
        
        // HTTP 429 Too Many Requests
        if (code === 429) return true;
        
        // HTTP 503 Service Unavailable (often used for rate limiting)
        if (code === 503) return true;
        
        // Common rate limit messages
        if (message.includes('rate limit')) return true;
        if (message.includes('too many requests')) return true;
        if (message.includes('throttl')) return true;
        if (message.includes('blocked')) return true;
        if (message.includes('captcha')) return true;
        
        return false;
    }

    /**
     * Get current stats for monitoring
     */
    getStats() {
        const stats = {};
        
        for (const siteKey of Object.keys(this.siteConfigs)) {
            if (siteKey === 'default') continue;
            
            const tracker = this.requestCounts.get(siteKey);
            stats[siteKey] = {
                lastRequestTime: this.lastRequestTime.get(siteKey),
                backoffLevel: this.backoffLevel.get(siteKey) || 0,
                requestsThisMinute: tracker?.count || 0,
                consecutiveErrors: this.consecutiveErrors.get(siteKey) || 0,
                config: this.getConfig(siteKey)
            };
        }
        
        return stats;
    }

    /**
     * Reset all tracking (useful for tests)
     */
    reset() {
        this.lastRequestTime.clear();
        this.requestCounts.clear();
        this.backoffLevel.clear();
        this.consecutiveErrors.clear();
    }

    /**
     * Update site configuration (useful for tuning)
     */
    updateSiteConfig(siteKey, config) {
        if (this.siteConfigs[siteKey]) {
            this.siteConfigs[siteKey] = { ...this.siteConfigs[siteKey], ...config };
            logger.info({ siteKey, config: this.siteConfigs[siteKey] }, 'Updated site rate limit config');
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

export default rateLimiter;

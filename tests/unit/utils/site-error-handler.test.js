/**
 * Unit tests for site-error-handler.js
 */

import {
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
} from '../../../src/utils/site-error-handler.js';

describe('site-error-handler', () => {
    beforeEach(() => {
        // Clear all site health before each test
        resetSiteHealth();
    });

    describe('ErrorCategory', () => {
        it('should define all expected error categories', () => {
            expect(ErrorCategory.TIMEOUT).toBe('timeout');
            expect(ErrorCategory.BLOCKED).toBe('blocked');
            expect(ErrorCategory.NETWORK).toBe('network');
            expect(ErrorCategory.CAPTCHA).toBe('captcha');
            expect(ErrorCategory.RATE_LIMIT).toBe('rate_limit');
            expect(ErrorCategory.SELECTOR_FAILED).toBe('selector_failed');
            expect(ErrorCategory.NOT_FOUND).toBe('not_found');
            expect(ErrorCategory.PARSE_ERROR).toBe('parse_error');
            expect(ErrorCategory.AUTH_REQUIRED).toBe('auth_required');
            expect(ErrorCategory.OUT_OF_STOCK).toBe('out_of_stock');
            expect(ErrorCategory.GEO_BLOCKED).toBe('geo_blocked');
            expect(ErrorCategory.UNKNOWN).toBe('unknown');
        });
    });

    describe('ErrorSeverity', () => {
        it('should define all expected severity levels', () => {
            expect(ErrorSeverity.LOW).toBe('low');
            expect(ErrorSeverity.MEDIUM).toBe('medium');
            expect(ErrorSeverity.HIGH).toBe('high');
            expect(ErrorSeverity.CRITICAL).toBe('critical');
        });
    });

    describe('getSiteFromUrl', () => {
        it('should extract amazon from amazon.com URL', () => {
            expect(getSiteFromUrl('https://www.amazon.com/product/123')).toBe('amazon');
        });

        it('should extract burton from burton.com URL', () => {
            expect(getSiteFromUrl('https://www.burton.com/us/en/p/test')).toBe('burton');
        });

        it('should extract target from target.com URL', () => {
            expect(getSiteFromUrl('https://www.target.com/p/product')).toBe('target');
        });

        it('should extract walmart from walmart.com URL', () => {
            expect(getSiteFromUrl('https://www.walmart.com/ip/product')).toBe('walmart');
        });

        it('should return default for unknown sites', () => {
            const site = getSiteFromUrl('https://unknown-site.example.com/product');
            expect(site).toBe('default');
        });
    });

    describe('classifyError', () => {
        it('should classify timeout errors', () => {
            const error = new Error('TimeoutError: Navigation timeout');
            const result = classifyError(error, 'https://amazon.com');
            expect(result.category).toBe(ErrorCategory.TIMEOUT);
        });

        it('should classify ETIMEDOUT errors', () => {
            const error = new Error('connect ETIMEDOUT');
            const result = classifyError(error, 'https://example.com');
            expect(result.category).toBe(ErrorCategory.TIMEOUT);
        });

        it('should classify ECONNREFUSED as network error', () => {
            const error = new Error('ECONNREFUSED');
            expect(classifyError(error, 'https://example.com').category).toBe(ErrorCategory.NETWORK);
        });

        it('should classify ENOTFOUND as network error', () => {
            const error = new Error('ENOTFOUND');
            expect(classifyError(error, 'https://example.com').category).toBe(ErrorCategory.NETWORK);
        });

        it('should classify CAPTCHA as captcha', () => {
            const error = new Error('CAPTCHA detected on page');
            const result = classifyError(error, 'https://amazon.com');
            expect(result.category).toBe(ErrorCategory.CAPTCHA);
        });

        it('should classify robot check for amazon as captcha', () => {
            const error = new Error('robot check required');
            const result = classifyError(error, 'https://amazon.com');
            expect(result.category).toBe(ErrorCategory.CAPTCHA);
        });

        it('should include site and timestamp in result', () => {
            const originalError = new Error('Test error');
            const result = classifyError(originalError, 'https://amazon.com/product');
            
            expect(result.site).toBe('amazon');
            expect(result.timestamp).toBeDefined();
        });

        it('should classify 404 as not_found', () => {
            const error = new Error('HTTP 404 Not Found');
            const result = classifyError(error, 'https://example.com');
            expect(result.category).toBe(ErrorCategory.NOT_FOUND);
        });

        it('should include severity in classification', () => {
            const error = new Error('timeout');
            const result = classifyError(error, 'https://example.com');
            expect(result.severity).toBeDefined();
        });

        it('should include retryable flag', () => {
            const error = new Error('timeout');
            const result = classifyError(error, 'https://example.com');
            expect(typeof result.retryable).toBe('boolean');
        });

        it('should return unknown for unrecognized errors', () => {
            const error = new Error('Some very random error xyz123abc');
            const result = classifyError(error, 'https://example.com');
            expect(result.category).toBe(ErrorCategory.UNKNOWN);
        });

        it('should handle error with no message', () => {
            const error = new Error();
            const result = classifyError(error, 'https://example.com');
            expect(result.category).toBeDefined();
        });

        it('should handle non-Error objects', () => {
            const result = classifyError('string error', 'https://example.com');
            expect(result.category).toBeDefined();
        });

        it('should classify rate limit errors', () => {
            const error = new Error('too many requests');
            const result = classifyError(error, 'https://amazon.com');
            expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
        });
    });

    describe('recordSiteError', () => {
        it('should record an error and return classification', () => {
            const error = new Error('timeout');
            const result = recordSiteError('https://amazon.com', error);
            
            expect(result.category).toBeDefined();
            expect(result.site).toBe('amazon');
        });

        it('should accumulate errors in health', () => {
            recordSiteError('https://amazon.com', new Error('timeout 1'));
            recordSiteError('https://amazon.com', new Error('timeout 2'));
            recordSiteError('https://amazon.com', new Error('blocked'));
            
            const health = getSiteHealth('amazon');
            expect(health.totalErrors).toBe(3);
        });

        it('should track consecutive errors', () => {
            recordSiteError('https://amazon.com', new Error('error 1'));
            recordSiteError('https://amazon.com', new Error('error 2'));
            
            const health = getSiteHealth('amazon');
            expect(health.consecutiveErrors).toBe(2);
        });
    });

    describe('recordSiteSuccess', () => {
        it('should reset consecutive error count', () => {
            recordSiteError('https://amazon.com', new Error('error 1'));
            recordSiteError('https://amazon.com', new Error('error 2'));
            recordSiteSuccess('https://amazon.com');
            
            const health = getSiteHealth('amazon');
            expect(health.consecutiveErrors).toBe(0);
        });

        it('should update lastSuccess timestamp', () => {
            recordSiteSuccess('https://amazon.com');
            
            const health = getSiteHealth('amazon');
            expect(health.lastSuccess).toBeDefined();
            expect(typeof health.lastSuccess).toBe('number');
        });
    });

    describe('isSiteInCooldown', () => {
        it('should return object with inCooldown false for a fresh site', () => {
            const result = isSiteInCooldown('https://example.com');
            expect(result.inCooldown).toBe(false);
        });

        it('should return object with cooldown info when in cooldown', () => {
            // Trigger cooldown by recording critical errors
            for (let i = 0; i < 15; i++) {
                recordSiteError('https://amazon.com', new Error('captcha detected'));
            }
            
            const result = isSiteInCooldown('https://amazon.com');
            expect(typeof result.inCooldown).toBe('boolean');
        });
    });

    describe('shouldRetry', () => {
        it('should return object with shouldRetry property for timeout errors', () => {
            const error = new Error('timeout');
            const result = shouldRetry(error, 'https://amazon.com', 1, 3);
            expect(typeof result.shouldRetry).toBe('boolean');
        });

        it('should return object with shouldRetry property for network errors', () => {
            const error = new Error('ECONNREFUSED');
            const result = shouldRetry(error, 'https://amazon.com', 1, 3);
            expect(typeof result.shouldRetry).toBe('boolean');
        });

        it('should not retry when max retries reached', () => {
            const error = new Error('timeout');
            const result = shouldRetry(error, 'https://amazon.com', 3, 3);
            expect(result.shouldRetry).toBe(false);
        });

        it('should include reason in result', () => {
            const error = new Error('captcha detected');
            const result = shouldRetry(error, 'https://amazon.com', 1, 3);
            expect(result.reason).toBeDefined();
        });
    });

    describe('getSiteHealth', () => {
        it('should return default health for unknown site', () => {
            const health = getSiteHealth('newsite');
            expect(health).toBeDefined();
            expect(health.status).toBe('unknown');
            expect(health.totalErrors).toBe(0);
        });

        it('should return health for tracked site', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            
            const health = getSiteHealth('amazon');
            expect(health).toBeDefined();
            expect(health.totalErrors).toBe(1);
        });

        it('should include status field', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            
            const health = getSiteHealth('amazon');
            expect(health.status).toBeDefined();
        });
    });

    describe('getAllSiteHealth', () => {
        it('should return health for all tracked sites', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            recordSiteSuccess('https://burton.com');
            
            const health = getAllSiteHealth();
            expect(health.amazon).toBeDefined();
            expect(health.burton).toBeDefined();
        });

        it('should include status for each site', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            
            const health = getAllSiteHealth();
            expect(health.amazon.status).toBeDefined();
        });

        it('should return empty object when no sites tracked', () => {
            const health = getAllSiteHealth();
            expect(typeof health).toBe('object');
            expect(Object.keys(health).length).toBe(0);
        });

        it('should include totalErrors for each site', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            recordSiteError('https://amazon.com', new Error('blocked'));
            
            const health = getAllSiteHealth();
            expect(health.amazon.totalErrors).toBe(2);
        });
    });

    describe('getErrorSummary', () => {
        it('should return summary with site and category', () => {
            const error = new Error('timeout');
            const summary = getErrorSummary(error, 'https://amazon.com');
            
            expect(summary.site).toBe('amazon');
            expect(summary.category).toBeDefined();
        });

        it('should include severity', () => {
            const error = new Error('captcha detected');
            const summary = getErrorSummary(error, 'https://amazon.com');
            
            expect(summary.severity).toBeDefined();
        });

        it('should include retryable flag', () => {
            const error = new Error('timeout');
            const summary = getErrorSummary(error, 'https://amazon.com');
            
            expect(typeof summary.retryable).toBe('boolean');
        });

        it('should truncate long messages', () => {
            const error = new Error('x'.repeat(500));
            const summary = getErrorSummary(error, 'https://amazon.com');
            
            expect(summary.message.length).toBeLessThanOrEqual(200);
        });

        it('should include action/recommendation', () => {
            const error = new Error('timeout');
            const summary = getErrorSummary(error, 'https://amazon.com');
            
            expect(summary.action).toBeDefined();
        });
    });

    describe('resetSiteHealth', () => {
        it('should clear health for a specific site', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            recordSiteError('https://burton.com', new Error('timeout'));
            
            resetSiteHealth('amazon');
            
            const amazonHealth = getSiteHealth('amazon');
            const burtonHealth = getSiteHealth('burton');
            
            expect(amazonHealth.totalErrors).toBe(0);
            expect(burtonHealth.totalErrors).toBe(1);
        });

        it('should clear all sites when no argument', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            recordSiteError('https://burton.com', new Error('timeout'));
            
            resetSiteHealth();
            
            const health = getAllSiteHealth();
            expect(Object.keys(health).length).toBe(0);
        });
    });

    describe('integration scenarios', () => {
        it('should handle multiple sites independently', () => {
            recordSiteError('https://amazon.com', new Error('timeout'));
            recordSiteError('https://amazon.com', new Error('captcha'));
            recordSiteSuccess('https://amazon.com');
            
            recordSiteSuccess('https://burton.com');
            recordSiteSuccess('https://burton.com');
            
            const health = getAllSiteHealth();
            
            expect(health.amazon.totalErrors).toBe(2);
            expect(health.amazon.consecutiveErrors).toBe(0); // Reset by success
            expect(health.burton.totalErrors).toBe(0);
        });

        it('should track consecutive errors correctly', () => {
            // Start fresh
            resetSiteHealth();
            
            // Record consecutive errors
            recordSiteError('https://amazon.com', new Error('error 1'));
            recordSiteError('https://amazon.com', new Error('error 2'));
            recordSiteError('https://amazon.com', new Error('error 3'));
            
            const health = getSiteHealth('amazon');
            expect(health.consecutiveErrors).toBe(3);
            
            // Success resets consecutive errors
            recordSiteSuccess('https://amazon.com');
            
            const healthAfterSuccess = getSiteHealth('amazon');
            expect(healthAfterSuccess.consecutiveErrors).toBe(0);
            expect(healthAfterSuccess.totalErrors).toBe(3); // Total should remain
        });

        it('should handle page content for classification', () => {
            const error = new Error('Page load failed');
            const pageContent = 'Enter the characters you see below - robot check';
            
            const result = classifyError(error, 'https://amazon.com', pageContent);
            expect(result.category).toBe(ErrorCategory.CAPTCHA);
        });

        it('should classify automated access block', () => {
            const error = new Error('Page contains: to discuss automated access');
            const result = classifyError(error, 'https://amazon.com');
            expect(result.category).toBe(ErrorCategory.CAPTCHA);
        });
    });
});


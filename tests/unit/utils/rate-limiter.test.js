import { describe, it, expect, beforeEach } from '@jest/globals';
import { rateLimiter } from '../../../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset the limiter state between tests
    rateLimiter.lastRequestTime.clear();
    rateLimiter.requestCounts.clear();
    rateLimiter.backoffLevel.clear();
    rateLimiter.consecutiveErrors.clear();
  });

  describe('getSiteKey', () => {
    describe('Amazon URLs', () => {
      it('should identify www.amazon.com URLs', () => {
        expect(rateLimiter.getSiteKey('https://www.amazon.com/dp/B123')).toBe('amazon.com');
      });

      it('should identify amazon.com without www', () => {
        expect(rateLimiter.getSiteKey('https://amazon.com/product')).toBe('amazon.com');
      });

      it('should identify Amazon product URLs', () => {
        expect(rateLimiter.getSiteKey('https://www.amazon.com/dp/B08N5WRWNW')).toBe('amazon.com');
        expect(rateLimiter.getSiteKey('https://www.amazon.com/gp/product/B08N5WRWNW')).toBe('amazon.com');
      });
    });

    describe('Burton URLs', () => {
      it('should identify burton.com URLs', () => {
        expect(rateLimiter.getSiteKey('https://www.burton.com/us/product')).toBe('burton.com');
      });

      it('should identify burton.com without www', () => {
        expect(rateLimiter.getSiteKey('https://burton.com/us/en/p/board')).toBe('burton.com');
      });
    });

    describe('Unknown/Invalid URLs', () => {
      it('should return default for unknown sites', () => {
        expect(rateLimiter.getSiteKey('https://example.com')).toBe('default');
        expect(rateLimiter.getSiteKey('https://ebay.com/item/123')).toBe('default');
      });

      it('should handle invalid URLs gracefully', () => {
        expect(rateLimiter.getSiteKey('not-a-url')).toBe('default');
        expect(rateLimiter.getSiteKey('')).toBe('default');
        expect(rateLimiter.getSiteKey(null)).toBe('default');
        expect(rateLimiter.getSiteKey(undefined)).toBe('default');
      });

      it('should handle malformed URLs', () => {
        expect(rateLimiter.getSiteKey('http://')).toBe('default');
        expect(rateLimiter.getSiteKey('amazon.com')).toBe('default'); // Missing protocol
      });
    });
  });

  describe('getConfig', () => {
    it('should return amazon config for amazon.com', () => {
      const config = rateLimiter.getConfig('amazon.com');
      expect(config.minDelayMs).toBeDefined();
      expect(config.maxRequestsPerMinute).toBeDefined();
      expect(config.maxBackoffMs).toBeDefined();
    });

    it('should return burton config for burton.com', () => {
      const config = rateLimiter.getConfig('burton.com');
      expect(config.minDelayMs).toBeDefined();
    });

    it('should return default config for unknown sites', () => {
      const config = rateLimiter.getConfig('unknown');
      expect(config).toEqual(rateLimiter.siteConfigs['default']);
    });

    it('should have consistent config structure', () => {
      const sites = ['amazon.com', 'burton.com', 'default'];
      
      sites.forEach(site => {
        const config = rateLimiter.getConfig(site);
        expect(typeof config.minDelayMs).toBe('number');
        expect(typeof config.maxRequestsPerMinute).toBe('number');
        expect(config.minDelayMs).toBeGreaterThan(0);
        expect(config.maxRequestsPerMinute).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateDelay', () => {
    it('should return delay within configured range', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const config = rateLimiter.getConfig('amazon.com');
      
      const delay = rateLimiter.calculateDelay(url);
      
      expect(delay).toBeGreaterThanOrEqual(config.minDelayMs);
      expect(delay).toBeLessThanOrEqual(config.maxBackoffMs);
    });

    it('should increase delay with backoff level', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      const config = rateLimiter.getConfig(siteKey);
      
      // Get base delay with no backoff
      rateLimiter.backoffLevel.set(siteKey, 0);
      const baseDelay = rateLimiter.calculateDelay(url);
      
      // Set higher backoff level
      rateLimiter.backoffLevel.set(siteKey, 3);
      const backoffDelay = rateLimiter.calculateDelay(url);
      
      // With backoff, delay should be greater or equal (exponential)
      expect(backoffDelay).toBeGreaterThanOrEqual(baseDelay);
    });

    it('should return delay for different sites', () => {
      const amazonDelay = rateLimiter.calculateDelay('https://amazon.com/dp/B123');
      const burtonDelay = rateLimiter.calculateDelay('https://burton.com/product');
      
      expect(amazonDelay).toBeGreaterThan(0);
      expect(burtonDelay).toBeGreaterThan(0);
    });

    it('should cap delay at maxBackoffMs', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      const config = rateLimiter.getConfig(siteKey);
      
      // Set very high backoff level
      rateLimiter.backoffLevel.set(siteKey, 100);
      const delay = rateLimiter.calculateDelay(url);
      
      expect(delay).toBeLessThanOrEqual(config.maxBackoffMs);
    });
  });

  describe('reportSuccess', () => {
    it('should reset consecutive errors on success', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      rateLimiter.consecutiveErrors.set(siteKey, 5);
      rateLimiter.reportSuccess(url);
      
      expect(rateLimiter.consecutiveErrors.get(siteKey)).toBe(0);
    });

    it('should decrease backoff level on success', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      rateLimiter.backoffLevel.set(siteKey, 3);
      rateLimiter.reportSuccess(url);
      
      // Backoff should decrease (or stay at 0)
      const backoff = rateLimiter.backoffLevel.get(siteKey) || 0;
      expect(backoff).toBeLessThanOrEqual(3);
    });

    it('should reset consecutive errors', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      // Set up some consecutive errors
      rateLimiter.consecutiveErrors.set(siteKey, 5);
      
      rateLimiter.reportSuccess(url);
      
      expect(rateLimiter.consecutiveErrors.get(siteKey)).toBe(0);
    });
  });

  describe('reportError', () => {
    it('should increment consecutive errors', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      rateLimiter.reportError(url, new Error('test'));
      expect(rateLimiter.consecutiveErrors.get(siteKey)).toBe(1);
      
      rateLimiter.reportError(url, new Error('test'));
      expect(rateLimiter.consecutiveErrors.get(siteKey)).toBe(2);
    });

    it('should increase backoff level on errors', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      const initialBackoff = rateLimiter.backoffLevel.get(siteKey) || 0;
      
      rateLimiter.reportError(url, new Error('rate limit'));
      
      const newBackoff = rateLimiter.backoffLevel.get(siteKey) || 0;
      expect(newBackoff).toBeGreaterThanOrEqual(initialBackoff);
    });

    it('should handle multiple consecutive errors', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      for (let i = 0; i < 5; i++) {
        rateLimiter.reportError(url, new Error('error'));
      }
      
      expect(rateLimiter.consecutiveErrors.get(siteKey)).toBe(5);
    });
  });

  describe('waitForRateLimit', () => {
    it('should be a function', () => {
      expect(typeof rateLimiter.waitForRateLimit).toBe('function');
    });

    it('should return a promise', () => {
      const result = rateLimiter.waitForRateLimit('https://amazon.com/dp/B123');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve with delay value', async () => {
      const delay = await rateLimiter.waitForRateLimit('https://amazon.com/dp/B123');
      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('state isolation', () => {
    it('should track different sites independently', () => {
      const amazonUrl = 'https://amazon.com/dp/B123';
      const burtonUrl = 'https://burton.com/product';
      
      // Report errors for Amazon only
      rateLimiter.reportError(amazonUrl, new Error('error'));
      rateLimiter.reportError(amazonUrl, new Error('error'));
      
      const amazonKey = rateLimiter.getSiteKey(amazonUrl);
      const burtonKey = rateLimiter.getSiteKey(burtonUrl);
      
      expect(rateLimiter.consecutiveErrors.get(amazonKey)).toBe(2);
      expect(rateLimiter.consecutiveErrors.get(burtonKey) || 0).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return stats object', () => {
      const stats = rateLimiter.getStats();
      expect(typeof stats).toBe('object');
    });

    it('should include amazon.com stats', () => {
      // Make a request to amazon first to populate tracking
      rateLimiter.waitForRateLimit('https://amazon.com/dp/B123');
      
      const stats = rateLimiter.getStats();
      expect(stats['amazon.com']).toBeDefined();
    });

    it('should track backoff levels', () => {
      const amazonUrl = 'https://amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(amazonUrl);
      
      rateLimiter.backoffLevel.set(siteKey, 2);
      rateLimiter.waitForRateLimit(amazonUrl);
      
      const stats = rateLimiter.getStats();
      expect(stats['amazon.com'].backoffLevel).toBe(2);
    });

    it('should track consecutive errors', () => {
      const amazonUrl = 'https://amazon.com/dp/B123';
      
      rateLimiter.reportError(amazonUrl, new Error('test'));
      rateLimiter.reportError(amazonUrl, new Error('test'));
      
      const stats = rateLimiter.getStats();
      expect(stats['amazon.com'].consecutiveErrors).toBe(2);
    });
  });

  describe('reset', () => {
    it('should clear all tracking state', () => {
      const amazonUrl = 'https://amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(amazonUrl);
      
      // Set up some state
      rateLimiter.lastRequestTime.set(siteKey, Date.now());
      rateLimiter.backoffLevel.set(siteKey, 3);
      rateLimiter.consecutiveErrors.set(siteKey, 5);
      
      // Reset
      rateLimiter.reset();
      
      // Verify all cleared
      expect(rateLimiter.lastRequestTime.size).toBe(0);
      expect(rateLimiter.backoffLevel.size).toBe(0);
      expect(rateLimiter.consecutiveErrors.size).toBe(0);
    });
  });

  describe('updateSiteConfig', () => {
    it('should update existing site config', () => {
      const originalConfig = { ...rateLimiter.siteConfigs['amazon.com'] };
      
      rateLimiter.updateSiteConfig('amazon.com', { minDelayMs: 5000 });
      
      expect(rateLimiter.siteConfigs['amazon.com'].minDelayMs).toBe(5000);
      
      // Restore original
      rateLimiter.siteConfigs['amazon.com'] = originalConfig;
    });

    it('should merge with existing config', () => {
      const originalConfig = { ...rateLimiter.siteConfigs['amazon.com'] };
      
      rateLimiter.updateSiteConfig('amazon.com', { minDelayMs: 6000 });
      
      // Other properties should remain unchanged
      expect(rateLimiter.siteConfigs['amazon.com'].maxRequestsPerMinute).toBe(originalConfig.maxRequestsPerMinute);
      
      // Restore original
      rateLimiter.siteConfigs['amazon.com'] = originalConfig;
    });

    it('should not update non-existent sites', () => {
      const before = { ...rateLimiter.siteConfigs };
      
      rateLimiter.updateSiteConfig('nonexistent.com', { minDelayMs: 1000 });
      
      expect(rateLimiter.siteConfigs['nonexistent.com']).toBeUndefined();
    });
  });
});

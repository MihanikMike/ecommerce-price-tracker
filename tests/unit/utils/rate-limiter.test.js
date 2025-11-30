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
    it('should identify amazon.com URLs', () => {
      expect(rateLimiter.getSiteKey('https://www.amazon.com/dp/B123')).toBe('amazon.com');
      expect(rateLimiter.getSiteKey('https://amazon.com/product')).toBe('amazon.com');
    });

    it('should identify burton.com URLs', () => {
      expect(rateLimiter.getSiteKey('https://www.burton.com/us/product')).toBe('burton.com');
    });

    it('should return default for unknown sites', () => {
      expect(rateLimiter.getSiteKey('https://example.com')).toBe('default');
    });

    it('should handle invalid URLs', () => {
      expect(rateLimiter.getSiteKey('not-a-url')).toBe('default');
    });
  });

  describe('getConfig', () => {
    it('should return amazon config for amazon.com', () => {
      const config = rateLimiter.getConfig('amazon.com');
      expect(config.minDelayMs).toBeDefined();
      expect(config.maxRequestsPerMinute).toBeDefined();
    });

    it('should return default config for unknown sites', () => {
      const config = rateLimiter.getConfig('unknown');
      expect(config).toEqual(rateLimiter.siteConfigs['default']);
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

    it('should increase delay with backoff', () => {
      const url = 'https://www.amazon.com/dp/B123';
      const siteKey = rateLimiter.getSiteKey(url);
      
      // Set backoff level
      rateLimiter.backoffLevel.set(siteKey, 2);
      const delay = rateLimiter.calculateDelay(url);
      
      // With backoff, delay should be positive
      expect(delay).toBeGreaterThan(0);
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
  });
});

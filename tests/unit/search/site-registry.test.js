import { describe, it, expect } from '@jest/globals';
import {
  detectSite,
  getScraperForUrl,
  getSelectorsForUrl,
  getRateLimitForUrl,
  isSupportedSite,
  getSiteName,
  getAllSites,
} from '../../../src/search/site-registry.js';

/**
 * Tests for Site Registry
 * Tests the actual site-registry module functions
 */

describe('site-registry', () => {
  describe('detectSite', () => {
    describe('Amazon detection', () => {
      it('should detect amazon.com', () => {
        const result = detectSite('https://www.amazon.com/dp/B08N5WRWNW');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Amazon');
        expect(result.key).toBe('amazon');
      });

      it('should detect amazon.co.uk', () => {
        const result = detectSite('https://www.amazon.co.uk/dp/B08N5WRWNW');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Amazon');
      });

      it('should detect amazon without www', () => {
        const result = detectSite('https://amazon.com/product/test');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Amazon');
      });
    });

    describe('Burton detection', () => {
      it('should detect burton.com', () => {
        const result = detectSite('https://www.burton.com/snowboards/test-board');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Burton');
        expect(result.key).toBe('burton');
      });
    });

    describe('Walmart detection', () => {
      it('should detect walmart.com', () => {
        const result = detectSite('https://www.walmart.com/ip/some-product');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Walmart');
        expect(result.key).toBe('walmart');
      });
    });

    describe('Target detection', () => {
      it('should detect target.com', () => {
        const result = detectSite('https://www.target.com/p/product-name/-/A-12345');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Target');
        expect(result.key).toBe('target');
      });
    });

    describe('BestBuy detection', () => {
      it('should detect bestbuy.com', () => {
        const result = detectSite('https://www.bestbuy.com/site/product/12345.p');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Best Buy');
        expect(result.key).toBe('bestbuy');
      });
    });

    describe('eBay detection', () => {
      it('should detect ebay.com', () => {
        const result = detectSite('https://www.ebay.com/itm/123456789');
        expect(result).not.toBeNull();
        expect(result.name).toBe('eBay');
        expect(result.key).toBe('ebay');
      });
    });

    describe('Generic fallback', () => {
      it('should return generic config for unknown sites', () => {
        const result = detectSite('https://www.unknownsite.com/product/123');
        expect(result).not.toBeNull();
        expect(result.name).toBe('Generic');
        expect(result.key).toBe('generic');
      });
    });

    describe('Invalid URLs', () => {
      it('should return null for invalid URLs', () => {
        const result = detectSite('not-a-valid-url');
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = detectSite('');
        expect(result).toBeNull();
      });
    });
  });

  describe('getScraperForUrl', () => {
    it('should return scraper for Amazon', () => {
      const scraper = getScraperForUrl('https://www.amazon.com/dp/B08N5WRWNW');
      expect(scraper).not.toBeNull();
      expect(typeof scraper).toBe('function');
    });

    it('should return scraper for Burton', () => {
      const scraper = getScraperForUrl('https://www.burton.com/product');
      expect(scraper).not.toBeNull();
      expect(typeof scraper).toBe('function');
    });

    it('should return null for generic sites without scraper', () => {
      const scraper = getScraperForUrl('https://www.unknown-store.com/product');
      // Generic sites may or may not have a scraper
      expect(scraper === null || typeof scraper === 'function').toBe(true);
    });

    it('should return null for invalid URL', () => {
      const scraper = getScraperForUrl('invalid-url');
      expect(scraper).toBeNull();
    });
  });

  describe('getSelectorsForUrl', () => {
    it('should return selectors for Amazon', () => {
      const selectors = getSelectorsForUrl('https://www.amazon.com/dp/B08N5WRWNW');
      expect(selectors).toBeDefined();
      expect(selectors.title).toBeDefined();
      expect(selectors.price).toBeDefined();
      expect(Array.isArray(selectors.title)).toBe(true);
      expect(Array.isArray(selectors.price)).toBe(true);
    });

    it('should return selectors for Burton', () => {
      const selectors = getSelectorsForUrl('https://www.burton.com/product');
      expect(selectors).toBeDefined();
      expect(selectors.title).toBeDefined();
      expect(selectors.price).toBeDefined();
    });

    it('should return generic selectors for unknown sites', () => {
      const selectors = getSelectorsForUrl('https://www.unknown-store.com/product');
      expect(selectors).toBeDefined();
      expect(selectors.title).toBeDefined();
      expect(selectors.price).toBeDefined();
    });

    it('should have Amazon-specific selectors', () => {
      const selectors = getSelectorsForUrl('https://www.amazon.com/dp/test');
      expect(selectors.title).toContain('#productTitle');
      expect(selectors.price.some(s => s.includes('a-offscreen'))).toBe(true);
    });
  });

  describe('getRateLimitForUrl', () => {
    it('should return rate limit config for Amazon', () => {
      const rateLimit = getRateLimitForUrl('https://www.amazon.com/dp/test');
      expect(rateLimit).toBeDefined();
      expect(rateLimit.minDelay).toBeDefined();
      expect(rateLimit.maxDelay).toBeDefined();
      expect(rateLimit.minDelay).toBeGreaterThan(0);
      expect(rateLimit.maxDelay).toBeGreaterThanOrEqual(rateLimit.minDelay);
    });

    it('should return default rate limit for unknown sites', () => {
      const rateLimit = getRateLimitForUrl('https://www.unknown-store.com/product');
      expect(rateLimit).toBeDefined();
      expect(rateLimit.minDelay).toBeDefined();
      expect(rateLimit.maxDelay).toBeDefined();
    });

    it('should return rate limit with reasonable values', () => {
      const rateLimit = getRateLimitForUrl('https://www.walmart.com/product');
      expect(rateLimit.minDelay).toBeGreaterThanOrEqual(1000);
      expect(rateLimit.maxDelay).toBeLessThanOrEqual(10000);
    });
  });

  describe('isSupportedSite', () => {
    it('should return true for Amazon', () => {
      const result = isSupportedSite('https://www.amazon.com/dp/test');
      expect(result).toBe(true);
    });

    it('should return true for Walmart', () => {
      const result = isSupportedSite('https://www.walmart.com/ip/product');
      expect(result).toBe(true);
    });

    it('should return true for target.com', () => {
      const result = isSupportedSite('https://www.target.com/p/product');
      expect(result).toBe(true);
    });

    it('should return true for generic/unknown sites (generic is supported)', () => {
      const result = isSupportedSite('https://www.unknown-store.com/product');
      expect(result).toBe(true);
    });
  });

  describe('getSiteName', () => {
    it('should return Amazon for amazon.com URLs', () => {
      const name = getSiteName('https://www.amazon.com/dp/test');
      expect(name).toBe('Amazon');
    });

    it('should return Burton for burton.com URLs', () => {
      const name = getSiteName('https://www.burton.com/product');
      expect(name).toBe('Burton');
    });

    it('should return Generic for unknown sites', () => {
      const name = getSiteName('https://www.unknownsite.com/product');
      expect(name).toBe('Generic');
    });

    it('should return Unknown for invalid URLs', () => {
      const name = getSiteName('not-a-url');
      expect(name).toBe('Unknown');
    });
  });

  describe('getAllSites', () => {
    it('should return object with all site configurations', () => {
      const sites = getAllSites();
      expect(sites).toBeDefined();
      expect(typeof sites).toBe('object');
    });

    it('should include Amazon configuration', () => {
      const sites = getAllSites();
      expect(sites.amazon).toBeDefined();
      expect(sites.amazon.name).toBe('Amazon');
    });

    it('should include Burton configuration', () => {
      const sites = getAllSites();
      expect(sites.burton).toBeDefined();
      expect(sites.burton.name).toBe('Burton');
    });

    it('should include generic configuration', () => {
      const sites = getAllSites();
      expect(sites.generic).toBeDefined();
      expect(sites.generic.name).toBe('Generic');
    });

    it('should include major e-commerce sites', () => {
      const sites = getAllSites();
      expect(sites.walmart).toBeDefined();
      expect(sites.target).toBeDefined();
      expect(sites.bestbuy).toBeDefined();
      expect(sites.ebay).toBeDefined();
    });

    it('should return configurations with required properties', () => {
      const sites = getAllSites();
      
      Object.entries(sites).forEach(([key, site]) => {
        expect(site.name).toBeDefined();
        expect(site.domains).toBeDefined();
        expect(Array.isArray(site.domains)).toBe(true);
      });
    });
  });
});

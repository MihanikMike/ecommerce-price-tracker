import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getKnownEcommerceDomains,
  addEcommerceDomain,
} from '../../../src/search/search-engine.js';

/**
 * Tests for Search Engine module
 * Tests the pure functions exported from search-engine.js
 */

describe('search-engine', () => {
  describe('getKnownEcommerceDomains', () => {
    it('should return an array of domains', () => {
      const domains = getKnownEcommerceDomains();
      expect(Array.isArray(domains)).toBe(true);
      expect(domains.length).toBeGreaterThan(0);
    });

    it('should include major retailers', () => {
      const domains = getKnownEcommerceDomains();
      const domainNames = domains.map(d => d.domain);
      
      expect(domainNames).toContain('amazon.com');
      expect(domainNames).toContain('walmart.com');
      expect(domainNames).toContain('target.com');
      expect(domainNames).toContain('bestbuy.com');
      expect(domainNames).toContain('ebay.com');
    });

    it('should include specialty retailers', () => {
      const domains = getKnownEcommerceDomains();
      const domainNames = domains.map(d => d.domain);
      
      expect(domainNames).toContain('burton.com');
      expect(domainNames).toContain('rei.com');
    });

    it('should have priority values for each domain', () => {
      const domains = getKnownEcommerceDomains();
      
      domains.forEach(domain => {
        expect(domain.domain).toBeDefined();
        expect(domain.name).toBeDefined();
        expect(typeof domain.priority).toBe('number');
        expect(domain.priority).toBeGreaterThan(0);
      });
    });

    it('should return a copy (not mutate internal array)', () => {
      const domains1 = getKnownEcommerceDomains();
      const domains2 = getKnownEcommerceDomains();
      
      // They should be different array instances
      expect(domains1).not.toBe(domains2);
      expect(domains1).toEqual(domains2);
    });

    it('should have Amazon with highest priority', () => {
      const domains = getKnownEcommerceDomains();
      const amazon = domains.find(d => d.domain === 'amazon.com');
      
      expect(amazon).toBeDefined();
      expect(amazon.priority).toBe(10);
    });
  });

  describe('addEcommerceDomain', () => {
    it('should add a new domain to the list', () => {
      const newDomain = `test-store-${Date.now()}.com`;
      
      addEcommerceDomain(newDomain, 'Test Store', 5);
      
      const domains = getKnownEcommerceDomains();
      const added = domains.find(d => d.domain === newDomain);
      
      expect(added).toBeDefined();
      expect(added.name).toBe('Test Store');
      expect(added.priority).toBe(5);
    });

    it('should not add duplicate domains', () => {
      const domains1 = getKnownEcommerceDomains();
      const initialCount = domains1.length;
      
      // Try to add amazon.com again
      addEcommerceDomain('amazon.com', 'Duplicate Amazon', 1);
      
      const domains2 = getKnownEcommerceDomains();
      expect(domains2.length).toBe(initialCount);
      
      // Should still have original Amazon entry
      const amazon = domains2.find(d => d.domain === 'amazon.com');
      expect(amazon.name).toBe('Amazon');
    });

    it('should use default priority of 5 if not specified', () => {
      const newDomain = `default-priority-${Date.now()}.com`;
      
      addEcommerceDomain(newDomain, 'Default Priority Store');
      
      const domains = getKnownEcommerceDomains();
      const added = domains.find(d => d.domain === newDomain);
      
      expect(added).toBeDefined();
      expect(added.priority).toBe(5);
    });

    it('should accept custom priority values', () => {
      const newDomain = `high-priority-${Date.now()}.com`;
      
      addEcommerceDomain(newDomain, 'High Priority Store', 9);
      
      const domains = getKnownEcommerceDomains();
      const added = domains.find(d => d.domain === newDomain);
      
      expect(added).toBeDefined();
      expect(added.priority).toBe(9);
    });
  });

  describe('domain structure', () => {
    it('should have all required fields for each domain', () => {
      const domains = getKnownEcommerceDomains();
      
      domains.forEach(domain => {
        expect(typeof domain.domain).toBe('string');
        expect(domain.domain.length).toBeGreaterThan(0);
        expect(typeof domain.name).toBe('string');
        expect(domain.name.length).toBeGreaterThan(0);
        expect(typeof domain.priority).toBe('number');
      });
    });

    it('should have valid domain formats', () => {
      const domains = getKnownEcommerceDomains();
      
      domains.forEach(domain => {
        // Domain should contain a dot
        expect(domain.domain).toContain('.');
        // Should not have protocol
        expect(domain.domain).not.toContain('://');
        // Should not have www prefix
        expect(domain.domain).not.toMatch(/^www\./);
      });
    });

    it('should have priorities in valid range', () => {
      const domains = getKnownEcommerceDomains();
      
      domains.forEach(domain => {
        expect(domain.priority).toBeGreaterThanOrEqual(1);
        expect(domain.priority).toBeLessThanOrEqual(10);
      });
    });
  });
});

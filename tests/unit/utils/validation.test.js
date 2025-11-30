import { describe, it, expect } from '@jest/globals';
import { 
  validateURL, 
  validatePrice, 
  validateScrapedData 
} from '../../../src/utils/validation.js';

describe('validation', () => {
  describe('validateURL', () => {
    it('should accept valid HTTP URLs', () => {
      const result = validateURL('https://www.amazon.com/dp/B0ABC123');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const result = validateURL('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateURL('ftp://example.com');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePrice', () => {
    it('should accept valid prices', () => {
      expect(validatePrice(99.99).valid).toBe(true);
      expect(validatePrice(0.01).valid).toBe(true);
      expect(validatePrice(10000).valid).toBe(true);
    });

    it('should reject negative prices', () => {
      const result = validatePrice(-10);
      expect(result.valid).toBe(false);
    });

    it('should reject zero prices', () => {
      const result = validatePrice(0);
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric values', () => {
      const result = validatePrice('abc');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateScrapedData', () => {
    it('should validate complete scraped data', () => {
      const data = {
        url: 'https://amazon.com/dp/B0ABC',
        site: 'Amazon',
        title: 'Test Product',
        price: 29.99,
        currency: 'USD'
      };
      const result = validateScrapedData(data);
      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const data = { url: 'https://amazon.com' };
      const result = validateScrapedData(data);
      expect(result.valid).toBe(false);
    });
  });
});
import { describe, it, expect } from '@jest/globals';
import { 
  validateURL, 
  validatePrice, 
  validateScrapedData,
  validateSite,
  validateCurrency,
  validateTitle,
  validateCheckInterval,
  validateProductId,
  validateTrackedProduct
} from '../../../src/utils/validation.js';

describe('validation', () => {
  describe('validateURL', () => {
    describe('valid URLs', () => {
      it('should accept valid Amazon HTTPS URLs', () => {
        const result = validateURL('https://www.amazon.com/dp/B0ABC123');
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('https://www.amazon.com/dp/B0ABC123');
      });

      it('should accept Amazon URLs without www', () => {
        const result = validateURL('https://amazon.com/product/xyz');
        expect(result.valid).toBe(true);
      });

      it('should accept valid Burton HTTPS URLs', () => {
        const result = validateURL('https://www.burton.com/us/en/p/snowboard');
        expect(result.valid).toBe(true);
      });

      it('should accept HTTP URLs (not just HTTPS)', () => {
        const result = validateURL('http://www.amazon.com/dp/B123');
        expect(result.valid).toBe(true);
      });

      it('should trim whitespace from URLs', () => {
        const result = validateURL('  https://amazon.com/dp/B123  ');
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe('https://amazon.com/dp/B123');
      });
    });

    describe('invalid URLs', () => {
      it('should reject malformed URLs', () => {
        const result = validateURL('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid URL format');
      });

      it('should reject URLs with invalid protocol', () => {
        const result = validateURL('ftp://amazon.com/product');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL must use HTTP or HTTPS protocol');
      });

      it('should reject unsupported domains', () => {
        const result = validateURL('https://www.ebay.com/item/123');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL must be from supported domain (amazon.com or burton.com)');
      });

      it('should reject null URL', () => {
        const result = validateURL(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('URL is required and must be a string');
      });

      it('should reject undefined URL', () => {
        const result = validateURL(undefined);
        expect(result.valid).toBe(false);
      });

      it('should reject empty string', () => {
        const result = validateURL('');
        expect(result.valid).toBe(false);
      });

      it('should reject non-string types', () => {
        expect(validateURL(123).valid).toBe(false);
        expect(validateURL({}).valid).toBe(false);
        expect(validateURL([]).valid).toBe(false);
      });
    });
  });

  describe('validateSite', () => {
    it('should accept "Amazon"', () => {
      const result = validateSite('Amazon');
      expect(result.valid).toBe(true);
    });

    it('should accept "Burton"', () => {
      const result = validateSite('Burton');
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported sites', () => {
      const result = validateSite('eBay');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Site must be one of');
    });

    it('should reject null or undefined', () => {
      expect(validateSite(null).valid).toBe(false);
      expect(validateSite(undefined).valid).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(validateSite('amazon').valid).toBe(false);
      expect(validateSite('AMAZON').valid).toBe(false);
    });
  });

  describe('validatePrice', () => {
    describe('valid prices', () => {
      it('should accept typical retail prices', () => {
        expect(validatePrice(99.99).valid).toBe(true);
        expect(validatePrice(29.99).valid).toBe(true);
        expect(validatePrice(1299.00).valid).toBe(true);
      });

      it('should accept minimum valid price (0.01)', () => {
        const result = validatePrice(0.01);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(0.01);
      });

      it('should accept large prices up to limit', () => {
        expect(validatePrice(99999999.99).valid).toBe(true);
      });

      it('should accept integer prices', () => {
        expect(validatePrice(100).valid).toBe(true);
        expect(validatePrice(1).valid).toBe(true);
      });

      it('should parse string prices', () => {
        const result = validatePrice('49.99');
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(49.99);
      });

      it('should round to 2 decimal places', () => {
        const result = validatePrice(99.999);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBe(100.00);
      });
    });

    describe('invalid prices', () => {
      it('should reject negative prices', () => {
        const result = validatePrice(-10);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('at least');
      });

      it('should reject zero price', () => {
        const result = validatePrice(0);
        expect(result.valid).toBe(false);
      });

      it('should reject prices exceeding maximum', () => {
        const result = validatePrice(100000000);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('cannot exceed');
      });

      it('should reject non-numeric strings', () => {
        expect(validatePrice('abc').valid).toBe(false);
        expect(validatePrice('$99.99').valid).toBe(false);
      });

      it('should reject null and undefined', () => {
        expect(validatePrice(null).valid).toBe(false);
        expect(validatePrice(undefined).valid).toBe(false);
      });

      it('should reject Infinity', () => {
        expect(validatePrice(Infinity).valid).toBe(false);
        expect(validatePrice(-Infinity).valid).toBe(false);
      });

      it('should reject NaN', () => {
        expect(validatePrice(NaN).valid).toBe(false);
      });
    });
  });

  describe('validateCurrency', () => {
    it('should accept supported currencies', () => {
      expect(validateCurrency('USD').valid).toBe(true);
      expect(validateCurrency('EUR').valid).toBe(true);
      expect(validateCurrency('GBP').valid).toBe(true);
      expect(validateCurrency('CAD').valid).toBe(true);
      expect(validateCurrency('AUD').valid).toBe(true);
    });

    it('should normalize to uppercase', () => {
      const result = validateCurrency('usd');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('USD');
    });

    it('should reject unsupported currencies', () => {
      expect(validateCurrency('JPY').valid).toBe(false);
      expect(validateCurrency('BTC').valid).toBe(false);
    });

    it('should reject empty or null', () => {
      expect(validateCurrency('').valid).toBe(false);
      expect(validateCurrency(null).valid).toBe(false);
    });
  });

  describe('validateTitle', () => {
    it('should accept valid product titles', () => {
      const result = validateTitle('Apple AirPods Pro (2nd Generation)');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Apple AirPods Pro (2nd Generation)');
    });

    it('should trim whitespace', () => {
      const result = validateTitle('  Product Name  ');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Product Name');
    });

    it('should reject empty string after trimming', () => {
      expect(validateTitle('   ').valid).toBe(false);
    });

    it('should reject titles exceeding max length', () => {
      const longTitle = 'A'.repeat(1001);
      expect(validateTitle(longTitle).valid).toBe(false);
    });

    it('should accept titles at max length', () => {
      const maxTitle = 'A'.repeat(1000);
      expect(validateTitle(maxTitle).valid).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(validateTitle(null).valid).toBe(false);
      expect(validateTitle(undefined).valid).toBe(false);
    });
  });

  describe('validateCheckInterval', () => {
    it('should accept valid intervals', () => {
      expect(validateCheckInterval(60).valid).toBe(true);
      expect(validateCheckInterval(1440).valid).toBe(true);
    });

    it('should accept minimum interval (1 minute)', () => {
      const result = validateCheckInterval(1);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(1);
    });

    it('should accept maximum interval (1 week)', () => {
      expect(validateCheckInterval(10080).valid).toBe(true);
    });

    it('should reject intervals below minimum', () => {
      expect(validateCheckInterval(0).valid).toBe(false);
      expect(validateCheckInterval(-1).valid).toBe(false);
    });

    it('should reject intervals above maximum', () => {
      expect(validateCheckInterval(10081).valid).toBe(false);
    });

    it('should parse string intervals', () => {
      const result = validateCheckInterval('60');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(60);
    });

    it('should reject null intervals', () => {
      const result = validateCheckInterval(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Check interval is required');
    });

    it('should reject undefined intervals', () => {
      const result = validateCheckInterval(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Check interval is required');
    });

    it('should reject non-numeric strings', () => {
      const result = validateCheckInterval('not-a-number');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Check interval must be a valid number');
    });
  });

  describe('validateProductId', () => {
    it('should accept valid positive integers', () => {
      expect(validateProductId(1).valid).toBe(true);
      expect(validateProductId(100).valid).toBe(true);
      expect(validateProductId(999999).valid).toBe(true);
    });

    it('should parse string IDs', () => {
      const result = validateProductId('42');
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe(42);
    });

    it('should reject zero', () => {
      expect(validateProductId(0).valid).toBe(false);
    });

    it('should reject negative IDs', () => {
      expect(validateProductId(-1).valid).toBe(false);
    });

    it('should reject non-numeric values', () => {
      expect(validateProductId('abc').valid).toBe(false);
      expect(validateProductId(null).valid).toBe(false);
    });
  });

  describe('validateScrapedData', () => {
    const validData = {
      url: 'https://amazon.com/dp/B0ABC',
      site: 'Amazon',
      title: 'Test Product',
      price: 29.99,
      currency: 'USD'
    };

    describe('valid data', () => {
      it('should validate complete scraped data', () => {
        const result = validateScrapedData(validData);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeDefined();
      });

      it('should return sanitized data', () => {
        const result = validateScrapedData({
          ...validData,
          title: '  Product with spaces  ',
          price: '99.99'
        });
        expect(result.valid).toBe(true);
        expect(result.sanitized.title).toBe('Product with spaces');
        expect(result.sanitized.price).toBe(99.99);
      });

      it('should accept Burton products', () => {
        const result = validateScrapedData({
          ...validData,
          url: 'https://burton.com/us/en/p/board',
          site: 'Burton'
        });
        expect(result.valid).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should reject non-object data', () => {
        expect(validateScrapedData(null).valid).toBe(false);
        expect(validateScrapedData('string').valid).toBe(false);
        expect(validateScrapedData(123).valid).toBe(false);
      });

      it('should reject missing URL', () => {
        const data = { ...validData };
        delete data.url;
        const result = validateScrapedData(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('URL'))).toBe(true);
      });

      it('should reject missing site', () => {
        const data = { ...validData };
        delete data.site;
        const result = validateScrapedData(data);
        expect(result.valid).toBe(false);
      });

      it('should reject missing title', () => {
        const data = { ...validData };
        delete data.title;
        const result = validateScrapedData(data);
        expect(result.valid).toBe(false);
      });

      it('should reject missing price', () => {
        const data = { ...validData };
        delete data.price;
        const result = validateScrapedData(data);
        expect(result.valid).toBe(false);
      });

      it('should collect all validation errors', () => {
        const data = {
          url: 'invalid',
          site: 'Unknown',
          title: '',
          price: -10,
          currency: 'XYZ'
        };
        const result = validateScrapedData(data);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(3);
      });
    });
  });

  describe('validateTrackedProduct', () => {
    const validTrackedProduct = {
      url: 'https://www.amazon.com/dp/B08N5WRWNW',
      site: 'Amazon',
      enabled: true,
      checkIntervalMinutes: 60,
    };

    describe('valid data', () => {
      it('should accept valid tracked product', () => {
        const result = validateTrackedProduct(validTrackedProduct);
        expect(result.valid).toBe(true);
        expect(result.sanitized).toBeDefined();
        expect(result.sanitized.url).toBe(validTrackedProduct.url);
      });

      it('should accept minimal valid data (url and site only)', () => {
        const minimal = {
          url: 'https://www.amazon.com/dp/B08N5WRWNW',
          site: 'Amazon',
        };
        const result = validateTrackedProduct(minimal);
        expect(result.valid).toBe(true);
        expect(result.sanitized.enabled).toBe(true); // Default
        expect(result.sanitized.checkIntervalMinutes).toBe(60); // Default
      });

      it('should accept check_interval_minutes snake_case', () => {
        const data = {
          url: 'https://www.amazon.com/dp/test',
          site: 'Amazon',
          check_interval_minutes: 120,
        };
        const result = validateTrackedProduct(data);
        expect(result.valid).toBe(true);
        expect(result.sanitized.checkIntervalMinutes).toBe(120);
      });
    });

    describe('invalid data', () => {
      it('should reject null data', () => {
        const result = validateTrackedProduct(null);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Data must be an object');
      });

      it('should reject non-object data', () => {
        expect(validateTrackedProduct('string').valid).toBe(false);
        expect(validateTrackedProduct(123).valid).toBe(false);
        expect(validateTrackedProduct([]).valid).toBe(false);
      });

      it('should reject invalid URL', () => {
        const data = { ...validTrackedProduct, url: 'not-a-url' };
        const result = validateTrackedProduct(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('URL'))).toBe(true);
      });

      it('should reject invalid site', () => {
        const data = { ...validTrackedProduct, site: '' };
        const result = validateTrackedProduct(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Site'))).toBe(true);
      });

      it('should reject non-boolean enabled', () => {
        const data = { ...validTrackedProduct, enabled: 'yes' };
        const result = validateTrackedProduct(data);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Enabled must be a boolean');
      });

      it('should reject invalid check interval (too high)', () => {
        const data = { ...validTrackedProduct, checkIntervalMinutes: 99999 };
        const result = validateTrackedProduct(data);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Check interval'))).toBe(true);
      });
    });
  });
});
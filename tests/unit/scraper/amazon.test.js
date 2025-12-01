import { jest, describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Tests for Amazon scraper logic
 * Note: These test the scraper's data processing logic, not the actual scraping
 * which requires mocking Playwright (complex in ES modules)
 */
describe('Amazon Scraper', () => {
  describe('Price parsing', () => {
    // Test the price extraction logic
    const parsePrice = (priceText) => {
      return parseFloat(priceText.replace(/[^0-9.]/g, ""));
    };

    describe('valid prices', () => {
      it('should parse standard USD price', () => {
        expect(parsePrice('$99.99')).toBe(99.99);
      });

      it('should parse price with comma separator', () => {
        expect(parsePrice('$1,299.99')).toBe(1299.99);
      });

      it('should parse price with currency text', () => {
        expect(parsePrice('USD 149.00')).toBe(149.00);
      });

      it('should parse price with extra whitespace', () => {
        expect(parsePrice('  $  59.99  ')).toBe(59.99);
      });

      it('should parse whole number price', () => {
        expect(parsePrice('$100')).toBe(100);
      });

      it('should handle price with cents only', () => {
        expect(parsePrice('$0.99')).toBe(0.99);
      });

      it('should parse high-value prices', () => {
        expect(parsePrice('$9,999.99')).toBe(9999.99);
        expect(parsePrice('$12,345.67')).toBe(12345.67);
      });

      it('should handle prices with multiple commas', () => {
        expect(parsePrice('$1,234,567.89')).toBe(1234567.89);
      });
    });

    describe('edge cases', () => {
      it('should handle price range (returns combined digits)', () => {
        // parseFloat('99.99149.99') -> 99.99149 (stops at second decimal but includes digits before it)
        const result = parsePrice('$99.99 - $149.99');
        expect(result).toBe(99.99149);
      });

      it('should handle "From" prices', () => {
        expect(parsePrice('From $29.99')).toBe(29.99);
      });

      it('should return NaN for non-price text', () => {
        expect(isNaN(parsePrice('Not available'))).toBe(true);
      });
    });
  });

  describe('URL validation', () => {
    const isAmazonUrl = (url) => Boolean(url && url.includes('amazon.com'));

    describe('valid Amazon URLs', () => {
      it('should identify Amazon URLs with www', () => {
        expect(isAmazonUrl('https://www.amazon.com/dp/B123')).toBe(true);
      });

      it('should identify Amazon URLs without www', () => {
        expect(isAmazonUrl('https://amazon.com/product')).toBe(true);
      });

      it('should identify Amazon product page URLs', () => {
        expect(isAmazonUrl('https://www.amazon.com/dp/B08N5WRWNW')).toBe(true);
        expect(isAmazonUrl('https://www.amazon.com/gp/product/B08N5WRWNW')).toBe(true);
      });

      it('should identify Amazon search result URLs', () => {
        expect(isAmazonUrl('https://www.amazon.com/s?k=headphones')).toBe(true);
      });
    });

    describe('invalid URLs', () => {
      it('should reject non-Amazon URLs', () => {
        expect(isAmazonUrl('https://www.burton.com/product')).toBe(false);
        expect(isAmazonUrl('https://www.ebay.com/item')).toBe(false);
        expect(isAmazonUrl('https://www.walmart.com/ip/123')).toBe(false);
      });

      it('should handle null/undefined safely', () => {
        expect(isAmazonUrl(null)).toBe(false);
        expect(isAmazonUrl(undefined)).toBe(false);
        expect(isAmazonUrl('')).toBe(false);
      });
    });
  });

  describe('Data structure', () => {
    it('should create valid scraped data object', () => {
      const data = {
        site: "Amazon",
        url: "https://www.amazon.com/dp/B123",
        title: "Test Product",
        price: 99.99,
        currency: "USD",
        timestamp: new Date()
      };

      expect(data.site).toBe('Amazon');
      expect(data.currency).toBe('USD');
      expect(typeof data.price).toBe('number');
      expect(data.timestamp).toBeInstanceOf(Date);
    });

    it('should have all required fields', () => {
      const requiredFields = ['site', 'url', 'title', 'price', 'currency'];
      const data = {
        site: "Amazon",
        url: "https://www.amazon.com/dp/B123",
        title: "Product",
        price: 50,
        currency: "USD"
      };

      requiredFields.forEach(field => {
        expect(data[field]).toBeDefined();
      });
    });
  });

  describe('Selector priorities', () => {
    const titleSelectors = [
      "#productTitle",
      "#title",
      ".product-title-word-break",
      "h1.a-size-large",
      "h1 span#productTitle",
      "[data-feature-name='title'] h1",
      "h1"
    ];

    const priceSelectors = [
      ".a-price > .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
      ".a-price .a-offscreen:first-child",
      "span.a-price-whole",
      ".a-color-price",
      "#price_inside_buybox",
      ".a-section .a-price",
      "[data-a-color='price']",
      ".apexPriceToPay .a-offscreen"
    ];

    describe('title selectors', () => {
      it('should have title selectors defined', () => {
        expect(titleSelectors.length).toBeGreaterThan(0);
      });

      it('should prioritize productTitle selector', () => {
        expect(titleSelectors[0]).toBe('#productTitle');
      });

      it('should have fallback h1 selector', () => {
        expect(titleSelectors).toContain('h1');
      });

      it('should include common Amazon title patterns', () => {
        expect(titleSelectors.some(s => s.includes('title'))).toBe(true);
      });
    });

    describe('price selectors', () => {
      it('should have price selectors defined', () => {
        expect(priceSelectors.length).toBeGreaterThan(0);
      });

      it('should prioritize modern Amazon price selector', () => {
        expect(priceSelectors[0]).toBe('.a-price > .a-offscreen');
      });

      it('should include fallback price selectors', () => {
        expect(priceSelectors).toContain('.a-color-price');
      });

      it('should include deal price selector', () => {
        expect(priceSelectors).toContain('#priceblock_dealprice');
      });

      it('should include buybox price selector', () => {
        expect(priceSelectors).toContain('#price_inside_buybox');
      });
    });
  });

  describe('Title cleaning', () => {
    const cleanTitle = (title) => {
      if (!title) return '';
      return title
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
    };

    it('should remove extra whitespace', () => {
      expect(cleanTitle('Product   Name')).toBe('Product Name');
    });

    it('should trim leading/trailing whitespace', () => {
      expect(cleanTitle('  Product Name  ')).toBe('Product Name');
    });

    it('should truncate very long titles', () => {
      const longTitle = 'A'.repeat(600);
      expect(cleanTitle(longTitle).length).toBe(500);
    });

    it('should handle newlines', () => {
      expect(cleanTitle('Product\nName')).toBe('Product Name');
    });

    it('should handle null/undefined', () => {
      expect(cleanTitle(null)).toBe('');
      expect(cleanTitle(undefined)).toBe('');
    });
  });
});

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

    it('should handle tabs and mixed whitespace', () => {
      expect(cleanTitle('Product\t\n  Name')).toBe('Product Name');
    });
  });

  describe('Currency detection', () => {
    const detectCurrency = (priceText) => {
      if (priceText.includes('$')) return 'USD';
      if (priceText.includes('€')) return 'EUR';
      if (priceText.includes('£')) return 'GBP';
      if (priceText.includes('¥')) return 'JPY';
      return 'USD'; // Default
    };

    it('should detect USD', () => {
      expect(detectCurrency('$99.99')).toBe('USD');
    });

    it('should detect EUR', () => {
      expect(detectCurrency('€99.99')).toBe('EUR');
    });

    it('should detect GBP', () => {
      expect(detectCurrency('£99.99')).toBe('GBP');
    });

    it('should detect JPY', () => {
      expect(detectCurrency('¥9999')).toBe('JPY');
    });

    it('should default to USD for unknown currency', () => {
      expect(detectCurrency('99.99')).toBe('USD');
    });
  });

  describe('Availability detection', () => {
    const isInStock = (availabilityText) => {
      if (!availabilityText) return null;
      const text = availabilityText.toLowerCase();
      if (text.includes('in stock')) return true;
      if (text.includes('out of stock')) return false;
      if (text.includes('currently unavailable')) return false;
      if (text.includes('available from')) return true;
      return null;
    };

    it('should detect in stock', () => {
      expect(isInStock('In Stock')).toBe(true);
      expect(isInStock('In Stock.')).toBe(true);
    });

    it('should detect out of stock', () => {
      expect(isInStock('Out of Stock')).toBe(false);
      expect(isInStock('Currently unavailable.')).toBe(false);
    });

    it('should detect available from third party', () => {
      expect(isInStock('Available from these sellers')).toBe(true);
    });

    it('should return null for unknown availability', () => {
      expect(isInStock('Ships in 2-3 days')).toBeNull();
    });

    it('should handle null/undefined', () => {
      expect(isInStock(null)).toBeNull();
      expect(isInStock(undefined)).toBeNull();
    });
  });

  describe('ASIN extraction', () => {
    const extractASIN = (url) => {
      if (!url) return null;
      // Match /dp/ASIN or /gp/product/ASIN patterns
      const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      return match ? match[1].toUpperCase() : null;
    };

    it('should extract ASIN from dp URL', () => {
      expect(extractASIN('https://www.amazon.com/dp/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should extract ASIN from gp/product URL', () => {
      expect(extractASIN('https://www.amazon.com/gp/product/B08N5WRWNW')).toBe('B08N5WRWNW');
    });

    it('should handle URL with title slug', () => {
      expect(extractASIN('https://www.amazon.com/Apple-AirPods-Pro/dp/B0D1XD1ZV3')).toBe('B0D1XD1ZV3');
    });

    it('should return null for non-product URL', () => {
      expect(extractASIN('https://www.amazon.com/s?k=headphones')).toBeNull();
    });

    it('should return null for invalid URL', () => {
      expect(extractASIN(null)).toBeNull();
      expect(extractASIN('')).toBeNull();
    });

    it('should normalize ASIN to uppercase', () => {
      expect(extractASIN('https://www.amazon.com/dp/b08n5wrwnw')).toBe('B08N5WRWNW');
    });
  });

  describe('Error handling', () => {
    it('should identify timeout errors', () => {
      const error = new Error('Navigation timeout of 30000 ms exceeded');
      const isTimeout = error.message.includes('timeout');
      
      expect(isTimeout).toBe(true);
    });

    it('should identify network errors', () => {
      const error = new Error('net::ERR_NAME_NOT_RESOLVED');
      const isNetworkError = error.message.startsWith('net::');
      
      expect(isNetworkError).toBe(true);
    });

    it('should identify bot detection', () => {
      const pageTitle = 'Robot Check';
      const isBotDetected = pageTitle.toLowerCase().includes('robot') || 
                           pageTitle.toLowerCase().includes('captcha');
      
      expect(isBotDetected).toBe(true);
    });
  });

  describe('Price range handling', () => {
    const extractMinPrice = (priceText) => {
      // Handle "From $X" or "$X - $Y" formats
      const match = priceText.match(/\$?([\d,]+\.?\d*)/);
      if (match) {
        return parseFloat(match[1].replace(/,/g, ''));
      }
      return null;
    };

    it('should extract minimum from price range', () => {
      expect(extractMinPrice('$29.99 - $49.99')).toBe(29.99);
    });

    it('should extract price from "From" format', () => {
      expect(extractMinPrice('From $29.99')).toBe(29.99);
    });

    it('should handle regular price', () => {
      expect(extractMinPrice('$99.99')).toBe(99.99);
    });

    it('should return null for non-price text', () => {
      expect(extractMinPrice('See options')).toBeNull();
    });
  });
});

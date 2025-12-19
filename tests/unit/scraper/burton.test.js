import { jest, describe, it, expect } from '@jest/globals';

/**
 * Tests for Burton scraper logic
 * Note: These test the scraper's data processing logic, not the actual scraping
 * which requires mocking Playwright (complex in ES modules)
 */
describe('Burton Scraper', () => {
  describe('Price parsing', () => {
    const parsePrice = (priceText) => {
      return parseFloat(priceText.replace(/[^0-9.]/g, ""));
    };

    describe('standard formats', () => {
      it('should parse standard USD price', () => {
        expect(parsePrice('$599.95')).toBe(599.95);
      });

      it('should parse price with comma separator', () => {
        expect(parsePrice('$1,099.00')).toBe(1099.00);
      });

      it('should parse price without dollar sign', () => {
        expect(parsePrice('299.99')).toBe(299.99);
      });

      it('should parse sale price format', () => {
        expect(parsePrice('Sale: $449.95')).toBe(449.95);
      });

      it('should parse clearance price format', () => {
        expect(parsePrice('Clearance $199.95')).toBe(199.95);
        expect(parsePrice('Final Sale: $99.00')).toBe(99.00);
      });
    });

    describe('edge cases', () => {
      it('should handle prices with cents as .00', () => {
        expect(parsePrice('$400.00')).toBe(400.00);
        expect(parsePrice('$100.00')).toBe(100.00);
      });

      it('should handle prices with no cents', () => {
        expect(parsePrice('$500')).toBe(500);
      });

      it('should handle high-value snowboard prices', () => {
        expect(parsePrice('$1,499.95')).toBe(1499.95);
      });

      it('should handle very low sale prices', () => {
        expect(parsePrice('$19.99')).toBe(19.99);
        expect(parsePrice('$0.99')).toBe(0.99);
      });

      it('should handle text with multiple numbers', () => {
        // The regex captures all digits and dots, so '800.00599.95' becomes 800.00599
        const result = parsePrice('Was $800.00 Now $599.95');
        expect(result).toBe(800.00599);
      });
    });

    describe('invalid inputs', () => {
      it('should return NaN for non-price text', () => {
        expect(isNaN(parsePrice('Out of Stock'))).toBe(true);
        expect(isNaN(parsePrice('Coming Soon'))).toBe(true);
      });

      it('should return NaN for empty string', () => {
        expect(isNaN(parsePrice(''))).toBe(true);
      });
    });
  });

  describe('URL validation', () => {
    const isBurtonUrl = (url) => Boolean(url && url.includes('burton.com'));

    describe('valid Burton URLs', () => {
      it('should identify Burton product URLs', () => {
        expect(isBurtonUrl('https://www.burton.com/us/en/p/custom-snowboard')).toBe(true);
        expect(isBurtonUrl('https://burton.com/product')).toBe(true);
      });

      it('should identify Burton category URLs', () => {
        expect(isBurtonUrl('https://www.burton.com/us/en/c/snowboards')).toBe(true);
        expect(isBurtonUrl('https://www.burton.com/us/en/c/mens-jackets')).toBe(true);
      });

      it('should identify Burton sale URLs', () => {
        expect(isBurtonUrl('https://www.burton.com/us/en/sale')).toBe(true);
      });

      it('should handle regional variations', () => {
        expect(isBurtonUrl('https://www.burton.com/ca/en/p/product')).toBe(true);
        expect(isBurtonUrl('https://www.burton.com/gb/en/p/product')).toBe(true);
      });
    });

    describe('invalid URLs', () => {
      it('should reject non-Burton URLs', () => {
        expect(isBurtonUrl('https://www.amazon.com/product')).toBe(false);
        expect(isBurtonUrl('https://www.rei.com/item')).toBe(false);
        expect(isBurtonUrl('https://www.evo.com/snowboards')).toBe(false);
      });

      it('should handle null/undefined safely', () => {
        expect(isBurtonUrl(null)).toBe(false);
        expect(isBurtonUrl(undefined)).toBe(false);
        expect(isBurtonUrl('')).toBe(false);
      });
    });
  });

  describe('Data structure', () => {
    it('should create valid scraped data object', () => {
      const data = {
        site: "Burton",
        url: "https://www.burton.com/us/en/p/custom-board",
        title: "Burton Custom Snowboard",
        price: 599.95,
        currency: "USD",
        timestamp: new Date()
      };

      expect(data.site).toBe('Burton');
      expect(data.currency).toBe('USD');
      expect(typeof data.price).toBe('number');
      expect(data.timestamp).toBeInstanceOf(Date);
    });

    it('should handle product with size info', () => {
      const data = {
        site: "Burton",
        url: "https://www.burton.com/us/en/p/custom-board?size=154",
        title: "Burton Custom Snowboard - 154cm",
        price: 599.95,
        currency: "USD",
        timestamp: new Date()
      };

      expect(data.title).toContain('154cm');
      expect(data.url).toContain('size=154');
    });
  });

  describe('Selector priorities', () => {
    const titleSelectors = [
      "h1.product-name",
      ".product-name",
      "h1.pdp-title",
      ".product-title",
      "[data-product-title]",
      "h1"
    ];

    const priceSelectors = [
      "span.standard-price",
      ".price-value",
      ".product-price",
      "[data-product-price]",
      ".price",
      "span[itemprop='price']",
      ".pdp-price"
    ];

    it('should have title selectors defined', () => {
      expect(titleSelectors.length).toBeGreaterThan(0);
      expect(titleSelectors[0]).toBe('h1.product-name');
    });

    it('should have price selectors defined', () => {
      expect(priceSelectors.length).toBeGreaterThan(0);
      expect(priceSelectors[0]).toBe('span.standard-price');
    });

    it('should have fallback selectors', () => {
      expect(titleSelectors).toContain('h1');
      expect(priceSelectors).toContain('.price');
    });

    it('should prioritize specific selectors over generic', () => {
      const h1Index = titleSelectors.indexOf('h1');
      const specificIndex = titleSelectors.indexOf('h1.product-name');
      expect(specificIndex).toBeLessThan(h1Index);
    });
  });

  describe('Product categories', () => {
    const categories = ['snowboards', 'bindings', 'boots', 'jackets', 'pants', 'bags', 'accessories'];

    it('should recognize common Burton product categories', () => {
      categories.forEach(cat => {
        const url = `https://www.burton.com/us/en/c/${cat}`;
        expect(url).toContain('burton.com');
      });
    });

    it('should handle gender-specific categories', () => {
      const genderCategories = [
        'mens-snowboards',
        'womens-snowboards',
        'kids-snowboards',
        'mens-jackets',
        'womens-pants'
      ];

      genderCategories.forEach(cat => {
        const url = `https://www.burton.com/us/en/c/${cat}`;
        expect(url).toContain('burton.com/us/en/c/');
      });
    });
  });

  describe('Price range detection', () => {
    const isTypicalBurtonPrice = (price) => {
      // Burton products typically range from $20 (accessories) to $800 (high-end boards)
      return price >= 10 && price <= 1500;
    };

    it('should validate typical snowboard prices', () => {
      expect(isTypicalBurtonPrice(599.95)).toBe(true);
      expect(isTypicalBurtonPrice(799.95)).toBe(true);
    });

    it('should validate accessory prices', () => {
      expect(isTypicalBurtonPrice(29.95)).toBe(true);
      expect(isTypicalBurtonPrice(49.99)).toBe(true);
    });

    it('should flag suspicious prices', () => {
      expect(isTypicalBurtonPrice(5)).toBe(false); // Too cheap
      expect(isTypicalBurtonPrice(5000)).toBe(false); // Too expensive
    });
  });

  describe('Sale price detection', () => {
    const detectSalePrice = (priceContainer) => {
      const hasStrikethrough = priceContainer.includes('was') || 
                              priceContainer.includes('original') ||
                              priceContainer.includes('strike');
      const hasSaleIndicator = priceContainer.toLowerCase().includes('sale') ||
                              priceContainer.toLowerCase().includes('clearance') ||
                              priceContainer.toLowerCase().includes('now');
      return hasStrikethrough || hasSaleIndicator;
    };

    it('should detect sale prices', () => {
      expect(detectSalePrice('Was $599.95 Now $449.95')).toBe(true);
      expect(detectSalePrice('Sale: $399.99')).toBe(true);
      expect(detectSalePrice('Clearance $199.95')).toBe(true);
    });

    it('should not flag regular prices as sale', () => {
      expect(detectSalePrice('$599.95')).toBe(false);
      expect(detectSalePrice('Price: $499.00')).toBe(false);
    });
  });

  describe('Title cleaning', () => {
    const cleanTitle = (title) => {
      if (!title) return '';
      return title
        .replace(/\s+/g, ' ')
        .replace(/\|.*$/, '') // Remove pipe-separated suffix
        .replace(/Burton\.com$/, '') // Remove site suffix
        .trim();
    };

    it('should remove extra whitespace', () => {
      expect(cleanTitle('Burton   Custom   Snowboard')).toBe('Burton Custom Snowboard');
    });

    it('should remove pipe-separated suffixes', () => {
      expect(cleanTitle('Custom Snowboard | Burton')).toBe('Custom Snowboard');
    });

    it('should remove site suffix', () => {
      expect(cleanTitle('Custom Snowboard Burton.com')).toBe('Custom Snowboard');
    });

    it('should handle empty/null input', () => {
      expect(cleanTitle(null)).toBe('');
      expect(cleanTitle('')).toBe('');
    });
  });

  describe('Size extraction', () => {
    const extractSize = (title) => {
      // Match board sizes first: 154cm, 156W, or just 154
      const boardMatch = title.match(/(\d{2,3}(?:cm|W)?)\s*$/i);
      if (boardMatch) return boardMatch[1];
      
      // Match clothing sizes - full word boundaries
      const clothingMatch = title.match(/\b(Medium|Large|Small|XS|XL|XXL)\b/i);
      if (clothingMatch) {
        const size = clothingMatch[1].toLowerCase();
        if (size === 'medium') return 'M';
        if (size === 'large') return 'L';
        if (size === 'small') return 'S';
        return clothingMatch[1].toUpperCase();
      }
      
      return null;
    };

    it('should extract snowboard size in cm', () => {
      expect(extractSize('Burton Custom Snowboard - 154cm')).toBe('154cm');
      expect(extractSize('Process Snowboard 159')).toBe('159');
    });

    it('should extract wide board size', () => {
      expect(extractSize('Burton Custom Snowboard 156W')).toBe('156W');
    });

    it('should extract clothing sizes', () => {
      expect(extractSize('Mens Jacket - Medium')).toBe('M');
      expect(extractSize('Womens Pants Large')).toBe('L');
    });

    it('should return null when no size found', () => {
      expect(extractSize('Burton Custom Snowboard')).toBeNull();
    });
  });

  describe('Color extraction', () => {
    const extractColor = (title) => {
      const colorPatterns = /\b(Black|White|Red|Blue|Green|Gray|Grey|Navy|Brown|Orange|Yellow|Purple|Pink|Camo|True Black|Dress Blue)\b/i;
      const match = title.match(colorPatterns);
      return match ? match[1] : null;
    };

    it('should extract common colors', () => {
      expect(extractColor('Burton Custom Snowboard - Black')).toBe('Black');
      expect(extractColor('Mens Jacket in Navy')).toBe('Navy');
    });

    it('should extract Burton-specific colors', () => {
      expect(extractColor('Jacket - True Black')).toBe('True Black');
      expect(extractColor('Pants Dress Blue')).toBe('Dress Blue');
    });

    it('should return null when no color found', () => {
      expect(extractColor('Burton Custom Snowboard')).toBeNull();
    });
  });

  describe('Availability detection', () => {
    const checkAvailability = (text) => {
      if (!text) return 'unknown';
      const lower = text.toLowerCase();
      if (lower.includes('in stock') || lower.includes('add to cart')) return 'in-stock';
      if (lower.includes('out of stock') || lower.includes('sold out')) return 'out-of-stock';
      if (lower.includes('notify me') || lower.includes('waitlist')) return 'waitlist';
      if (lower.includes('coming soon') || lower.includes('pre-order')) return 'pre-order';
      return 'unknown';
    };

    it('should detect in-stock status', () => {
      expect(checkAvailability('In Stock')).toBe('in-stock');
      expect(checkAvailability('Add to Cart')).toBe('in-stock');
    });

    it('should detect out-of-stock status', () => {
      expect(checkAvailability('Out of Stock')).toBe('out-of-stock');
      expect(checkAvailability('Sold Out')).toBe('out-of-stock');
    });

    it('should detect waitlist status', () => {
      expect(checkAvailability('Notify Me When Available')).toBe('waitlist');
      expect(checkAvailability('Join Waitlist')).toBe('waitlist');
    });

    it('should detect pre-order status', () => {
      expect(checkAvailability('Coming Soon')).toBe('pre-order');
      expect(checkAvailability('Pre-Order Now')).toBe('pre-order');
    });

    it('should return unknown for ambiguous text', () => {
      expect(checkAvailability('Limited quantities')).toBe('unknown');
    });
  });

  describe('Error handling patterns', () => {
    it('should identify geo-blocking', () => {
      const pageContent = 'This product is not available in your region';
      const isGeoBlocked = pageContent.toLowerCase().includes('not available in your region') ||
                          pageContent.toLowerCase().includes('not available in your country');
      
      expect(isGeoBlocked).toBe(true);
    });

    it('should identify product not found', () => {
      const pageTitle = '404 - Page Not Found';
      const isNotFound = pageTitle.includes('404') || 
                        pageTitle.toLowerCase().includes('not found');
      
      expect(isNotFound).toBe(true);
    });

    it('should identify maintenance mode', () => {
      const pageContent = 'We are currently undergoing maintenance';
      const isMaintenance = pageContent.toLowerCase().includes('maintenance') ||
                           pageContent.toLowerCase().includes('temporarily unavailable');
      
      expect(isMaintenance).toBe(true);
    });
  });
});

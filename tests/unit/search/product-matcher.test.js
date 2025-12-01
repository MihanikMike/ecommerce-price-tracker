import { describe, it, expect } from '@jest/globals';
import productMatcher, { findBestMatch, calculateMatchScore, comparePrices } from '../../../src/search/product-matcher.js';

// Access internal functions through the default export
const { levenshteinDistance, normalizeText, tokenize } = productMatcher;

describe('product-matcher', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should return string length for empty comparison', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'hello')).toBe(5);
    });

    it('should return 0 for two empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should calculate single character difference', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
      expect(levenshteinDistance('cat', 'car')).toBe(1);
    });

    it('should handle insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    it('should handle deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });

    it('should handle multiple edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should be case sensitive', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
    });
  });

  describe('normalizeText', () => {
    it('should convert to lowercase', () => {
      expect(normalizeText('HELLO World')).toBe('hello world');
    });

    it('should remove special characters', () => {
      expect(normalizeText('hello-world!')).toBe('hello world');
      expect(normalizeText('product@#$%name')).toBe('product name');
    });

    it('should normalize whitespace', () => {
      expect(normalizeText('hello    world')).toBe('hello world');
      expect(normalizeText('  hello  world  ')).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });

    it('should preserve numbers', () => {
      expect(normalizeText('iPhone 15 Pro')).toBe('iphone 15 pro');
    });

    it('should handle complex product names', () => {
      expect(normalizeText('Sony WH-1000XM5 (Black)')).toBe('sony wh 1000xm5 black');
    });
  });

  describe('tokenize', () => {
    it('should split text into words', () => {
      expect(tokenize('hello world')).toEqual(['hello', 'world']);
    });

    it('should filter single character words', () => {
      expect(tokenize('a big cat')).toEqual(['big', 'cat']);
    });

    it('should normalize before tokenizing', () => {
      expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
    });

    it('should handle empty string', () => {
      expect(tokenize('')).toEqual([]);
    });

    it('should handle product names', () => {
      expect(tokenize('Apple iPhone 15 Pro Max')).toEqual(['apple', 'iphone', '15', 'pro', 'max']);
    });
  });

  describe('comparePrices', () => {
    it('should return null values for empty array', () => {
      const result = comparePrices([]);

      expect(result.lowestPrice).toBeNull();
      expect(result.highestPrice).toBeNull();
      expect(result.averagePrice).toBeNull();
      expect(result.priceRange).toBeNull();
    });

    it('should return null values for null/undefined input', () => {
      const result = comparePrices(null);

      expect(result.lowestPrice).toBeNull();
    });

    it('should find lowest and highest prices', () => {
      const products = [
        { title: 'Product A', price: 99.99, site: 'Amazon' },
        { title: 'Product B', price: 149.99, site: 'BestBuy' },
        { title: 'Product C', price: 79.99, site: 'Walmart' },
      ];

      const result = comparePrices(products);

      expect(result.lowestPrice.price).toBe(79.99);
      expect(result.lowestPrice.site).toBe('Walmart');
      expect(result.highestPrice.price).toBe(149.99);
      expect(result.highestPrice.site).toBe('BestBuy');
    });

    it('should calculate average price', () => {
      const products = [
        { title: 'A', price: 100, site: 'Amazon' },
        { title: 'B', price: 200, site: 'BestBuy' },
        { title: 'C', price: 300, site: 'Walmart' },
      ];

      const result = comparePrices(products);

      expect(result.averagePrice).toBe(200);
    });

    it('should calculate price range', () => {
      const products = [
        { title: 'A', price: 50, site: 'Amazon' },
        { title: 'B', price: 150, site: 'BestBuy' },
      ];

      const result = comparePrices(products);

      expect(result.priceRange).toBe(100);
      expect(result.savings).toBe(100);
    });

    it('should calculate savings percentage', () => {
      const products = [
        { title: 'A', price: 80, site: 'Amazon' },
        { title: 'B', price: 100, site: 'BestBuy' },
      ];

      const result = comparePrices(products);

      expect(result.savingsPercent).toBe(20); // 20% savings
    });

    it('should filter out products with zero or invalid prices', () => {
      const products = [
        { title: 'A', price: 100, site: 'Amazon' },
        { title: 'B', price: 0, site: 'BestBuy' },
        { title: 'C', price: -50, site: 'Walmart' },
        { title: 'D', price: null, site: 'Target' },
      ];

      const result = comparePrices(products);

      expect(result.lowestPrice.price).toBe(100);
      expect(result.allPrices.length).toBe(1);
    });

    it('should generate best_price recommendation', () => {
      const products = [
        { title: 'A', price: 99, site: 'Amazon' },
        { title: 'B', price: 129, site: 'BestBuy' },
      ];

      const result = comparePrices(products);

      expect(result.recommendations.length).toBeGreaterThan(0);
      const bestPrice = result.recommendations.find(r => r.type === 'best_price');
      expect(bestPrice).toBeDefined();
      expect(bestPrice.message).toContain('Amazon');
    });

    it('should generate savings_opportunity when difference is significant', () => {
      const products = [
        { title: 'A', price: 80, site: 'Amazon' },
        { title: 'B', price: 100, site: 'BestBuy' },
      ];

      const result = comparePrices(products);

      const savingsRec = result.recommendations.find(r => r.type === 'savings_opportunity');
      expect(savingsRec).toBeDefined();
      expect(savingsRec.savings).toBe('20.00');
    });

    it('should include all prices sorted in result', () => {
      const products = [
        { title: 'A', price: 150, site: 'Amazon', url: 'a.com' },
        { title: 'B', price: 100, site: 'BestBuy', url: 'b.com' },
        { title: 'C', price: 125, site: 'Walmart', url: 'c.com' },
      ];

      const result = comparePrices(products);

      expect(result.allPrices.length).toBe(3);
      expect(result.allPrices[0].price).toBe(100);
      expect(result.allPrices[1].price).toBe(125);
      expect(result.allPrices[2].price).toBe(150);
    });

    it('should handle single product', () => {
      const products = [{ title: 'A', price: 100, site: 'Amazon' }];

      const result = comparePrices(products);

      expect(result.lowestPrice.price).toBe(100);
      expect(result.highestPrice.price).toBe(100);
      expect(result.priceRange).toBe(0);
    });

    it('should handle available/unavailable products', () => {
      const products = [
        { title: 'A', price: 80, site: 'Amazon', available: false },
        { title: 'B', price: 100, site: 'BestBuy', available: true },
        { title: 'C', price: 90, site: 'Walmart', available: true },
      ];

      const result = comparePrices(products);

      // Should still include unavailable in lowest if it's cheapest
      expect(result.lowestPrice.price).toBe(80);
      
      // Should have best_available recommendation
      const bestAvailable = result.recommendations.find(r => r.type === 'best_available');
      expect(bestAvailable).toBeDefined();
    });
  });

  describe('calculateMatchScore', () => {
    describe('exact and near-exact matches', () => {
      it('should score exact match highly', () => {
        const score = calculateMatchScore({
          query: 'Apple AirPods Pro',
          productTitle: 'Apple AirPods Pro',
          productPrice: 249
        });
        
        expect(score.score).toBeGreaterThan(70);
        expect(score.confidence).toBeDefined();
      });

      it('should score exact match with different casing', () => {
        const score = calculateMatchScore({
          query: 'apple airpods pro',
          productTitle: 'Apple AirPods Pro',
          productPrice: 249
        });
        
        expect(score.score).toBeGreaterThan(60);
      });

      it('should handle product with model number', () => {
        const score = calculateMatchScore({
          query: 'Sony WH-1000XM4',
          productTitle: 'Sony WH-1000XM4 Wireless Noise Canceling Headphones',
          productPrice: 350
        });
        
        expect(score.score).toBeGreaterThan(50);
      });
    });

    describe('partial matches', () => {
      it('should score partial match lower', () => {
        const score = calculateMatchScore({
          query: 'Apple AirPods Pro',
          productTitle: 'Generic Earbuds',
          productPrice: 29
        });
        
        expect(score.score).toBeLessThan(50);
      });

      it('should give some score for brand match only', () => {
        const score = calculateMatchScore({
          query: 'Sony Headphones',
          productTitle: 'Sony Bluetooth Speaker',
          productPrice: 100
        });
        
        expect(score.score).toBeGreaterThan(0);
        expect(score.score).toBeLessThan(70);
      });

      it('should score accessories lower than main product', () => {
        const mainScore = calculateMatchScore({
          query: 'Apple AirPods Pro',
          productTitle: 'Apple AirPods Pro 2nd Gen',
          productPrice: 249
        });
        
        const accessoryScore = calculateMatchScore({
          query: 'Apple AirPods Pro',
          productTitle: 'AirPods Pro Case Cover',
          productPrice: 12
        });
        
        expect(mainScore.score).toBeGreaterThan(accessoryScore.score);
      });
    });

    describe('score components', () => {
      it('should return score components', () => {
        const score = calculateMatchScore({
          query: 'Sony Headphones',
          productTitle: 'Sony WH-1000XM4 Headphones',
          productPrice: 350
        });
        
        expect(score.components).toBeDefined();
        expect(score.components.wordOverlap).toBeDefined();
        expect(score.weights).toBeDefined();
      });

      it('should include confidence level', () => {
        const score = calculateMatchScore({
          query: 'iPhone 15 Pro',
          productTitle: 'Apple iPhone 15 Pro Max 256GB',
          productPrice: 1199
        });
        
        expect(score.confidence).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(score.confidence);
      });
    });

    describe('edge cases', () => {
      it('should handle empty query', () => {
        const score = calculateMatchScore({
          query: '',
          productTitle: 'Some Product',
          productPrice: 100
        });
        
        expect(score.score).toBeLessThan(20);
      });

      it('should handle very long product titles', () => {
        const score = calculateMatchScore({
          query: 'Headphones',
          productTitle: 'Premium Wireless Bluetooth Headphones with Active Noise Cancellation and Hi-Res Audio Support Compatible with All Devices',
          productPrice: 200
        });
        
        expect(score.score).toBeGreaterThan(0);
      });

      it('should handle special characters', () => {
        const score = calculateMatchScore({
          query: 'iPhone 15',
          productTitle: 'iPhone 15 - 128GB (PRODUCT)RED',
          productPrice: 799
        });
        
        expect(score.score).toBeGreaterThan(30);
      });
    });
  });

  describe('findBestMatch', () => {
    const products = [
      { title: 'Apple AirPods Pro 2nd Gen', price: 249, url: 'https://amazon.com/1' },
      { title: 'Sony WF-1000XM4 Earbuds', price: 278, url: 'https://amazon.com/2' },
      { title: 'AirPods Pro Case Cover', price: 12, url: 'https://amazon.com/3' },
      { title: 'Samsung Galaxy Buds Pro', price: 199, url: 'https://amazon.com/4' },
    ];

    describe('successful matching', () => {
      it('should find best matching product', () => {
        const result = findBestMatch('Apple AirPods Pro', [], products, {});
        
        expect(result).toBeDefined();
        expect(result.bestMatch).toBeDefined();
        expect(result.bestMatch.title).toContain('AirPods');
      });

      it('should prefer main product over accessories', () => {
        const result = findBestMatch('Apple AirPods Pro', [], products, {});
        
        expect(result.bestMatch.title).not.toContain('Case');
      });

      it('should match different brands correctly', () => {
        const result = findBestMatch('Sony Earbuds', [], products, {});
        
        expect(result.bestMatch).toBeDefined();
        expect(result.bestMatch.title).toContain('Sony');
      });
    });

    describe('no match scenarios', () => {
      it('should return null bestMatch for empty products array', () => {
        const result = findBestMatch('AirPods', [], [], {});
        
        expect(result.bestMatch).toBeNull();
      });

      it('should filter out low-scoring matches', () => {
        const result = findBestMatch('PlayStation 5 Console', [], products, {
          minScore: 50
        });
        
        expect(result.bestMatch).toBeNull();
      });

      it('should return null for completely unrelated query', () => {
        const result = findBestMatch('Kitchen Blender', [], products, {
          minScore: 40
        });
        
        expect(result.bestMatch).toBeNull();
      });
    });

    describe('result structure', () => {
      it('should return all scored results', () => {
        const result = findBestMatch('AirPods', [], products, {});
        
        expect(result.scoredResults).toBeDefined();
        expect(Array.isArray(result.scoredResults)).toBe(true);
      });

      it('should sort results by matchScore descending', () => {
        const result = findBestMatch('AirPods Pro', [], products, {});
        
        const scores = result.scoredResults.map(r => r.matchScore);
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      });

      it('should include original product data in results', () => {
        const result = findBestMatch('Apple AirPods', [], products, {});
        
        expect(result.bestMatch.url).toBeDefined();
        expect(result.bestMatch.price).toBeDefined();
      });
    });

    describe('options', () => {
      it('should respect minScore option', () => {
        const lowThreshold = findBestMatch('AirPods', [], products, { minScore: 10 });
        const highThreshold = findBestMatch('AirPods', [], products, { minScore: 90 });
        
        expect(lowThreshold.bestMatch).not.toBeNull();
        expect(highThreshold.bestMatch).toBeNull();
      });
    });
  });
});

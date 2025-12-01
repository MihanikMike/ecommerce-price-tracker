import { describe, it, expect } from '@jest/globals';
import { findBestMatch, calculateMatchScore } from '../../../src/search/product-matcher.js';

describe('product-matcher', () => {
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

import { describe, it, expect } from '@jest/globals';
import { findBestMatch, calculateMatchScore } from '../../../src/search/product-matcher.js';

describe('product-matcher', () => {
  describe('calculateMatchScore', () => {
    it('should score exact match highly', () => {
      const score = calculateMatchScore({
        query: 'Apple AirPods Pro',
        productTitle: 'Apple AirPods Pro',
        productPrice: 249
      });
      
      expect(score.score).toBeGreaterThan(70);
      expect(score.confidence).toBeDefined();
    });

    it('should score partial match lower', () => {
      const score = calculateMatchScore({
        query: 'Apple AirPods Pro',
        productTitle: 'Generic Earbuds',
        productPrice: 29
      });
      
      expect(score.score).toBeLessThan(50);
    });

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
  });

  describe('findBestMatch', () => {
    const products = [
      { title: 'Apple AirPods Pro 2nd Gen', price: 249, url: 'https://amazon.com/1' },
      { title: 'Sony WF-1000XM4 Earbuds', price: 278, url: 'https://amazon.com/2' },
      { title: 'AirPods Pro Case Cover', price: 12, url: 'https://amazon.com/3' },
    ];

    it('should find best matching product', () => {
      const result = findBestMatch('Apple AirPods Pro', [], products, {});
      
      expect(result).toBeDefined();
      expect(result.bestMatch).toBeDefined();
    });

    it('should return null bestMatch for empty products array', () => {
      const result = findBestMatch('AirPods', [], [], {});
      
      expect(result.bestMatch).toBeNull();
    });

    it('should filter out low-scoring matches', () => {
      const result = findBestMatch('PlayStation 5 Console', [], products, {
        minScore: 50
      });
      
      // None of these products should match PS5 well
      expect(result.bestMatch).toBeNull();
    });

    it('should return all scored results', () => {
      const result = findBestMatch('AirPods', [], products, {});
      
      expect(result.scoredResults).toBeDefined();
      expect(Array.isArray(result.scoredResults)).toBe(true);
    });
  });
});

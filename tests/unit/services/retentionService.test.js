import { describe, it, expect } from '@jest/globals';
import { getRetentionPolicy } from '../../../src/services/retentionService.js';

describe('retentionService', () => {
  describe('getRetentionPolicy', () => {
    it('should return default retention policy', () => {
      const policy = getRetentionPolicy();
      
      expect(policy).toBeDefined();
      expect(policy.priceHistoryDays).toBeDefined();
      expect(typeof policy.priceHistoryDays).toBe('number');
    });

    it('should have reasonable defaults', () => {
      const policy = getRetentionPolicy();
      
      // Price history should be retained for at least 30 days
      expect(policy.priceHistoryDays).toBeGreaterThanOrEqual(30);
    });

    it('should have minPriceRecordsPerProduct', () => {
      const policy = getRetentionPolicy();
      
      expect(policy.minPriceRecordsPerProduct).toBeDefined();
      expect(typeof policy.minPriceRecordsPerProduct).toBe('number');
      expect(policy.minPriceRecordsPerProduct).toBeGreaterThan(0);
    });

    it('should have staleProductDays', () => {
      const policy = getRetentionPolicy();
      
      expect(policy.staleProductDays).toBeDefined();
      expect(typeof policy.staleProductDays).toBe('number');
      expect(policy.staleProductDays).toBeGreaterThan(0);
    });

    it('should have searchResultDays', () => {
      const policy = getRetentionPolicy();
      
      expect(policy.searchResultDays).toBeDefined();
      expect(typeof policy.searchResultDays).toBe('number');
      expect(policy.searchResultDays).toBeGreaterThan(0);
    });

    it('should have deleteBatchSize', () => {
      const policy = getRetentionPolicy();
      
      expect(policy.deleteBatchSize).toBeDefined();
      expect(typeof policy.deleteBatchSize).toBe('number');
      expect(policy.deleteBatchSize).toBeGreaterThan(0);
    });

    it('should have keepDailySamples boolean', () => {
      const policy = getRetentionPolicy();
      
      expect(policy.keepDailySamples).toBeDefined();
      expect(typeof policy.keepDailySamples).toBe('boolean');
    });

    it('should return complete policy object', () => {
      const policy = getRetentionPolicy();
      
      // All expected fields should be present
      const expectedFields = [
        'priceHistoryDays',
        'minPriceRecordsPerProduct',
        'staleProductDays',
        'searchResultDays',
        'deleteBatchSize',
        'keepDailySamples',
      ];

      expectedFields.forEach(field => {
        expect(policy).toHaveProperty(field);
      });
    });

    it('should have sensible retention periods', () => {
      const policy = getRetentionPolicy();
      
      // Stale product threshold should be longer than price history
      expect(policy.staleProductDays).toBeGreaterThanOrEqual(policy.priceHistoryDays);
    });
  });
});

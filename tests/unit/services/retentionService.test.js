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
  });

  // Note: getDatabaseStats requires database connection
  // Those tests belong in integration tests
});

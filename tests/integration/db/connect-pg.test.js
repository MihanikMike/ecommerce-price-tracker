import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase } from '../../setup/testDatabase.js';

// Import actual functions from connect-pg
import { checkDatabaseHealth, getPoolStats } from '../../../src/db/connect-pg.js';

/**
 * Integration tests for connect-pg database utilities
 * Tests database health check and pool statistics functions
 */
describe('connect-pg', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await closeTestDatabase();
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when database is available', async () => {
      const result = await checkDatabaseHealth();
      
      expect(result.healthy).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should return a valid timestamp from the database', async () => {
      const result = await checkDatabaseHealth();
      
      expect(result.healthy).toBe(true);
      // Verify it's a valid date
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics object', () => {
      const stats = getPoolStats();
      
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('idleCount');
      expect(stats).toHaveProperty('waitingCount');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats).toHaveProperty('utilizationPercent');
    });

    it('should return numeric values for all stats', () => {
      const stats = getPoolStats();
      
      expect(typeof stats.totalCount).toBe('number');
      expect(typeof stats.idleCount).toBe('number');
      expect(typeof stats.waitingCount).toBe('number');
      expect(typeof stats.maxConnections).toBe('number');
      expect(typeof stats.utilizationPercent).toBe('number');
    });

    it('should have non-negative counts', () => {
      const stats = getPoolStats();
      
      expect(stats.totalCount).toBeGreaterThanOrEqual(0);
      expect(stats.idleCount).toBeGreaterThanOrEqual(0);
      expect(stats.waitingCount).toBeGreaterThanOrEqual(0);
    });

    it('should have utilization between 0 and 100', () => {
      const stats = getPoolStats();
      
      expect(stats.utilizationPercent).toBeGreaterThanOrEqual(0);
      expect(stats.utilizationPercent).toBeLessThanOrEqual(100);
    });

    it('should have idle count not exceeding total count', () => {
      const stats = getPoolStats();
      
      expect(stats.idleCount).toBeLessThanOrEqual(stats.totalCount);
    });
  });
});

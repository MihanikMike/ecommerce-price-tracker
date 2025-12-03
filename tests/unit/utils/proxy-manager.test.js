import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getRandomProxy,
  getNextProxy,
  getFastestProxy,
  getProxyStats,
} from '../../../src/utils/proxy-manager.js';

/**
 * Tests for Proxy Manager module
 * Tests the pure functions exported from proxy-manager.js
 */

describe('proxy-manager', () => {
  describe('getRandomProxy', () => {
    it('should be a function', () => {
      expect(typeof getRandomProxy).toBe('function');
    });

    it('should return string or null', () => {
      const proxy = getRandomProxy();
      expect(proxy === null || typeof proxy === 'string').toBe(true);
    });
  });

  describe('getNextProxy', () => {
    it('should be a function', () => {
      expect(typeof getNextProxy).toBe('function');
    });

    it('should return string or null', () => {
      const proxy = getNextProxy();
      expect(proxy === null || typeof proxy === 'string').toBe(true);
    });
  });

  describe('getFastestProxy', () => {
    it('should be a function', () => {
      expect(typeof getFastestProxy).toBe('function');
    });

    it('should return string or null', () => {
      const proxy = getFastestProxy();
      expect(proxy === null || typeof proxy === 'string').toBe(true);
    });
  });

  describe('getProxyStats', () => {
    it('should be a function', () => {
      expect(typeof getProxyStats).toBe('function');
    });

    it('should return stats object', () => {
      const stats = getProxyStats();
      
      expect(typeof stats).toBe('object');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('lastRefresh');
      expect(stats).toHaveProperty('cacheAge');
      expect(stats).toHaveProperty('avgLatency');
      expect(stats).toHaveProperty('sources');
      expect(stats).toHaveProperty('rotationIndex');
    });

    it('should have numeric total', () => {
      const stats = getProxyStats();
      expect(typeof stats.total).toBe('number');
      expect(stats.total).toBeGreaterThanOrEqual(0);
    });

    it('should have array of sources', () => {
      const stats = getProxyStats();
      expect(Array.isArray(stats.sources)).toBe(true);
    });

    it('should have numeric rotationIndex', () => {
      const stats = getProxyStats();
      expect(typeof stats.rotationIndex).toBe('number');
    });
  });
});

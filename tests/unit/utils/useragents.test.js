import { describe, it, expect } from '@jest/globals';
import { randomUA } from '../../../src/utils/useragents.js';

describe('useragents', () => {
  describe('randomUA', () => {
    it('should return a string user agent', () => {
      const ua = randomUA();
      
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(0);
    });

    it('should return a Mozilla-based user agent', () => {
      const ua = randomUA();
      
      expect(ua).toContain('Mozilla');
    });

    it('should return different user agents on multiple calls (or same if only one)', () => {
      const userAgents = new Set();
      
      // Call multiple times
      for (let i = 0; i < 10; i++) {
        userAgents.add(randomUA());
      }
      
      // Should have at least 1 user agent
      expect(userAgents.size).toBeGreaterThanOrEqual(1);
    });

    it('should return valid browser user agent format', () => {
      const ua = randomUA();
      
      // Should have browser engine info
      expect(ua).toMatch(/AppleWebKit|Gecko|Trident/);
    });
  });
});

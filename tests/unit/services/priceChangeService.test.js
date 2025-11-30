import { describe, it, expect } from '@jest/globals';
import { 
  calculatePriceChange, 
  shouldAlert 
} from '../../../src/services/priceChangeService.js';

describe('priceChangeService', () => {
  describe('calculatePriceChange', () => {
    it('should calculate price decrease correctly', () => {
      const result = calculatePriceChange(100, 80);
      
      expect(result.absoluteChange).toBe(-20);
      expect(result.percentChange).toBe(-20);
      expect(result.direction).toBe('down');
    });

    it('should calculate price increase correctly', () => {
      const result = calculatePriceChange(100, 120);
      
      expect(result.absoluteChange).toBe(20);
      expect(result.percentChange).toBe(20);
      expect(result.direction).toBe('up');
    });

    it('should handle no change', () => {
      const result = calculatePriceChange(100, 100);
      
      expect(result.absoluteChange).toBe(0);
      expect(result.percentChange).toBe(0);
      expect(result.direction).toBe('none');
    });

    it('should handle null old price (new product)', () => {
      const result = calculatePriceChange(null, 50);
      
      expect(result.isNewPrice).toBe(true);
      expect(result.isSignificant).toBe(false);
    });

    it('should mark significant changes correctly', () => {
      // Default threshold: 5% and $1
      const smallChange = calculatePriceChange(100, 99);
      expect(smallChange.isSignificant).toBe(false);

      const bigChange = calculatePriceChange(100, 90);
      expect(bigChange.isSignificant).toBe(true);
    });
  });

  describe('shouldAlert', () => {
    it('should alert on significant price drop', () => {
      const change = {
        percentChange: -15,
        direction: 'down',
        isSignificant: true
      };
      
      const result = shouldAlert(change);
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toBe('price_drop');
    });

    it('should not alert on small changes', () => {
      const change = {
        percentChange: -3,
        direction: 'down',
        isSignificant: false
      };
      
      const result = shouldAlert(change);
      expect(result.shouldAlert).toBe(false);
    });
  });
});
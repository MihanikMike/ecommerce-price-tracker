import { describe, it, expect } from '@jest/globals';
import { 
  calculatePriceChange, 
  shouldAlert 
} from '../../../src/services/priceChangeService.js';

describe('priceChangeService', () => {
  describe('calculatePriceChange', () => {
    describe('direction detection', () => {
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
    });

    describe('null/new price handling', () => {
      it('should handle null old price (new product)', () => {
        const result = calculatePriceChange(null, 50);
        
        expect(result.isNewPrice).toBe(true);
        expect(result.isSignificant).toBe(false);
      });

      it('should handle undefined old price', () => {
        const result = calculatePriceChange(undefined, 75);
        
        expect(result.isNewPrice).toBe(true);
        expect(result.direction).toBe('none');
      });

      it('should handle zero old price as new', () => {
        const result = calculatePriceChange(0, 99);
        
        expect(result.isNewPrice).toBe(true);
      });
    });

    describe('significance detection', () => {
      it('should mark significant changes correctly', () => {
        // Default threshold: 5% and $1
        const smallChange = calculatePriceChange(100, 99);
        expect(smallChange.isSignificant).toBe(false);

        const bigChange = calculatePriceChange(100, 90);
        expect(bigChange.isSignificant).toBe(true);
      });

      it('should not mark small percentage changes as significant', () => {
        const result = calculatePriceChange(100, 98);
        expect(result.percentChange).toBe(-2);
        expect(result.isSignificant).toBe(false);
      });

      it('should mark large percentage changes as significant', () => {
        const result = calculatePriceChange(100, 85);
        expect(result.percentChange).toBe(-15);
        expect(result.isSignificant).toBe(true);
      });

      it('should handle threshold edge cases', () => {
        // Exactly at 5% threshold with at least $1 change
        const atThreshold = calculatePriceChange(100, 95);
        expect(atThreshold.percentChange).toBe(-5);
        expect(atThreshold.absoluteChange).toBe(-5);
        expect(atThreshold.isSignificant).toBe(true);
      });

      it('should require both percent AND absolute change', () => {
        // 10% change but less than $1 (on a $5 item)
        const smallItem = calculatePriceChange(5, 4.50);
        expect(smallItem.percentChange).toBe(-10);
        expect(Math.abs(smallItem.absoluteChange)).toBe(0.5);
        // Not significant because absolute change is less than $1
        expect(smallItem.isSignificant).toBe(false);
      });
    });

    describe('rounding', () => {
      it('should round percentChange to 2 decimal places', () => {
        const result = calculatePriceChange(100, 66.67);
        expect(result.percentChange).toBe(-33.33);
      });

      it('should round absoluteChange to 2 decimal places', () => {
        const result = calculatePriceChange(100, 66.666);
        expect(result.absoluteChange).toBe(-33.33);
      });
    });

    describe('edge cases', () => {
      it('should handle very small price changes', () => {
        const result = calculatePriceChange(99.99, 99.98);
        expect(result.absoluteChange).toBe(-0.01);
        expect(result.direction).toBe('down');
      });

      it('should handle very large price increases', () => {
        const result = calculatePriceChange(100, 500);
        expect(result.percentChange).toBe(400);
        expect(result.direction).toBe('up');
        expect(result.isSignificant).toBe(true);
      });

      it('should handle price dropping to near zero', () => {
        const result = calculatePriceChange(100, 1);
        expect(result.percentChange).toBe(-99);
        expect(result.isSignificant).toBe(true);
      });
    });
  });

  describe('shouldAlert', () => {
    describe('price drops', () => {
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

      it('should set high severity for large drops', () => {
        const change = {
          percentChange: -25, // >= 20% (double the 10% threshold)
          direction: 'down',
          isSignificant: true
        };
        
        const result = shouldAlert(change);
        expect(result.severity).toBe('high');
      });

      it('should set medium severity for moderate drops', () => {
        const change = {
          percentChange: -12,
          direction: 'down',
          isSignificant: true
        };
        
        const result = shouldAlert(change);
        expect(result.severity).toBe('medium');
      });
    });

    describe('price increases', () => {
      it('should alert on significant price increase', () => {
        const change = {
          percentChange: 25,
          direction: 'up',
          isSignificant: true
        };
        
        const result = shouldAlert(change);
        expect(result.shouldAlert).toBe(true);
        expect(result.reason).toBe('price_increase');
      });

      it('should not alert on small price increases', () => {
        const change = {
          percentChange: 10,
          direction: 'up',
          isSignificant: true
        };
        
        // 10% is below the 20% alert threshold for increases
        const result = shouldAlert(change);
        expect(result.shouldAlert).toBe(false);
      });
    });

    describe('no alert cases', () => {
      it('should not alert on small changes', () => {
        const change = {
          percentChange: -3,
          direction: 'down',
          isSignificant: false
        };
        
        const result = shouldAlert(change);
        expect(result.shouldAlert).toBe(false);
      });

      it('should not alert on non-significant changes', () => {
        const change = {
          percentChange: -8, // Below 10% drop threshold
          direction: 'down',
          isSignificant: true
        };
        
        const result = shouldAlert(change);
        expect(result.shouldAlert).toBe(false);
      });

      it('should not alert on price staying same', () => {
        const change = {
          percentChange: 0,
          direction: 'none',
          isSignificant: false
        };
        
        const result = shouldAlert(change);
        expect(result.shouldAlert).toBe(false);
        expect(result.reason).toBeNull();
      });
    });
  });

  describe('integration: calculatePriceChange + shouldAlert', () => {
    it('should correctly flow through both functions for price drop', () => {
      const change = calculatePriceChange(100, 75);
      const alert = shouldAlert(change);
      
      expect(change.percentChange).toBe(-25);
      expect(change.isSignificant).toBe(true);
      expect(alert.shouldAlert).toBe(true);
      expect(alert.reason).toBe('price_drop');
      expect(alert.severity).toBe('high');
    });

    it('should correctly flow through for price increase', () => {
      const change = calculatePriceChange(100, 145);
      const alert = shouldAlert(change);
      
      expect(change.percentChange).toBe(45);
      expect(change.isSignificant).toBe(true);
      expect(alert.shouldAlert).toBe(true);
      expect(alert.reason).toBe('price_increase');
      expect(alert.severity).toBe('high');
    });

    it('should not alert for new prices', () => {
      const change = calculatePriceChange(null, 99);
      const alert = shouldAlert(change);
      
      expect(change.isNewPrice).toBe(true);
      expect(alert.shouldAlert).toBe(false);
    });
  });
});
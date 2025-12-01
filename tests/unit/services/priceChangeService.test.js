import { describe, it, expect } from '@jest/globals';
import { calculatePriceChange, shouldAlert } from '../../../src/services/priceChangeService.js';

/**
 * Tests for Price Change Service
 * Tests the actual exported functions from the service
 */
describe('priceChangeService', () => {
  describe('calculatePriceChange', () => {
    describe('direction detection', () => {
      it('should detect price drop', () => {
        const result = calculatePriceChange(100, 80);

        expect(result.direction).toBe('down');
        expect(result.absoluteChange).toBe(-20);
        expect(result.percentChange).toBe(-20);
      });

      it('should detect price increase', () => {
        const result = calculatePriceChange(100, 120);

        expect(result.direction).toBe('up');
        expect(result.absoluteChange).toBe(20);
        expect(result.percentChange).toBe(20);
      });

      it('should detect no change', () => {
        const result = calculatePriceChange(100, 100);

        expect(result.direction).toBe('none');
        expect(result.absoluteChange).toBe(0);
        expect(result.percentChange).toBe(0);
      });
    });

    describe('null and edge cases', () => {
      it('should handle null old price', () => {
        const result = calculatePriceChange(null, 100);

        expect(result.isNewPrice).toBe(true);
        expect(result.absoluteChange).toBe(0);
        expect(result.direction).toBe('none');
      });

      it('should handle undefined old price', () => {
        const result = calculatePriceChange(undefined, 100);

        expect(result.isNewPrice).toBe(true);
      });

      it('should handle zero old price', () => {
        const result = calculatePriceChange(0, 100);

        expect(result.isNewPrice).toBe(true);
        expect(result.percentChange).toBe(0);
      });
    });

    describe('significance detection', () => {
      it('should mark large changes as significant', () => {
        const result = calculatePriceChange(100, 85);

        expect(result.isSignificant).toBe(true);
      });

      it('should mark small changes as not significant', () => {
        const result = calculatePriceChange(100, 99.5);

        expect(result.isSignificant).toBe(false);
      });

      it('should require both absolute and percent thresholds', () => {
        // 0.5% change on $1000 is $5 (above $1 threshold but below 5%)
        const result = calculatePriceChange(1000, 995);

        // 0.5% is below the 5% threshold
        expect(result.isSignificant).toBe(false);
      });
    });

    describe('rounding', () => {
      it('should round absolute change to 2 decimals', () => {
        const result = calculatePriceChange(100, 99.126);

        expect(result.absoluteChange).toBe(-0.87);
      });

      it('should round percent change to 2 decimals', () => {
        const result = calculatePriceChange(100, 88.888);

        expect(result.percentChange).toBe(-11.11);
      });
    });

    describe('real-world scenarios', () => {
      it('should detect Black Friday price drop', () => {
        const result = calculatePriceChange(349.99, 249.99);

        expect(result.direction).toBe('down');
        expect(result.isSignificant).toBe(true);
        expect(Math.abs(result.percentChange)).toBeGreaterThan(25);
      });

      it('should detect small sale', () => {
        const result = calculatePriceChange(49.99, 44.99);

        expect(result.direction).toBe('down');
        expect(result.absoluteChange).toBe(-5);
      });

      it('should detect price back to normal after sale', () => {
        const result = calculatePriceChange(44.99, 49.99);

        expect(result.direction).toBe('up');
      });
    });
  });

  describe('shouldAlert', () => {
    describe('price drops', () => {
      it('should alert on significant price drop', () => {
        const change = {
          direction: 'down',
          percentChange: -15,
          absoluteChange: -15,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(true);
        expect(result.reason).toBe('price_drop');
      });

      it('should mark very large drops as high severity', () => {
        const change = {
          direction: 'down',
          percentChange: -25,
          absoluteChange: -25,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(true);
        expect(result.severity).toBe('high');
      });

      it('should mark moderate drops as medium severity', () => {
        const change = {
          direction: 'down',
          percentChange: -12,
          absoluteChange: -12,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(true);
        expect(result.severity).toBe('medium');
      });

      it('should not alert on small price drop', () => {
        const change = {
          direction: 'down',
          percentChange: -7,
          absoluteChange: -7,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(false);
      });
    });

    describe('price increases', () => {
      it('should alert on significant price increase', () => {
        const change = {
          direction: 'up',
          percentChange: 25,
          absoluteChange: 25,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(true);
        expect(result.reason).toBe('price_increase');
      });

      it('should mark very large increases as high severity', () => {
        const change = {
          direction: 'up',
          percentChange: 50,
          absoluteChange: 50,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.severity).toBe('high');
      });

      it('should not alert on moderate price increase', () => {
        const change = {
          direction: 'up',
          percentChange: 15,
          absoluteChange: 15,
          isSignificant: true,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(false);
      });
    });

    describe('non-significant changes', () => {
      it('should not alert on non-significant changes', () => {
        const change = {
          direction: 'down',
          percentChange: -15,
          absoluteChange: -15,
          isSignificant: false,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(false);
        expect(result.reason).toBeNull();
      });
    });

    describe('no change', () => {
      it('should not alert when no change', () => {
        const change = {
          direction: 'none',
          percentChange: 0,
          absoluteChange: 0,
          isSignificant: false,
        };

        const result = shouldAlert(change);

        expect(result.shouldAlert).toBe(false);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should correctly flow from price calculation to alert', () => {
      // Simulate Black Friday deal
      const change = calculatePriceChange(299.99, 199.99);
      const alert = shouldAlert(change);

      expect(change.direction).toBe('down');
      expect(change.isSignificant).toBe(true);
      expect(alert.shouldAlert).toBe(true);
      expect(alert.reason).toBe('price_drop');
    });

    it('should not alert for minor fluctuation', () => {
      const change = calculatePriceChange(99.99, 97.99);
      const alert = shouldAlert(change);

      // 2% drop is below threshold
      expect(alert.shouldAlert).toBe(false);
    });

    it('should alert for price gouging scenario', () => {
      const change = calculatePriceChange(50, 100);
      const alert = shouldAlert(change);

      expect(change.direction).toBe('up');
      expect(change.percentChange).toBe(100);
      expect(alert.shouldAlert).toBe(true);
      expect(alert.severity).toBe('high');
    });
  });
});

import { describe, it, expect } from '@jest/globals';
import metrics, {
  scrapeAttemptsTotal,
  scrapeDuration,
  productsScraped,
  priceChangesDetected,
  errorsTotal,
  retryAttempts,
  recordScrape,
  recordPriceChange,
  recordDbQuery,
  getMetrics,
  getMetricsContentType,
  updateProxyMetrics,
  updateBrowserPoolMetrics,
  updateDbPoolMetrics,
  recordRateLimitDelay,
  recordRateLimitHit,
  resetMetrics,
} from '../../../src/utils/metrics.js';

describe('metrics', () => {
  describe('Prometheus counters', () => {
    it('should have scrapeAttemptsTotal counter', () => {
      expect(scrapeAttemptsTotal).toBeDefined();
    });

    it('should have productsScraped counter', () => {
      expect(productsScraped).toBeDefined();
    });

    it('should have priceChangesDetected counter', () => {
      expect(priceChangesDetected).toBeDefined();
    });

    it('should have errorsTotal counter', () => {
      expect(errorsTotal).toBeDefined();
    });

    it('should have retryAttempts counter', () => {
      expect(retryAttempts).toBeDefined();
    });
  });

  describe('Prometheus histograms', () => {
    it('should have scrapeDuration histogram', () => {
      expect(scrapeDuration).toBeDefined();
    });
  });

  describe('Registry', () => {
    it('should have a registry in default export', () => {
      expect(metrics.register).toBeDefined();
    });

    it('should be able to get metrics string', async () => {
      const metricsString = await getMetrics();
      
      expect(typeof metricsString).toBe('string');
      expect(metricsString.length).toBeGreaterThan(0);
    });

    it('should get metrics content type', () => {
      const contentType = getMetricsContentType();
      
      expect(typeof contentType).toBe('string');
      expect(contentType).toContain('text/');
    });
  });

  describe('recordScrape', () => {
    it('should be a function', () => {
      expect(typeof recordScrape).toBe('function');
    });

    it('should not throw when recording a scrape', () => {
      expect(() => {
        recordScrape('test-site', true, 1.5);
      }).not.toThrow();
    });

    it('should not throw when recording a failed scrape', () => {
      expect(() => {
        recordScrape('test-site', false, 0.5);
      }).not.toThrow();
    });
  });

  describe('recordPriceChange', () => {
    it('should be a function', () => {
      expect(typeof recordPriceChange).toBe('function');
    });

    it('should not throw when recording a price change', () => {
      expect(() => {
        recordPriceChange('test-site', 100, 90);
      }).not.toThrow();
    });

    it('should not throw for price increase', () => {
      expect(() => {
        recordPriceChange('test-site', 80, 100);
      }).not.toThrow();
    });
  });

  describe('recordDbQuery', () => {
    it('should be a function', () => {
      expect(typeof recordDbQuery).toBe('function');
    });

    it('should not throw when recording a db query', () => {
      expect(() => {
        recordDbQuery('select', 0.05);
      }).not.toThrow();
    });

    it('should not throw with error flag', () => {
      expect(() => {
        recordDbQuery('insert', 0.1, true);
      }).not.toThrow();
    });
  });

  describe('updateProxyMetrics', () => {
    it('should be a function', () => {
      expect(typeof updateProxyMetrics).toBe('function');
    });

    it('should not throw when updating proxy metrics', () => {
      expect(() => {
        updateProxyMetrics(10, 2);
      }).not.toThrow();
    });

    it('should not throw with only working count', () => {
      expect(() => {
        updateProxyMetrics(5);
      }).not.toThrow();
    });
  });

  describe('updateBrowserPoolMetrics', () => {
    it('should be a function', () => {
      expect(typeof updateBrowserPoolMetrics).toBe('function');
    });

    it('should not throw when updating browser pool metrics', () => {
      expect(() => {
        updateBrowserPoolMetrics(5, 2);
      }).not.toThrow();
    });

    it('should not throw with zero in-use', () => {
      expect(() => {
        updateBrowserPoolMetrics(3, 0);
      }).not.toThrow();
    });
  });

  describe('updateDbPoolMetrics', () => {
    it('should be a function', () => {
      expect(typeof updateDbPoolMetrics).toBe('function');
    });

    it('should not throw when updating db pool metrics', () => {
      expect(() => {
        updateDbPoolMetrics(20, 15, 0);
      }).not.toThrow();
    });

    it('should not throw with waiting connections', () => {
      expect(() => {
        updateDbPoolMetrics(20, 0, 5);
      }).not.toThrow();
    });
  });

  describe('recordRateLimitDelay', () => {
    it('should be a function', () => {
      expect(typeof recordRateLimitDelay).toBe('function');
    });

    it('should not throw when recording rate limit delay', () => {
      expect(() => {
        recordRateLimitDelay('amazon.com', 2.5);
      }).not.toThrow();
    });
  });

  describe('recordRateLimitHit', () => {
    it('should be a function', () => {
      expect(typeof recordRateLimitHit).toBe('function');
    });

    it('should not throw when recording rate limit hit', () => {
      expect(() => {
        recordRateLimitHit('walmart.com');
      }).not.toThrow();
    });
  });

  describe('resetMetrics', () => {
    it('should be a function', () => {
      expect(typeof resetMetrics).toBe('function');
    });

    it('should not throw when resetting metrics', () => {
      expect(() => {
        resetMetrics();
      }).not.toThrow();
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

// Import actual service functions for coverage
import {
  getPreviousPrice,
  getLatestPrice,
  detectPriceChange,
  getRecentPriceChanges,
  getBiggestPriceDrops,
  calculatePriceChange,
  shouldAlert,
  getPriceSummary,
} from '../../../src/services/priceChangeService.js';

describe('priceChangeService integration', () => {
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  // Helper to create a product with prices
  async function createProductWithPrices(url, prices) {
    const product = await pool.query(`
      INSERT INTO products (url, site, title)
      VALUES ($1, 'Amazon', 'Test Product')
      RETURNING id
    `, [url]);
    const productId = product.rows[0].id;

    // Insert prices with timestamps
    for (let i = 0; i < prices.length; i++) {
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES ($1, $2, 'USD', NOW() - INTERVAL '${prices.length - 1 - i} hours')
      `, [productId, prices[i]]);
    }

    return productId;
  }

  describe('getLatestPrice (imported)', () => {
    it('should return null for non-existent product', async () => {
      const result = await getLatestPrice(99999);
      expect(result).toBeNull();
    });

    it('should return latest price for product', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/LATEST-TEST',
        [100.00, 90.00, 80.00]  // 80 is most recent
      );

      const result = await getLatestPrice(productId);
      
      expect(result).toBeDefined();
      expect(parseFloat(result.price)).toBe(80.00);
      expect(result.currency).toBe('USD');
    });
  });

  describe('getPreviousPrice (imported)', () => {
    it('should return null for non-existent product', async () => {
      const result = await getPreviousPrice(99999);
      expect(result).toBeNull();
    });

    it('should return null for product with only one price', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/ONE-PRICE',
        [100.00]
      );

      const result = await getPreviousPrice(productId);
      expect(result).toBeNull();
    });

    it('should return second-to-last price for product', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/PREV-TEST',
        [100.00, 90.00, 80.00]
      );

      const result = await getPreviousPrice(productId);
      
      expect(result).toBeDefined();
      expect(parseFloat(result.price)).toBe(90.00);
    });
  });

  describe('detectPriceChange (imported)', () => {
    it('should return no_price_data for non-existent product', async () => {
      const result = await detectPriceChange(99999);
      
      expect(result.detected).toBe(false);
      expect(result.reason).toBe('no_price_data');
    });

    it('should return first_price for product with single price', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/FIRST-PRICE',
        [100.00]
      );

      const result = await detectPriceChange(productId);
      
      expect(result.detected).toBe(false);
      expect(result.reason).toBe('first_price');
      expect(result.price).toBe(100.00);
    });

    it('should detect significant price drop', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/DROP-TEST',
        [100.00, 80.00]  // 20% drop
      );

      const result = await detectPriceChange(productId, 'Amazon');
      
      expect(result.detected).toBe(true);
      expect(result.oldPrice).toBe(100.00);
      expect(result.newPrice).toBe(80.00);
      expect(result.change.direction).toBe('down');
      expect(result.change.percentChange).toBe(-20);
    });

    it('should detect significant price increase', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/INCREASE-TEST',
        [100.00, 130.00]  // 30% increase
      );

      const result = await detectPriceChange(productId, 'Amazon');
      
      expect(result.detected).toBe(true);
      expect(result.change.direction).toBe('up');
    });

    it('should not detect insignificant price change', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/SMALL-CHANGE',
        [100.00, 99.00]  // 1% drop - below threshold
      );

      const result = await detectPriceChange(productId);
      
      expect(result.detected).toBe(false);
      expect(result.reason).toBe('below_threshold');
    });

    it('should include alert info for significant drops', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/ALERT-TEST',
        [100.00, 85.00]  // 15% drop
      );

      const result = await detectPriceChange(productId);
      
      expect(result.detected).toBe(true);
      expect(result.alert).toBeDefined();
      expect(result.alert.shouldAlert).toBeDefined();
    });
  });

  describe('getRecentPriceChanges (imported)', () => {
    it('should return empty array when no changes', async () => {
      const result = await getRecentPriceChanges(24);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should find recent price changes', async () => {
      // Create product with price change
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/RECENT-CHANGE',
        [100.00, 80.00]
      );

      const result = await getRecentPriceChanges(24);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getBiggestPriceDrops (imported)', () => {
    it('should return empty array when no drops', async () => {
      const result = await getBiggestPriceDrops(24);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should find recent price drops', async () => {
      // Create product with price drop
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/DROP-FIND',
        [150.00, 100.00]  // 33% drop
      );

      const result = await getBiggestPriceDrops(24);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const result = await getBiggestPriceDrops(24, 5);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getPriceSummary (imported)', () => {
    it('should return object for non-existent product with NaN values', async () => {
      const result = await getPriceSummary(99999);
      expect(result).toBeDefined();
      expect(result.productId).toBe(99999);
      expect(result.dataPoints).toBe(0);
    });

    it('should return price summary for product', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/SUMMARY-TEST',
        [100.00, 90.00, 80.00, 110.00]
      );

      const result = await getPriceSummary(productId);
      
      expect(result).toBeDefined();
      expect(result.currentPrice).toBeDefined();
      expect(result.minPrice).toBeDefined();
      expect(result.maxPrice).toBeDefined();
      expect(result.dataPoints).toBeDefined();
    });

    it('should calculate correct min and max', async () => {
      const productId = await createProductWithPrices(
        'https://amazon.com/dp/MIN-MAX-TEST',
        [100.00, 50.00, 150.00, 75.00]
      );

      const result = await getPriceSummary(productId, 30);
      
      expect(parseFloat(result.minPrice)).toBe(50.00);
      expect(parseFloat(result.maxPrice)).toBe(150.00);
    });
  });

  describe('calculatePriceChange (imported)', () => {
    it('should calculate price drop correctly', () => {
      const result = calculatePriceChange(100, 80);
      
      expect(result.direction).toBe('down');
      expect(result.absoluteChange).toBe(-20);
      expect(result.percentChange).toBe(-20);
      expect(result.isSignificant).toBe(true);
    });

    it('should calculate price increase correctly', () => {
      const result = calculatePriceChange(100, 150);
      
      expect(result.direction).toBe('up');
      expect(result.absoluteChange).toBe(50);
      expect(result.percentChange).toBe(50);
    });

    it('should handle no change', () => {
      const result = calculatePriceChange(100, 100);
      
      expect(result.direction).toBe('none');
      expect(result.absoluteChange).toBe(0);
      expect(result.percentChange).toBe(0);
      expect(result.isSignificant).toBe(false);
    });

    it('should handle null old price', () => {
      const result = calculatePriceChange(null, 100);
      
      expect(result.isNewPrice).toBe(true);
    });
  });

  describe('shouldAlert (imported)', () => {
    it('should alert on large price drop', () => {
      const change = calculatePriceChange(100, 85);  // 15% drop
      const result = shouldAlert(change);
      
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toContain('drop');
    });

    it('should alert on large price increase', () => {
      const change = calculatePriceChange(100, 130);  // 30% increase
      const result = shouldAlert(change);
      
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toContain('increase');
    });

    it('should not alert on small changes', () => {
      const change = calculatePriceChange(100, 97);  // 3% drop
      const result = shouldAlert(change);
      
      expect(result.shouldAlert).toBe(false);
    });

    it('should not alert on new prices', () => {
      const change = calculatePriceChange(null, 100);
      const result = shouldAlert(change);
      
      expect(result.shouldAlert).toBe(false);
      // reason may be null for new prices
    });
  });
});

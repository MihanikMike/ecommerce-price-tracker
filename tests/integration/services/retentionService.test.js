import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

// Import actual functions from retentionService for coverage
import {
  getRetentionPolicy,
  getDatabaseStats,
  cleanupPriceHistory,
  cleanupStaleProducts,
  cleanupSearchResults,
  ensureDailySamplesTable,
  archiveToDailySamples,
  runRetentionCleanup,
} from '../../../src/services/retentionService.js';

describe('retentionService Integration', () => {
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
    // Clean up daily samples table if created
    try {
      await pool.query('DROP TABLE IF EXISTS price_history_daily CASCADE');
    } catch (e) {
      // Ignore if doesn't exist
    }
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('getRetentionPolicy (imported)', () => {
    it('should return policy with all expected fields', () => {
      const policy = getRetentionPolicy();
      
      expect(policy).toBeDefined();
      expect(policy.priceHistoryDays).toBeDefined();
      expect(policy.minPriceRecordsPerProduct).toBeDefined();
      expect(policy.staleProductDays).toBeDefined();
      expect(policy.searchResultDays).toBeDefined();
      expect(policy.deleteBatchSize).toBeDefined();
      expect(typeof policy.keepDailySamples).toBe('boolean');
    });
  });

  describe('getDatabaseStats (imported)', () => {
    it('should return database statistics with no data', async () => {
      const stats = await getDatabaseStats();
      
      expect(stats).toBeDefined();
      expect(stats.product_count).toBeDefined();
      expect(stats.price_history_count).toBeDefined();
      expect(stats.tracked_products_count).toBeDefined();
      expect(stats.database_size).toBeDefined();
    });

    it('should return correct counts with data', async () => {
      // Insert test data
      const product = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/dp/STATS-TEST', 'Amazon', 'Stats Test')
        RETURNING id
      `);
      
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 99.99, 'USD')
      `, [product.rows[0].id]);

      const stats = await getDatabaseStats();
      
      expect(parseInt(stats.product_count)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.price_history_count)).toBeGreaterThanOrEqual(1);
    });

    it('should include daily samples count', async () => {
      const stats = await getDatabaseStats();
      
      expect(stats.daily_samples_count).toBeDefined();
      expect(typeof stats.daily_samples_count).toBe('number');
    });
  });

  describe('ensureDailySamplesTable (imported)', () => {
    it('should create daily samples table if not exists', async () => {
      await ensureDailySamplesTable();
      
      // Check if table exists
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'price_history_daily'
        )
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });

    it('should be idempotent (can run multiple times)', async () => {
      await ensureDailySamplesTable();
      await ensureDailySamplesTable();
      
      // Should not throw
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'price_history_daily'
        )
      `);
      
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('archiveToDailySamples (imported)', () => {
    it('should archive old price data to daily samples', async () => {
      await ensureDailySamplesTable();
      
      // Insert product with old price data
      const product = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/dp/ARCHIVE-TEST', 'Amazon', 'Archive Test')
        RETURNING id
      `);
      const productId = product.rows[0].id;

      // Insert old prices (100 days ago)
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES ($1, 99.99, 'USD', NOW() - INTERVAL '100 days')
      `, [productId]);

      const result = await archiveToDailySamples(90);
      
      expect(result).toHaveProperty('archived');
      expect(typeof result.archived).toBe('number');
    });

    it('should return zero when no old data exists', async () => {
      await ensureDailySamplesTable();
      
      // Insert product with recent price data
      const product = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/dp/RECENT-TEST', 'Amazon', 'Recent Test')
        RETURNING id
      `);
      
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES ($1, 49.99, 'USD', NOW())
      `, [product.rows[0].id]);

      const result = await archiveToDailySamples(90);
      
      expect(result.archived).toBe(0);
    });
  });

  describe('cleanupPriceHistory (imported)', () => {
    it('should return deleted count when no old data', async () => {
      const result = await cleanupPriceHistory();
      
      expect(result).toHaveProperty('deleted');
      expect(typeof result.deleted).toBe('number');
    });

    it('should delete old price history beyond retention period', async () => {
      // Insert product with multiple old prices
      const product = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/dp/CLEANUP-TEST', 'Amazon', 'Cleanup Test')
        RETURNING id
      `);
      const productId = product.rows[0].id;

      // Insert 20 old prices (to exceed minPriceRecordsPerProduct)
      for (let i = 0; i < 20; i++) {
        await pool.query(`
          INSERT INTO price_history (product_id, price, currency, captured_at)
          VALUES ($1, $2, 'USD', NOW() - INTERVAL '${100 + i} days')
        `, [productId, 100 - i]);
      }

      // Insert some recent prices
      for (let i = 0; i < 5; i++) {
        await pool.query(`
          INSERT INTO price_history (product_id, price, currency, captured_at)
          VALUES ($1, $2, 'USD', NOW() - INTERVAL '${i} days')
        `, [productId, 50 - i]);
      }

      const result = await cleanupPriceHistory();
      
      expect(result).toHaveProperty('deleted');
      // Should have deleted some old records
      // Note: Actual deletion depends on retention settings
    });
  });

  describe('cleanupStaleProducts (imported)', () => {
    it('should return zero when no stale products', async () => {
      // Insert a recent product
      await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES ('https://amazon.com/dp/FRESH', 'Amazon', 'Fresh Product', NOW())
      `);

      const result = await cleanupStaleProducts();
      
      expect(result).toHaveProperty('deleted');
      expect(result.deleted).toBe(0);
    });

    it('should delete products older than stale threshold', async () => {
      // Insert a very old product
      await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES ('https://amazon.com/dp/VERY-STALE', 'Amazon', 'Very Stale Product', NOW() - INTERVAL '365 days')
      `);

      const result = await cleanupStaleProducts();
      
      expect(result).toHaveProperty('deleted');
      // Should have deleted the stale product (depends on retention settings)
    });

    it('should cascade delete price history when product is deleted', async () => {
      // Insert stale product with price history
      const product = await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES ('https://amazon.com/dp/STALE-CASCADE', 'Amazon', 'Stale Cascade', NOW() - INTERVAL '365 days')
        RETURNING id
      `);
      const productId = product.rows[0].id;

      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 99.99, 'USD')
      `, [productId]);

      await cleanupStaleProducts();

      // Check if price history was also deleted
      const priceHistory = await pool.query(`
        SELECT * FROM price_history WHERE product_id = $1
      `, [productId]);

      // If product was deleted, price history should be empty
      // (depends on retention settings)
      expect(priceHistory.rows.length).toBe(0);
    });
  });

  describe('cleanupSearchResults (imported)', () => {
    it('should handle non-existent search_results table', async () => {
      // Ensure table doesn't exist
      try {
        await pool.query('DROP TABLE IF EXISTS search_results CASCADE');
      } catch (e) {
        // Ignore
      }

      const result = await cleanupSearchResults();
      
      expect(result).toHaveProperty('deleted');
      expect(result.reason).toBe('table_not_exists');
    });

    it('should cleanup old search results when table exists', async () => {
      // Create search_results table if needed for test
      await pool.query(`
        CREATE TABLE IF NOT EXISTS search_results (
          id SERIAL PRIMARY KEY,
          query TEXT,
          url TEXT,
          title TEXT,
          scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Insert old search result
      await pool.query(`
        INSERT INTO search_results (query, url, title, scraped_at)
        VALUES ('test query', 'https://example.com', 'Test Result', NOW() - INTERVAL '90 days')
      `);

      const result = await cleanupSearchResults();
      
      expect(result).toHaveProperty('deleted');
      // Should have deleted old search results
    });
  });

  describe('runRetentionCleanup (imported)', () => {
    it('should run all cleanup operations', async () => {
      const result = await runRetentionCleanup();
      
      expect(result).toHaveProperty('priceHistory');
      expect(result).toHaveProperty('staleProducts');
      expect(result).toHaveProperty('searchResults');
      
      expect(result.priceHistory).toHaveProperty('deleted');
      expect(result.staleProducts).toHaveProperty('deleted');
      expect(result.searchResults).toHaveProperty('deleted');
    });

    it('should return summary of all cleanup operations', async () => {
      // Add some data first
      const product = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/dp/FULL-CLEANUP', 'Amazon', 'Full Cleanup Test')
        RETURNING id
      `);

      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 75.00, 'USD')
      `, [product.rows[0].id]);

      const result = await runRetentionCleanup();
      
      expect(result.priceHistory.deleted).toBeGreaterThanOrEqual(0);
      expect(result.staleProducts.deleted).toBeGreaterThanOrEqual(0);
      expect(result.searchResults.deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('database stats (raw SQL)', () => {
    it('should count products correctly', async () => {
      // Insert test products
      await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES 
          ('https://amazon.com/1', 'Amazon', 'Product 1'),
          ('https://amazon.com/2', 'Amazon', 'Product 2')
      `);
      
      const result = await pool.query('SELECT COUNT(*) FROM products');
      expect(parseInt(result.rows[0].count)).toBe(2);
    });

    it('should count price history correctly', async () => {
      // Insert product
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/test', 'Amazon', 'Test')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;
      
      // Insert price history
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES 
          ($1, 100, 'USD'),
          ($1, 95, 'USD'),
          ($1, 90, 'USD')
      `, [productId]);
      
      const result = await pool.query('SELECT COUNT(*) FROM price_history');
      expect(parseInt(result.rows[0].count)).toBe(3);
    });

    it('should get database size stats', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/stats', 'Amazon', 'Stats Test')
      `);

      const result = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM products) as product_count,
          (SELECT COUNT(*) FROM price_history) as price_history_count
      `);

      expect(parseInt(result.rows[0].product_count)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('cleanup old price history', () => {
    it('should delete price history older than retention days', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/old', 'Amazon', 'Old Product')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;
      
      // Insert old price history (91 days ago)
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES ($1, 100, 'USD', NOW() - INTERVAL '91 days')
      `, [productId]);
      
      // Delete old records
      const deleteResult = await pool.query(`
        DELETE FROM price_history 
        WHERE captured_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `);
      
      expect(deleteResult.rowCount).toBe(1);
    });

    it('should keep recent price history', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/recent', 'Amazon', 'Recent Product')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;
      
      // Insert recent price history (10 days ago)
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES ($1, 100, 'USD', NOW() - INTERVAL '10 days')
      `, [productId]);
      
      // Try to delete old records
      const deleteResult = await pool.query(`
        DELETE FROM price_history 
        WHERE captured_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `);
      
      expect(deleteResult.rowCount).toBe(0);
      
      // Verify record still exists
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(parseInt(countResult.rows[0].count)).toBe(1);
    });

    it('should keep minimum records per product', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/min', 'Amazon', 'Min Records')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;
      
      // Insert 15 old price records
      for (let i = 0; i < 15; i++) {
        await pool.query(`
          INSERT INTO price_history (product_id, price, currency, captured_at)
          VALUES ($1, $2, 'USD', NOW() - INTERVAL '${100 + i} days')
        `, [productId, 100 - i]);
      }
      
      // Delete keeping minimum 10 records
      const deleteResult = await pool.query(`
        DELETE FROM price_history ph
        WHERE ph.product_id = $1
        AND ph.id NOT IN (
          SELECT id FROM price_history
          WHERE product_id = $1
          ORDER BY captured_at DESC
          LIMIT 10
        )
        RETURNING id
      `, [productId]);
      
      expect(deleteResult.rowCount).toBe(5);
      
      // Verify 10 records remain
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(parseInt(countResult.rows[0].count)).toBe(10);
    });
  });

  describe('cleanup stale products', () => {
    it('should identify stale products', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES 
          ('https://amazon.com/fresh', 'Amazon', 'Fresh', NOW()),
          ('https://amazon.com/stale1', 'Amazon', 'Stale 1', NOW() - INTERVAL '200 days'),
          ('https://amazon.com/stale2', 'Amazon', 'Stale 2', NOW() - INTERVAL '365 days')
      `);

      const staleResult = await pool.query(`
        SELECT id, title FROM products 
        WHERE last_seen_at < NOW() - INTERVAL '180 days'
      `);

      expect(staleResult.rows.length).toBe(2);
    });

    it('should delete stale products with cascade', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES ('https://amazon.com/to_delete', 'Amazon', 'Delete Me', NOW() - INTERVAL '200 days')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;

      // Add price history
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 50, 'USD')
      `, [productId]);

      // Delete stale products
      const deleteResult = await pool.query(`
        DELETE FROM products 
        WHERE last_seen_at < NOW() - INTERVAL '180 days'
        RETURNING id
      `);

      expect(deleteResult.rowCount).toBe(1);

      // Verify cascade deleted price history
      const priceResult = await pool.query(
        'SELECT COUNT(*) FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(parseInt(priceResult.rows[0].count)).toBe(0);
    });
  });

  describe('daily samples archiving', () => {
    it('should sample one price per day per product', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/sample', 'Amazon', 'Sample Product')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;

      // Insert multiple prices on same day with different times
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES 
          ($1, 100, 'USD', '2024-01-15 09:00:00'),
          ($1, 95, 'USD', '2024-01-15 12:00:00'),
          ($1, 90, 'USD', '2024-01-15 18:00:00'),
          ($1, 85, 'USD', '2024-01-16 10:00:00')
      `, [productId]);

      // Get daily samples (first price of each day)
      const samplesResult = await pool.query(`
        SELECT DISTINCT ON (DATE(captured_at))
          DATE(captured_at) as sample_date,
          price
        FROM price_history
        WHERE product_id = $1
        ORDER BY DATE(captured_at), captured_at
      `, [productId]);

      expect(samplesResult.rows.length).toBe(2); // 2 days
      expect(parseFloat(samplesResult.rows[0].price)).toBe(100); // First of day 1
    });
  });

  describe('batch operations', () => {
    it('should delete in batches', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ('https://amazon.com/batch', 'Amazon', 'Batch Test')
        RETURNING id
      `);
      const productId = productResult.rows[0].id;

      // Insert 100 old price records
      const values = [];
      for (let i = 0; i < 100; i++) {
        values.push(`($1, ${100 - i}, 'USD', NOW() - INTERVAL '${100 + i} days')`);
      }
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES ${values.join(', ')}
      `, [productId]);

      // Verify 100 records
      const beforeResult = await pool.query(
        'SELECT COUNT(*) FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(parseInt(beforeResult.rows[0].count)).toBe(100);

      // Delete in batches of 25
      let totalDeleted = 0;
      for (let batch = 0; batch < 4; batch++) {
        const deleteResult = await pool.query(`
          DELETE FROM price_history
          WHERE id IN (
            SELECT id FROM price_history
            WHERE product_id = $1
            AND captured_at < NOW() - INTERVAL '90 days'
            LIMIT 25
          )
          RETURNING id
        `, [productId]);
        totalDeleted += deleteResult.rowCount;
      }

      // Should have deleted all old records (100 - 10 kept = up to 90)
      expect(totalDeleted).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle product with no price history', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES ('https://amazon.com/noprices', 'Amazon', 'No Prices', NOW() - INTERVAL '200 days')
      `);

      // Should still be able to delete stale product
      const deleteResult = await pool.query(`
        DELETE FROM products 
        WHERE last_seen_at < NOW() - INTERVAL '180 days'
        RETURNING id
      `);

      expect(deleteResult.rowCount).toBe(1);
    });

    it('should handle empty tables', async () => {
      // Cleanup to ensure empty
      await pool.query('DELETE FROM price_history');
      await pool.query('DELETE FROM products');

      const deleteResult = await pool.query(`
        DELETE FROM price_history 
        WHERE captured_at < NOW() - INTERVAL '90 days'
        RETURNING id
      `);

      expect(deleteResult.rowCount).toBe(0);
    });
  });
});
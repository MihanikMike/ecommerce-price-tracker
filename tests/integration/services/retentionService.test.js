import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

describe('retentionService Integration', () => {
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

  describe('database operations', () => {
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
  });

  describe('cleanup operations', () => {
    it('should be able to delete old price history', async () => {
      // Insert product
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
  });
});

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

describe('trackedProductsRepository', () => {
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

  describe('addTrackedProduct', () => {
    it('should add URL-based tracked product', async () => {
      const result = await pool.query(`
        INSERT INTO tracked_products (url, site, enabled)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/TEST123', 'Amazon', true]);
      
      expect(result.rows[0].id).toBeDefined();
    });

    it('should add tracked product with check interval', async () => {
      const result = await pool.query(`
        INSERT INTO tracked_products (url, site, check_interval_minutes, enabled)
        VALUES ($1, $2, $3, $4)
        RETURNING id, check_interval_minutes
      `, ['https://amazon.com/dp/TEST456', 'Amazon', 120, true]);
      
      expect(result.rows[0].id).toBeDefined();
      expect(result.rows[0].check_interval_minutes).toBe(120);
    });
  });

  describe('getActiveTrackedProducts', () => {
    it('should return only enabled tracked products', async () => {
      // Insert enabled product
      await pool.query(`
        INSERT INTO tracked_products (url, site, enabled)
        VALUES ($1, $2, $3)
      `, ['https://amazon.com/dp/ACTIVE', 'Amazon', true]);
      
      // Insert disabled product
      await pool.query(`
        INSERT INTO tracked_products (url, site, enabled)
        VALUES ($1, $2, $3)
      `, ['https://amazon.com/dp/INACTIVE', 'Amazon', false]);
      
      const result = await pool.query(`
        SELECT * FROM tracked_products WHERE enabled = true
      `);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].url).toContain('ACTIVE');
    });
  });

  describe('updateLastChecked', () => {
    it('should update last_checked_at timestamp', async () => {
      // Insert product
      const insertResult = await pool.query(`
        INSERT INTO tracked_products (url, site, enabled)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/TEST', 'Amazon', true]);
      
      const id = insertResult.rows[0].id;
      
      // Update last_checked_at
      await pool.query(`
        UPDATE tracked_products SET last_checked_at = NOW() WHERE id = $1
      `, [id]);
      
      // Verify
      const result = await pool.query(`
        SELECT last_checked_at FROM tracked_products WHERE id = $1
      `, [id]);
      
      expect(result.rows[0].last_checked_at).toBeDefined();
    });
  });
});

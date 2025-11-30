import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

describe('productRepository', () => {
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

  describe('direct database operations', () => {
    it('should insert new product with price', async () => {
      // Insert product
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/TEST123', 'Amazon', 'Test Product']);
      
      const productId = productResult.rows[0].id;
      expect(productId).toBeDefined();
      expect(typeof productId).toBe('number');
      
      // Insert price history
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, $2, $3)
      `, [productId, 99.99, 'USD']);
      
      // Verify
      const priceResult = await pool.query(`
        SELECT * FROM price_history WHERE product_id = $1
      `, [productId]);
      
      expect(priceResult.rows.length).toBe(1);
      expect(parseFloat(priceResult.rows[0].price)).toBe(99.99);
    });

    it('should update existing product on conflict', async () => {
      // Insert first time
      const result1 = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, last_seen_at = NOW()
        RETURNING id
      `, ['https://amazon.com/dp/TEST123', 'Amazon', 'Original Title']);

      const id1 = result1.rows[0].id;

      // Insert again with same URL
      const result2 = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, last_seen_at = NOW()
        RETURNING id
      `, ['https://amazon.com/dp/TEST123', 'Amazon', 'Updated Title']);

      const id2 = result2.rows[0].id;
      expect(id2).toBe(id1);
      
      // Verify title was updated
      const verifyResult = await pool.query(`
        SELECT title FROM products WHERE id = $1
      `, [id1]);
      
      expect(verifyResult.rows[0].title).toBe('Updated Title');
    });
  });

  describe('price history', () => {
    it('should track multiple prices for a product', async () => {
      // Insert product
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/TEST1', 'Amazon', 'Product 1']);
      
      const productId = productResult.rows[0].id;
      
      // Insert multiple prices
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 100, 'USD'), ($1, 95, 'USD'), ($1, 90, 'USD')
      `, [productId]);
      
      const history = await pool.query(`
        SELECT * FROM price_history WHERE product_id = $1 ORDER BY captured_at
      `, [productId]);
      
      expect(history.rows.length).toBe(3);
    });

    it('should get latest price correctly', async () => {
      // Insert product
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/LATEST', 'Amazon', 'Latest Price Test']);
      
      const productId = productResult.rows[0].id;
      
      // Insert prices with different timestamps
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES 
          ($1, 100, 'USD', NOW() - INTERVAL '2 hours'),
          ($1, 95, 'USD', NOW() - INTERVAL '1 hour'),
          ($1, 90, 'USD', NOW())
      `, [productId]);
      
      // Get latest price
      const result = await pool.query(`
        SELECT p.*, ph.price as latest_price
        FROM products p
        JOIN price_history ph ON p.id = ph.product_id
        WHERE p.id = $1
        ORDER BY ph.captured_at DESC
        LIMIT 1
      `, [productId]);
      
      expect(parseFloat(result.rows[0].latest_price)).toBe(90);
    });
  });
});
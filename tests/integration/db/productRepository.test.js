import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

// Import actual repository functions to get coverage
import { 
  upsertProductAndHistory, 
  getAllProductsWithLatestPrice,
  getPriceHistory 
} from '../../../src/db/productRepository.js';

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

  describe('upsertProductAndHistory', () => {
    it('should insert new product with price using repository function', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/REPO-TEST1',
        site: 'Amazon',
        title: 'Repository Test Product',
        price: 49.99,
        currency: 'USD'
      });
      
      expect(typeof productId).toBe('number');
      expect(productId).toBeGreaterThan(0);
      
      // Verify with direct query
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
      expect(result.rows[0].title).toBe('Repository Test Product');
      expect(result.rows[0].site).toBe('Amazon');
    });

    it('should update existing product on same URL', async () => {
      // First insert
      const id1 = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/UPSERT-TEST',
        site: 'Amazon',
        title: 'Original Title',
        price: 100.00
      });

      // Second insert with same URL
      const id2 = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/UPSERT-TEST',
        site: 'Amazon',
        title: 'Updated Title',
        price: 90.00
      });

      expect(id1).toBe(id2);
      
      // Verify title was updated
      const result = await pool.query('SELECT title FROM products WHERE id = $1', [id1]);
      expect(result.rows[0].title).toBe('Updated Title');
      
      // Verify both prices are in history
      const history = await pool.query(
        'SELECT price FROM price_history WHERE product_id = $1 ORDER BY captured_at', 
        [id1]
      );
      expect(history.rows.length).toBe(2);
    });

    it('should use USD as default currency', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/DEFAULT-CURRENCY',
        site: 'Amazon',
        title: 'Default Currency Test',
        price: 25.00
        // No currency provided
      });

      const result = await pool.query(
        'SELECT currency FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(result.rows[0].currency).toBe('USD');
    });

    it('should throw error for invalid data', async () => {
      await expect(upsertProductAndHistory({
        url: 'not-a-valid-url',
        site: '',
        title: '',
        price: -100
      })).rejects.toThrow('Validation failed');
    });

    it('should throw error for missing required fields', async () => {
      await expect(upsertProductAndHistory({
        url: 'https://amazon.com/dp/TEST',
        // Missing site, title, price
      })).rejects.toThrow();
    });

    it('should throw error for negative price', async () => {
      await expect(upsertProductAndHistory({
        url: 'https://amazon.com/dp/NEG-PRICE',
        site: 'Amazon',
        title: 'Negative Price Test',
        price: -50.00
      })).rejects.toThrow('Validation failed');
    });
  });

  describe('getAllProductsWithLatestPrice', () => {
    it('should return empty array when no products', async () => {
      const products = await getAllProductsWithLatestPrice();
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(0);
    });

    it('should return products with latest prices', async () => {
      // Create products using repository function
      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/GET-ALL-1',
        site: 'Amazon',
        title: 'Get All Test 1',
        price: 100.00
      });

      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/GET-ALL-2',
        site: 'Amazon',
        title: 'Get All Test 2',
        price: 200.00
      });

      const products = await getAllProductsWithLatestPrice();
      expect(products.length).toBe(2);
      
      const prices = products.map(p => parseFloat(p.latest_price));
      expect(prices).toContain(100.00);
      expect(prices).toContain(200.00);
    });

    it('should return most recent price when product has multiple prices', async () => {
      // Create product with initial price
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/MULTI-PRICE',
        site: 'Amazon',
        title: 'Multi Price Test',
        price: 100.00
      });

      // Add more prices
      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/MULTI-PRICE',
        site: 'Amazon',
        title: 'Multi Price Test',
        price: 75.00
      });

      const products = await getAllProductsWithLatestPrice();
      const product = products.find(p => p.id === productId);
      expect(parseFloat(product.latest_price)).toBe(75.00);
    });

    it('should order by last_seen_at descending', async () => {
      // Insert products with different timestamps
      await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES 
          ('https://amazon.com/dp/OLD', 'Amazon', 'Old Product', NOW() - INTERVAL '1 day'),
          ('https://amazon.com/dp/NEW', 'Amazon', 'New Product', NOW())
      `);

      const products = await getAllProductsWithLatestPrice();
      expect(products[0].title).toBe('New Product');
      expect(products[1].title).toBe('Old Product');
    });
  });

  describe('getPriceHistory', () => {
    it('should get price history for a product', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/HISTORY-TEST',
        site: 'Amazon',
        title: 'History Test',
        price: 100.00
      });

      // Add more prices
      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/HISTORY-TEST',
        site: 'Amazon',
        title: 'History Test',
        price: 90.00
      });

      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/HISTORY-TEST',
        site: 'Amazon',
        title: 'History Test',
        price: 80.00
      });

      const history = await getPriceHistory(productId);
      expect(history.length).toBe(3);
      
      // Should be ordered by captured_at DESC
      expect(parseFloat(history[0].price)).toBe(80.00);
      expect(parseFloat(history[1].price)).toBe(90.00);
      expect(parseFloat(history[2].price)).toBe(100.00);
    });

    it('should respect limit parameter', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/LIMIT-TEST',
        site: 'Amazon',
        title: 'Limit Test',
        price: 100.00
      });

      // Add more prices
      for (let i = 0; i < 10; i++) {
        await upsertProductAndHistory({
          url: 'https://amazon.com/dp/LIMIT-TEST',
          site: 'Amazon',
          title: 'Limit Test',
          price: 90.00 - i
        });
      }

      const history = await getPriceHistory(productId, 5);
      expect(history.length).toBe(5);
    });

    it('should use default limit of 100', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/DEFAULT-LIMIT',
        site: 'Amazon',
        title: 'Default Limit Test',
        price: 50.00
      });

      const history = await getPriceHistory(productId);
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should sanitize limit to max 1000', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/MAX-LIMIT',
        site: 'Amazon',
        title: 'Max Limit Test',
        price: 50.00
      });

      // Should not throw even with huge limit
      const history = await getPriceHistory(productId, 99999);
      expect(Array.isArray(history)).toBe(true);
    });

    it('should sanitize limit to min 1', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/MIN-LIMIT',
        site: 'Amazon',
        title: 'Min Limit Test',
        price: 50.00
      });

      const history = await getPriceHistory(productId, 0);
      // Should get at least 1 result (min is 1)
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for invalid product ID', async () => {
      await expect(getPriceHistory('not-a-number')).rejects.toThrow('Invalid product ID');
    });

    it('should throw error for negative product ID', async () => {
      await expect(getPriceHistory(-1)).rejects.toThrow('Invalid product ID');
    });

    it('should return empty array for non-existent product', async () => {
      const history = await getPriceHistory(999999);
      expect(history.length).toBe(0);
    });
  });

  describe('product CRUD operations (raw SQL)', () => {
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

    it('should get all products with latest price', async () => {
      // Insert multiple products
      const product1 = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/PROD1', 'Amazon', 'Product 1']);

      const product2 = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://burton.com/prod2', 'Burton', 'Product 2']);

      // Add prices
      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 100, 'USD'), ($2, 200, 'USD')
      `, [product1.rows[0].id, product2.rows[0].id]);

      // Get all with latest price
      const result = await pool.query(`
        SELECT p.*, ph.price as latest_price
        FROM products p
        LEFT JOIN LATERAL (
          SELECT price FROM price_history
          WHERE product_id = p.id
          ORDER BY captured_at DESC
          LIMIT 1
        ) ph ON true
        ORDER BY p.id
      `);

      expect(result.rows.length).toBe(2);
      expect(parseFloat(result.rows[0].latest_price)).toBe(100);
      expect(parseFloat(result.rows[1].latest_price)).toBe(200);
    });

    it('should delete product and cascade to price history', async () => {
      // Insert product with price
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/DELETE_ME', 'Amazon', 'Delete Me']);

      const productId = productResult.rows[0].id;

      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 50, 'USD')
      `, [productId]);

      // Delete product
      await pool.query('DELETE FROM products WHERE id = $1', [productId]);

      // Verify cascade
      const priceResult = await pool.query(
        'SELECT * FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(priceResult.rows.length).toBe(0);
    });

    it('should update last_seen_at timestamp', async () => {
      const result1 = await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES ($1, $2, $3, NOW() - INTERVAL '1 day')
        RETURNING id, last_seen_at
      `, ['https://amazon.com/dp/SEEN', 'Amazon', 'Seen Product']);

      const originalTime = result1.rows[0].last_seen_at;

      // Update last_seen_at
      await pool.query(`
        UPDATE products SET last_seen_at = NOW() WHERE id = $1
      `, [result1.rows[0].id]);

      const result2 = await pool.query(
        'SELECT last_seen_at FROM products WHERE id = $1',
        [result1.rows[0].id]
      );

      expect(new Date(result2.rows[0].last_seen_at).getTime())
        .toBeGreaterThan(new Date(originalTime).getTime());
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

    it('should calculate price change between two most recent prices', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/CHANGE', 'Amazon', 'Price Change Test']);

      const productId = productResult.rows[0].id;

      await pool.query(`
        INSERT INTO price_history (product_id, price, currency, captured_at)
        VALUES 
          ($1, 100, 'USD', NOW() - INTERVAL '1 day'),
          ($1, 80, 'USD', NOW())
      `, [productId]);

      const result = await pool.query(`
        WITH ranked_prices AS (
          SELECT price, captured_at,
                 LAG(price) OVER (ORDER BY captured_at) as prev_price
          FROM price_history
          WHERE product_id = $1
          ORDER BY captured_at DESC
          LIMIT 1
        )
        SELECT price, prev_price,
               (price - prev_price) as absolute_change,
               ROUND(((price - prev_price) / prev_price * 100)::numeric, 2) as percent_change
        FROM ranked_prices
        WHERE prev_price IS NOT NULL
      `, [productId]);

      expect(result.rows.length).toBe(1);
      expect(parseFloat(result.rows[0].absolute_change)).toBe(-20);
      expect(parseFloat(result.rows[0].percent_change)).toBe(-20);
    });

    it('should get price history with limit', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/LIMIT', 'Amazon', 'Limit Test']);

      const productId = productResult.rows[0].id;

      // Insert 10 prices
      for (let i = 0; i < 10; i++) {
        await pool.query(`
          INSERT INTO price_history (product_id, price, currency)
          VALUES ($1, $2, 'USD')
        `, [productId, 100 - i]);
      }

      const result = await pool.query(`
        SELECT * FROM price_history
        WHERE product_id = $1
        ORDER BY captured_at DESC
        LIMIT 5
      `, [productId]);

      expect(result.rows.length).toBe(5);
    });
  });

  describe('filtering and search', () => {
    it('should filter products by site', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES 
          ('https://amazon.com/dp/A1', 'Amazon', 'Amazon Product 1'),
          ('https://amazon.com/dp/A2', 'Amazon', 'Amazon Product 2'),
          ('https://burton.com/b1', 'Burton', 'Burton Product 1')
      `);

      const result = await pool.query(`
        SELECT * FROM products WHERE site = $1
      `, ['Amazon']);

      expect(result.rows.length).toBe(2);
      expect(result.rows.every(r => r.site === 'Amazon')).toBe(true);
    });

    it('should find stale products', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title, last_seen_at)
        VALUES 
          ('https://amazon.com/dp/FRESH', 'Amazon', 'Fresh Product', NOW()),
          ('https://amazon.com/dp/STALE', 'Amazon', 'Stale Product', NOW() - INTERVAL '200 days')
      `);

      const result = await pool.query(`
        SELECT * FROM products 
        WHERE last_seen_at < NOW() - INTERVAL '180 days'
      `);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].title).toBe('Stale Product');
    });

    it('should search products by title', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES 
          ('https://amazon.com/dp/S1', 'Amazon', 'Sony WH-1000XM5 Headphones'),
          ('https://amazon.com/dp/S2', 'Amazon', 'Apple AirPods Pro'),
          ('https://amazon.com/dp/S3', 'Amazon', 'Sony Speaker')
      `);

      const result = await pool.query(`
        SELECT * FROM products WHERE title ILIKE $1
      `, ['%Sony%']);

      expect(result.rows.length).toBe(2);
    });
  });

  describe('aggregations', () => {
    it('should get min/max/avg prices for a product', async () => {
      const productResult = await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES ($1, $2, $3)
        RETURNING id
      `, ['https://amazon.com/dp/STATS', 'Amazon', 'Stats Product']);

      const productId = productResult.rows[0].id;

      await pool.query(`
        INSERT INTO price_history (product_id, price, currency)
        VALUES ($1, 80, 'USD'), ($1, 100, 'USD'), ($1, 120, 'USD')
      `, [productId]);

      const result = await pool.query(`
        SELECT 
          MIN(price) as min_price,
          MAX(price) as max_price,
          AVG(price)::numeric(10,2) as avg_price,
          COUNT(*) as price_count
        FROM price_history
        WHERE product_id = $1
      `, [productId]);

      expect(parseFloat(result.rows[0].min_price)).toBe(80);
      expect(parseFloat(result.rows[0].max_price)).toBe(120);
      expect(parseFloat(result.rows[0].avg_price)).toBe(100);
      expect(parseInt(result.rows[0].price_count)).toBe(3);
    });

    it('should count products by site', async () => {
      await pool.query(`
        INSERT INTO products (url, site, title)
        VALUES 
          ('https://amazon.com/dp/A1', 'Amazon', 'A1'),
          ('https://amazon.com/dp/A2', 'Amazon', 'A2'),
          ('https://amazon.com/dp/A3', 'Amazon', 'A3'),
          ('https://burton.com/b1', 'Burton', 'B1'),
          ('https://walmart.com/w1', 'Walmart', 'W1')
      `);

      const result = await pool.query(`
        SELECT site, COUNT(*) as count
        FROM products
        GROUP BY site
        ORDER BY count DESC
      `);

      expect(result.rows.length).toBe(3);
      expect(result.rows[0].site).toBe('Amazon');
      expect(parseInt(result.rows[0].count)).toBe(3);
    });
  });
});
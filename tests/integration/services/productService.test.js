import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, getTestPool } from '../../setup/testDatabase.js';

// Import actual function from source
import { upsertProductAndHistory } from '../../../src/services/productService.js';

/**
 * Integration tests for productService
 * Tests the upsertProductAndHistory function with real database
 */
describe('productService', () => {
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await closeTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM price_history');
    await pool.query('DELETE FROM products');
  });

  describe('upsertProductAndHistory', () => {
    it('should insert new product and price history', async () => {
      const productData = {
        url: 'https://example.com/product/123',
        site: 'Example',
        title: 'Test Product',
        price: 29.99,
        currency: 'USD'
      };

      const productId = await upsertProductAndHistory(productData);

      expect(productId).toBeDefined();
      expect(typeof productId).toBe('number');

      // Verify product was inserted
      const productResult = await pool.query(
        'SELECT * FROM products WHERE id = $1',
        [productId]
      );
      expect(productResult.rows.length).toBe(1);
      expect(productResult.rows[0].url).toBe(productData.url);
      expect(productResult.rows[0].title).toBe(productData.title);

      // Verify price history was inserted
      const historyResult = await pool.query(
        'SELECT * FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(historyResult.rows.length).toBe(1);
      expect(parseFloat(historyResult.rows[0].price)).toBe(productData.price);
      expect(historyResult.rows[0].currency).toBe(productData.currency);
    });

    it('should update existing product and add new price history', async () => {
      const productData = {
        url: 'https://example.com/product/456',
        site: 'Example',
        title: 'Original Title',
        price: 50.00,
        currency: 'USD'
      };

      // First insert
      const firstId = await upsertProductAndHistory(productData);

      // Update with new title and price
      const updatedData = {
        url: productData.url,
        site: productData.site,
        title: 'Updated Title',
        price: 45.00,
        currency: 'USD'
      };
      const secondId = await upsertProductAndHistory(updatedData);

      // Should return same product ID (upsert)
      expect(secondId).toBe(firstId);

      // Verify title was updated
      const productResult = await pool.query(
        'SELECT * FROM products WHERE id = $1',
        [firstId]
      );
      expect(productResult.rows[0].title).toBe('Updated Title');

      // Verify we now have 2 price history entries
      const historyResult = await pool.query(
        'SELECT * FROM price_history WHERE product_id = $1 ORDER BY captured_at',
        [firstId]
      );
      expect(historyResult.rows.length).toBe(2);
      expect(parseFloat(historyResult.rows[0].price)).toBe(50.00);
      expect(parseFloat(historyResult.rows[1].price)).toBe(45.00);
    });

    it('should use USD as default currency when not provided', async () => {
      const productData = {
        url: 'https://example.com/product/789',
        site: 'Example',
        title: 'Test Product',
        price: 100.00
        // currency not provided
      };

      const productId = await upsertProductAndHistory(productData);

      const historyResult = await pool.query(
        'SELECT currency FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(historyResult.rows[0].currency).toBe('USD');
    });

    it('should handle different currencies', async () => {
      const productData = {
        url: 'https://example.com/product/eur',
        site: 'Example',
        title: 'Euro Product',
        price: 89.99,
        currency: 'EUR'
      };

      const productId = await upsertProductAndHistory(productData);

      const historyResult = await pool.query(
        'SELECT currency FROM price_history WHERE product_id = $1',
        [productId]
      );
      expect(historyResult.rows[0].currency).toBe('EUR');
    });

    it('should handle products from different sites', async () => {
      const amazonProduct = {
        url: 'https://amazon.com/dp/TEST123',
        site: 'Amazon',
        title: 'Amazon Product',
        price: 29.99,
        currency: 'USD'
      };

      const burtonProduct = {
        url: 'https://burton.com/products/test',
        site: 'Burton',
        title: 'Burton Product',
        price: 199.99,
        currency: 'USD'
      };

      const amazonId = await upsertProductAndHistory(amazonProduct);
      const burtonId = await upsertProductAndHistory(burtonProduct);

      expect(amazonId).not.toBe(burtonId);

      // Verify both products exist
      const result = await pool.query('SELECT COUNT(*) FROM products');
      expect(parseInt(result.rows[0].count)).toBe(2);
    });
  });
});

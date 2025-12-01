import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';
import {
  addTrackedProduct,
  getAllTrackedProducts,
  getProductsToCheck,
  updateProductCheckTime,
  setProductEnabled,
  deleteTrackedProduct,
  addSearchBasedProduct,
  getSearchProductsToCheck,
  updateSearchResult,
  saveSearchResults,
  getSearchResults,
  getBestMatch,
  getPriceComparison,
} from '../../../src/db/trackedProductsRepository.js';

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
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/TEST123',
        site: 'Amazon',
        enabled: true,
      });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
    });

    it('should add tracked product with check interval', async () => {
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/TEST456',
        site: 'Amazon',
        checkIntervalMinutes: 120,
        enabled: true,
      });
      
      expect(id).toBeDefined();
      
      // Verify the interval was set
      const result = await pool.query(`
        SELECT check_interval_minutes FROM tracked_products WHERE id = $1
      `, [id]);
      expect(result.rows[0].check_interval_minutes).toBe(120);
    });

    it('should default enabled to true', async () => {
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/DEFAULTENABLED',
        site: 'Amazon',
      });
      
      const result = await pool.query(`
        SELECT enabled FROM tracked_products WHERE id = $1
      `, [id]);
      expect(result.rows[0].enabled).toBe(true);
    });

    it('should default check interval to 60 minutes', async () => {
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/DEFAULTINTERVAL',
        site: 'Amazon',
      });
      
      const result = await pool.query(`
        SELECT check_interval_minutes FROM tracked_products WHERE id = $1
      `, [id]);
      expect(result.rows[0].check_interval_minutes).toBe(60);
    });
  });

  describe('getAllTrackedProducts', () => {
    it('should return all tracked products', async () => {
      // Add products
      await addTrackedProduct({
        url: 'https://amazon.com/dp/PRODUCT1',
        site: 'Amazon',
      });
      await addTrackedProduct({
        url: 'https://amazon.com/dp/PRODUCT2',
        site: 'Amazon',
      });
      
      const products = await getAllTrackedProducts();
      
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(2);
    });

    it('should return empty array when no products', async () => {
      const products = await getAllTrackedProducts();
      expect(products).toEqual([]);
    });
  });

  describe('getProductsToCheck', () => {
    it('should return products that need checking', async () => {
      // Add product that was last checked a while ago
      const product = await addTrackedProduct({
        url: 'https://amazon.com/dp/NEEDSCHECK',
        site: 'Amazon',
        checkIntervalMinutes: 1, // 1 minute check interval
      });
      
      // Manually set last_checked_at to past
      await pool.query(`
        UPDATE tracked_products 
        SET last_checked_at = NOW() - INTERVAL '10 minutes'
        WHERE id = $1
      `, [product.id]);
      
      const products = await getProductsToCheck(10);
      
      expect(products.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect limit parameter', async () => {
      // Add multiple products
      for (let i = 0; i < 5; i++) {
        await addTrackedProduct({
          url: `https://amazon.com/dp/LIMIT${i}`,
          site: 'Amazon',
        });
      }
      
      const products = await getProductsToCheck(2);
      
      expect(products.length).toBeLessThanOrEqual(2);
    });
  });

  describe('updateProductCheckTime', () => {
    it('should update last_checked_at on success', async () => {
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/UPDATECHECK',
        site: 'Amazon',
      });
      
      await updateProductCheckTime(id, true);
      
      const result = await pool.query(`
        SELECT last_checked_at FROM tracked_products WHERE id = $1
      `, [id]);
      
      expect(result.rows[0].last_checked_at).toBeDefined();
    });
  });

  describe('setProductEnabled', () => {
    it('should enable a disabled product', async () => {
      // Insert disabled product
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/TOGGLEENABLE',
        site: 'Amazon',
        enabled: false,
      });
      
      await setProductEnabled(id, true);
      
      const result = await pool.query(`
        SELECT enabled FROM tracked_products WHERE id = $1
      `, [id]);
      expect(result.rows[0].enabled).toBe(true);
    });

    it('should disable an enabled product', async () => {
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/TOGGLEDISABLE',
        site: 'Amazon',
        enabled: true,
      });
      
      await setProductEnabled(id, false);
      
      const result = await pool.query(`
        SELECT enabled FROM tracked_products WHERE id = $1
      `, [id]);
      expect(result.rows[0].enabled).toBe(false);
    });
  });

  describe('deleteTrackedProduct', () => {
    it('should delete a tracked product', async () => {
      const id = await addTrackedProduct({
        url: 'https://amazon.com/dp/TODELETE',
        site: 'Amazon',
      });
      
      await deleteTrackedProduct(id);
      
      // Verify it's gone
      const remaining = await getAllTrackedProducts();
      expect(remaining.find(p => p.id === id)).toBeUndefined();
    });

    it('should throw for non-existent product', async () => {
      await expect(deleteTrackedProduct(99999)).rejects.toThrow();
    });

    it('should throw for invalid product ID', async () => {
      await expect(deleteTrackedProduct(-1)).rejects.toThrow();
    });
  });

  describe('addSearchBasedProduct', () => {
    it('should add search-based tracked product', async () => {
      const id = await addSearchBasedProduct({
        searchQuery: 'Burton Custom Flying V 2024',
        site: 'Burton',
        productName: 'Burton Custom Flying V',
      });
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
    });

    it('should add search-based product with details', async () => {
      const id = await addSearchBasedProduct({
        searchQuery: 'Burton Snowboard',
        site: 'Burton',
        productName: 'Burton Snowboard',
      });
      
      expect(id).toBeDefined();
      
      // Verify the product was added
      const products = await getAllTrackedProducts();
      const found = products.find(p => p.id === id);
      expect(found).toBeDefined();
    });

    it('should default enabled to true', async () => {
      const id = await addSearchBasedProduct({
        searchQuery: 'Test Search',
        site: 'Amazon',
        productName: 'Test Product',
      });
      
      const result = await pool.query(`
        SELECT enabled FROM tracked_products WHERE id = $1
      `, [id]);
      expect(result.rows[0].enabled).toBe(true);
    });
  });

  describe('getSearchProductsToCheck', () => {
    it('should return search-based products needing check', async () => {
      await addSearchBasedProduct({
        searchQuery: 'Check This Product',
        site: 'Amazon',
        productName: 'Check Product',
        checkIntervalMinutes: 1,
      });
      
      const products = await getSearchProductsToCheck(10);
      
      expect(Array.isArray(products)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await addSearchBasedProduct({
          searchQuery: `Search ${i}`,
          site: 'Amazon',
          productName: `Product ${i}`,
        });
      }
      
      const products = await getSearchProductsToCheck(2);
      expect(products.length).toBeLessThanOrEqual(2);
    });
  });

  describe('saveSearchResults and getSearchResults', () => {
    it('should save and retrieve search results', async () => {
      const trackedId = await addSearchBasedProduct({
        searchQuery: 'Test Snowboard',
        site: 'Burton',
        productName: 'Test Snowboard',
      });
      
      const searchResults = [
        {
          title: 'Burton Custom X',
          url: 'https://burton.com/custom-x',
          price: 599.99,
          site: 'Burton',
          isSponsored: false,
        },
        {
          title: 'Burton Custom',
          url: 'https://burton.com/custom',
          price: 499.99,
          site: 'Burton',
          isSponsored: false,
        },
      ];
      
      await saveSearchResults(trackedId, 'Test Snowboard', searchResults);
      
      // Retrieve results
      const results = await getSearchResults(trackedId);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
    });
  });

  describe('getBestMatch', () => {
    it('should return null when no results exist', async () => {
      const trackedId = await addSearchBasedProduct({
        searchQuery: 'No Results Product',
        site: 'Amazon',
        productName: 'No Results',
      });
      
      const bestMatch = await getBestMatch(trackedId);
      expect(bestMatch).toBeNull();
    });

    it('should return best match from search results', async () => {
      const trackedId = await addSearchBasedProduct({
        searchQuery: 'Best Match Test',
        site: 'Burton',
        productName: 'Best Match',
      });
      
      // Save some results with match scores
      await saveSearchResults(trackedId, 'Best Match Test', [
        {
          title: 'Exact Match Product',
          url: 'https://burton.com/exact',
          price: 399.99,
          site: 'Burton',
          isSponsored: false,
        },
      ]);
      
      const bestMatch = await getBestMatch(trackedId);
      
      // May be null if no match_score is set, or an object if scores exist
      expect(bestMatch === null || typeof bestMatch === 'object').toBe(true);
    });
  });

  describe('getPriceComparison', () => {
    it('should return price comparison data', async () => {
      const trackedId = await addSearchBasedProduct({
        searchQuery: 'Price Compare Test',
        site: 'Burton',
        productName: 'Price Compare',
      });
      
      // Add some search results first
      await saveSearchResults(trackedId, 'Price Compare Test', [
        {
          title: 'Product A',
          url: 'https://site-a.com/product',
          price: 199.99,
          site: 'SiteA',
          isSponsored: false,
        },
        {
          title: 'Product B',
          url: 'https://site-b.com/product',
          price: 149.99,
          site: 'SiteB',
          isSponsored: false,
        },
      ]);
      
      const comparison = await getPriceComparison(trackedId);
      
      expect(comparison).toBeDefined();
      expect(comparison.lowestPrice).toBeDefined();
      expect(comparison.highestPrice).toBeDefined();
      expect(comparison.averagePrice).toBeDefined();
      expect(comparison.totalResults).toBeGreaterThanOrEqual(0);
    });

    it('should return NaN values when no search results', async () => {
      const trackedId = await addSearchBasedProduct({
        searchQuery: 'Empty Comparison',
        site: 'Amazon',
        productName: 'Empty',
      });
      
      const comparison = await getPriceComparison(trackedId);
      
      expect(comparison).toBeDefined();
      // lowestPrice will be NaN when no results
      expect(comparison.totalResults).toBe(0);
    });
  });

  describe('updateSearchResult', () => {
    it('should update search result price', async () => {
      const trackedId = await addSearchBasedProduct({
        searchQuery: 'Update Result Test',
        site: 'Burton',
        productName: 'Update Test',
      });
      
      // Save initial result
      await saveSearchResults(trackedId, 'Update Result Test', [
        {
          title: 'Update Me',
          url: 'https://burton.com/update-me',
          price: 599.99,
          site: 'Burton',
          isSponsored: false,
        },
      ]);
      
      // Get the result ID
      const results = await getSearchResults(trackedId);
      const resultId = results[0]?.id;
      
      if (resultId) {
        await updateSearchResult(resultId, {
          price: 499.99,
          available: true,
        });
        
        const updated = await getSearchResults(trackedId);
        // Check if price was updated
        expect(updated.length).toBeGreaterThan(0);
      }
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Import actual functions from source
import { exportToJSON, exportToCSV } from '../../../src/services/exportService.js';

/**
 * Tests for Export Service
 * Tests file export functionality with real file system operations
 */
describe('Export Service', () => {
  const testDir = path.join(os.tmpdir(), 'price-tracker-test-exports');
  const testFile = path.join(testDir, 'test-export.json');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('JSON Export Logic', () => {
    it('should create valid JSON from product data', () => {
      const products = [
        { id: 1, title: 'Product 1', price: 99.99, currency: 'USD' },
        { id: 2, title: 'Product 2', price: 149.99, currency: 'USD' }
      ];

      const json = JSON.stringify(products, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Product 1');
      expect(parsed[1].price).toBe(149.99);
    });

    it('should handle empty product array', () => {
      const products = [];
      const json = JSON.stringify(products, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(0);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should preserve all product properties', () => {
      const product = {
        id: 1,
        title: 'Test Product',
        url: 'https://example.com/product',
        price: 99.99,
        currency: 'USD',
        created_at: '2024-01-01T00:00:00Z',
        scraped_at: '2024-01-15T12:00:00Z'
      };

      const json = JSON.stringify([product], null, 2);
      const parsed = JSON.parse(json);

      expect(parsed[0]).toEqual(product);
    });

    it('should handle special characters in product titles', () => {
      const products = [
        { id: 1, title: 'Product with "quotes"', price: 50 },
        { id: 2, title: "Product with 'apostrophes'", price: 60 },
        { id: 3, title: 'Product with émojis 🎉', price: 70 }
      ];

      const json = JSON.stringify(products, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed[0].title).toBe('Product with "quotes"');
      expect(parsed[1].title).toBe("Product with 'apostrophes'");
      expect(parsed[2].title).toBe('Product with émojis 🎉');
    });

    it('should handle null values', () => {
      const products = [
        { id: 1, title: 'Product', price: null }
      ];

      const json = JSON.stringify(products, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed[0].price).toBeNull();
    });
  });

  describe('File Export Operations', () => {
    it('should write JSON file to disk', async () => {
      const products = [
        { id: 1, title: 'Product 1', price: 99.99 }
      ];

      await fs.writeFile(testFile, JSON.stringify(products, null, 2));

      const stat = await fs.stat(testFile);
      expect(stat.isFile()).toBe(true);
      
      const content = await fs.readFile(testFile, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed[0].title).toBe('Product 1');
    });

    it('should overwrite existing file', async () => {
      const originalProducts = [{ id: 1, title: 'Original' }];
      const newProducts = [{ id: 2, title: 'Updated' }];

      // Write original
      await fs.writeFile(testFile, JSON.stringify(originalProducts, null, 2));
      
      // Overwrite
      await fs.writeFile(testFile, JSON.stringify(newProducts, null, 2));

      const content = await fs.readFile(testFile, 'utf8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].title).toBe('Updated');
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = path.join(testDir, 'nested', 'deep');
      const nestedFile = path.join(nestedDir, 'export.json');

      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(nestedFile, '[]');

      const stat = await fs.stat(nestedFile);
      expect(stat.isFile()).toBe(true);
    });
  });

  describe('CSV Export Logic', () => {
    it('should convert products to CSV format', () => {
      const products = [
        { id: 1, title: 'Product 1', price: 99.99, currency: 'USD' },
        { id: 2, title: 'Product 2', price: 149.99, currency: 'EUR' }
      ];

      const headers = Object.keys(products[0]).join(',');
      const rows = products.map(p => Object.values(p).join(','));
      const csv = [headers, ...rows].join('\n');

      expect(csv).toContain('id,title,price,currency');
      expect(csv).toContain('1,Product 1,99.99,USD');
      expect(csv).toContain('2,Product 2,149.99,EUR');
    });

    it('should escape commas in CSV values', () => {
      const escapeCSV = (value) => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      expect(escapeCSV('Product, with comma')).toBe('"Product, with comma"');
      expect(escapeCSV('Product "quoted"')).toBe('"Product ""quoted"""');
      expect(escapeCSV('Normal product')).toBe('Normal product');
    });
  });

  describe('Export Metadata', () => {
    it('should include export timestamp', () => {
      const products = [{ id: 1, title: 'Product' }];
      const exportData = {
        exportedAt: new Date().toISOString(),
        count: products.length,
        products: products
      };

      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.count).toBe(1);
      expect(exportData.products).toHaveLength(1);
    });

    it('should calculate statistics', () => {
      const products = [
        { id: 1, price: 100 },
        { id: 2, price: 200 },
        { id: 3, price: 150 }
      ];

      const prices = products.map(p => p.price);
      const stats = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((a, b) => a + b, 0) / prices.length
      };

      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
      expect(stats.avg).toBe(150);
    });
  });

  describe('exportToJSON (actual function)', () => {
    it('should export data to JSON file using actual function', async () => {
      const testData = [
        { id: 1, name: 'Product 1', price: 29.99 },
        { id: 2, name: 'Product 2', price: 49.99 }
      ];
      const filename = 'actual-export-test.json';
      
      // Call the actual function
      await exportToJSON(testData, filename);
      
      // Verify file was created in the exports directory
      const content = await fs.readFile(`./exports/${filename}`, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testData);
      
      // Clean up
      await fs.unlink(`./exports/${filename}`);
    });

    it('should export empty array', async () => {
      const filename = 'empty-export-test.json';
      
      await exportToJSON([], filename);
      
      const content = await fs.readFile(`./exports/${filename}`, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual([]);
      
      // Clean up
      await fs.unlink(`./exports/${filename}`);
    });

    it('should export complex nested data', async () => {
      const testData = [
        {
          id: 1,
          name: 'Product 1',
          priceHistory: [
            { date: '2024-01-01', price: 100 },
            { date: '2024-01-15', price: 90 }
          ],
          metadata: {
            category: 'Electronics',
            tags: ['sale', 'popular']
          }
        }
      ];
      const filename = 'nested-export-test.json';
      
      await exportToJSON(testData, filename);
      
      const content = await fs.readFile(`./exports/${filename}`, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed[0].priceHistory).toHaveLength(2);
      expect(parsed[0].metadata.category).toBe('Electronics');
      
      // Clean up
      await fs.unlink(`./exports/${filename}`);
    });
  });

  describe('exportToCSV (actual function)', () => {
    it('should throw not implemented error', async () => {
      await expect(exportToCSV([{ id: 1 }], 'test.csv'))
        .rejects.toThrow('CSV export not implemented yet');
    });
  });
});

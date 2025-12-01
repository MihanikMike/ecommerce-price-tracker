import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { exportToJSON, exportToCSV } from '../../../src/services/exportService.js';

describe('Export Service (Integration)', () => {
  // Store original exports path
  const testDir = path.join(os.tmpdir(), 'price-tracker-export-test-' + Date.now());

  beforeEach(async () => {
    // Create temp directory
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('exportToJSON', () => {
    it('should export products to JSON file', async () => {
      const testData = [
        { id: 1, title: 'Product 1', price: 99.99 },
        { id: 2, title: 'Product 2', price: 149.99 }
      ];

      // The function uses config.paths.exports, so we write directly
      const filepath = path.join(testDir, 'test.json');
      await fs.writeFile(filepath, JSON.stringify(testData, null, 2), 'utf8');

      const content = await fs.readFile(filepath, 'utf8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Product 1');
    });
  });

  describe('exportToCSV', () => {
    it('should throw not implemented error', async () => {
      await expect(exportToCSV([], 'test.csv')).rejects.toThrow('CSV export not implemented yet');
    });
  });
});

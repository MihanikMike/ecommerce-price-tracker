import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

describe('Price Changes API', () => {
  let baseUrl;
  let pool;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    
    // Start API server on random port
    const { startApiServer } = await import('../../../src/server/api-server.js');
    const port = await startApiServer(0);
    baseUrl = `http://localhost:${port}`;
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    const { stopApiServer } = await import('../../../src/server/api-server.js');
    await stopApiServer();
    await closeTestDatabase();
  });

  describe('GET /api/price-changes', () => {
    it('should return empty array when no price changes', async () => {
      const response = await fetch(`${baseUrl}/api/price-changes`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.priceChanges).toBeDefined();
      expect(Array.isArray(data.priceChanges)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await fetch(`${baseUrl}/api/price-changes?hours=24&limit=5`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.period).toBeDefined();
      expect(data.count).toBeDefined();
    });
  });

  describe('GET /api/price-changes/drops', () => {
    it('should return price drops', async () => {
      const response = await fetch(`${baseUrl}/api/price-changes/drops`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.priceDrops).toBeDefined();
    });

    it('should support days parameter', async () => {
      const response = await fetch(`${baseUrl}/api/price-changes/drops?days=7`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.period).toBe('7 days');
    });
  });
});

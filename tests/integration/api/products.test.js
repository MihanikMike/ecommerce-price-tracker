import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import http from 'http';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase 
} from '../../setup/testDatabase.js';

// Import after mocking
let server;
let baseUrl;

describe('Products API', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    
    // Start API server on random port
    const { startApiServer, stopApiServer } = await import('../../../src/server/api-server.js');
    const port = await startApiServer(0); // 0 = random available port
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

  describe('GET /api/products', () => {
    it('should return empty array when no products', async () => {
      const response = await fetch(`${baseUrl}/api/products`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.products).toEqual([]);
      expect(data.pagination.total).toBe(0);
    });

    it('should return products with pagination', async () => {
      // Seed some products first...
      
      const response = await fetch(`${baseUrl}/api/products?page=1&limit=10`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return 404 for non-existent product', async () => {
      const response = await fetch(`${baseUrl}/api/products/99999`);
      
      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid ID', async () => {
      const response = await fetch(`${baseUrl}/api/products/abc`);
      
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/tracked', () => {
    it('should create URL-based tracked product', async () => {
      const response = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://amazon.com/dp/TEST123',
          site: 'Amazon'
        })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.tracked.url).toBe('https://amazon.com/dp/TEST123');
    });

    it('should create search-based tracked product', async () => {
      const response = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'AirPods Pro 3',
          site: 'any'
        })
      });
      
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.tracked.product_name).toBe('AirPods Pro 3');
      expect(data.tracked.tracking_mode).toBe('search');
    });

    it('should return 400 for missing url and productName', async () => {
      const response = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site: 'Amazon'
        })
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/tracked', () => {
    it('should return all tracked products', async () => {
      // Create a tracked product first
      await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://amazon.com/dp/TRACKED1',
          site: 'Amazon'
        })
      });

      const response = await fetch(`${baseUrl}/api/tracked`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data.tracked)).toBe(true);
      expect(data.tracked.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/tracked/:id', () => {
    it('should delete a tracked product', async () => {
      // Create a tracked product first
      const createResponse = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://amazon.com/dp/TODELETE',
          site: 'Amazon'
        })
      });
      const createData = await createResponse.json();
      const trackedId = createData.tracked.id;

      const deleteResponse = await fetch(`${baseUrl}/api/tracked/${trackedId}`, {
        method: 'DELETE',
      });
      
      expect(deleteResponse.status).toBe(200);
    });

    it('should return 404 for non-existent tracked product', async () => {
      const response = await fetch(`${baseUrl}/api/tracked/99999`, {
        method: 'DELETE',
      });
      
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/tracked/:id', () => {
    it('should enable a tracked product', async () => {
      // Create a tracked product first
      const createResponse = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://amazon.com/dp/TOENABLE',
          site: 'Amazon'
        })
      });
      const createData = await createResponse.json();
      const trackedId = createData.tracked.id;

      const patchResponse = await fetch(`${baseUrl}/api/tracked/${trackedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true })
      });
      
      expect(patchResponse.status).toBe(200);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await fetch(`${baseUrl}/api/tracked/99999`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      });
      
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/stats', () => {
    it('should return database statistics', async () => {
      const response = await fetch(`${baseUrl}/api/stats`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('tracking');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/stats/config', () => {
    it('should return configuration', async () => {
      const response = await fetch(`${baseUrl}/api/stats/config`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('retention');
      expect(data).toHaveProperty('priceChange');
    });
  });

  describe('GET /api/price-changes', () => {
    it('should return price changes data', async () => {
      const response = await fetch(`${baseUrl}/api/price-changes`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('priceChanges');
    });
  });

  describe('GET /api/price-changes/drops', () => {
    it('should return price drops data', async () => {
      const response = await fetch(`${baseUrl}/api/price-changes/drops`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('priceDrops');
    });
  });

  describe('GET /api/tracked/:id', () => {
    it('should return tracked product by id', async () => {
      // Create a tracked product first
      const createResponse = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://amazon.com/dp/GETBYID',
          site: 'Amazon'
        })
      });
      const createData = await createResponse.json();
      const trackedId = createData.tracked.id;

      const response = await fetch(`${baseUrl}/api/tracked/${trackedId}`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.tracked.id).toBe(trackedId);
    });

    it('should return 404 for non-existent tracked id', async () => {
      const response = await fetch(`${baseUrl}/api/tracked/99999`);
      
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/products/:id/history', () => {
    it('should return 404 for non-existent product history', async () => {
      const response = await fetch(`${baseUrl}/api/products/99999/history`);
      
      expect(response.status).toBe(404);
    });
  });
});
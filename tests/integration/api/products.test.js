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
  });
});
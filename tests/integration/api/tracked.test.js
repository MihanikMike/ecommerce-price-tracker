import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

describe('Tracked Products API', () => {
  let baseUrl;

  beforeAll(async () => {
    await setupTestDatabase();
    
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

  describe('GET /api/tracked', () => {
    it('should return empty array when no tracked products', async () => {
      const response = await fetch(`${baseUrl}/api/tracked`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.tracked).toEqual([]);
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
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject invalid URL', async () => {
      const response = await fetch(`${baseUrl}/api/tracked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'not-a-valid-url'
        })
      });
      
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tracked/:id', () => {
    it('should return 404 for non-existent tracked product', async () => {
      const response = await fetch(`${baseUrl}/api/tracked/99999`, {
        method: 'DELETE'
      });
      
      expect(response.status).toBe(404);
    });
  });
});

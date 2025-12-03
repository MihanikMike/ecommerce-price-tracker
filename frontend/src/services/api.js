const API_BASE = '/api';

/**
 * API client for the price tracker backend
 */
const api = {
  // ==================== Products ====================
  
  /**
   * Get paginated list of products
   */
  getProducts: async ({ page = 1, limit = 20, site = null }) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (site) params.append('site', site);
    const res = await fetch(`${API_BASE}/products?${params}`);
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  /**
   * Get a single product by ID
   */
  getProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (!res.ok) throw new Error('Failed to fetch product');
    return res.json();
  },

  /**
   * Delete a product
   */
  deleteProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
    return res.json();
  },

  // ==================== Tracked Products ====================

  /**
   * Get paginated list of tracked products
   */
  getTracked: async ({ page = 1, limit = 20, mode = null, enabled = null }) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (mode) params.append('mode', mode);
    if (enabled !== null) params.append('enabled', String(enabled));
    const res = await fetch(`${API_BASE}/tracked?${params}`);
    if (!res.ok) throw new Error('Failed to fetch tracked products');
    return res.json();
  },

  /**
   * Add a new tracked product
   */
  addTracked: async (data) => {
    const res = await fetch(`${API_BASE}/tracked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add tracked product');
    return res.json();
  },

  /**
   * Update a tracked product
   */
  updateTracked: async (id, data) => {
    const res = await fetch(`${API_BASE}/tracked/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update tracked product');
    return res.json();
  },

  /**
   * Delete a tracked product
   */
  deleteTracked: async (id) => {
    const res = await fetch(`${API_BASE}/tracked/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete tracked product');
    return res.json();
  },

  // ==================== Charts ====================

  /**
   * Get chart data for a product
   */
  getChartData: async (id, range = '30d') => {
    const res = await fetch(`${API_BASE}/charts/product/${id}?range=${range}`);
    if (!res.ok) throw new Error('Failed to fetch chart data');
    return res.json();
  },

  // ==================== Price History ====================

  /**
   * Get price history for a product
   */
  getProductHistory: async (id, { limit = 100, days = null } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (days) params.append('days', String(days));
    const res = await fetch(`${API_BASE}/products/${id}/history?${params}`);
    if (!res.ok) throw new Error('Failed to fetch price history');
    return res.json();
  },

  // ==================== Price Changes ====================

  /**
   * Get price changes/drops
   */
  getPriceChanges: async ({ hours = 24, minDrop = 0, limit = 50 }) => {
    const params = new URLSearchParams({
      hours: String(hours),
      minDrop: String(minDrop),
      limit: String(limit),
    });
    const res = await fetch(`${API_BASE}/price-changes?${params}`);
    if (!res.ok) throw new Error('Failed to fetch price changes');
    return res.json();
  },

  // ==================== Stats ====================

  /**
   * Get system statistics
   */
  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // ==================== Cache ====================

  /**
   * Get cache statistics
   */
  getCacheStats: async () => {
    const res = await fetch(`${API_BASE}/cache/stats`);
    if (!res.ok) throw new Error('Failed to fetch cache stats');
    return res.json();
  },

  /**
   * Clear cache
   */
  clearCache: async () => {
    const res = await fetch(`${API_BASE}/cache`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear cache');
    return res.json();
  },

  // ==================== Health ====================

  /**
   * Check API health
   */
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('API is unhealthy');
    return res.json();
  },
};

export default api;

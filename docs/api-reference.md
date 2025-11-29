# API Reference

**E-Commerce Price Tracker REST API**

The API provides programmatic access to product data, price history, and tracking management.

## Quick Start

```bash
# Start API server standalone
npm run api

# Or start with main application (includes price monitoring)
npm start
```

**Default Ports:**
- API Server: `http://localhost:3001`
- Health Server: `http://localhost:3000`

**Environment Variables:**
```env
API_PORT=3001       # API server port
HEALTH_PORT=3000    # Health/metrics server port
```

---

## Base URL

```
http://localhost:3001/api
```

All endpoints are prefixed with `/api`.

---

## Authentication

Currently, the API does not require authentication. For production deployments, consider adding API key or JWT authentication.

---

## Common Response Format

### Success Response
```json
{
  "products": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "error": true,
  "message": "Error description",
  "details": "Additional details",
  "timestamp": "2025-11-29T12:00:00.000Z"
}
```

---

## Pagination

List endpoints support pagination via query parameters:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | 1 | - | Page number (1-indexed) |
| `limit` | 20 | 100 | Items per page |

**Example:**
```bash
curl "http://localhost:3001/api/products?page=2&limit=10"
```

---

## Products API

### List All Products

```http
GET /api/products
```

Returns all products with their latest prices.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `site` | string | Filter by site (e.g., "Amazon", "Burton") |

**Example Request:**
```bash
curl "http://localhost:3001/api/products?site=Amazon&limit=5"
```

**Example Response:**
```json
{
  "products": [
    {
      "id": 1,
      "url": "https://www.amazon.com/dp/B0ABC123",
      "title": "Apple AirPods Pro 3",
      "site": "Amazon",
      "created_at": "2025-11-29T10:00:00.000Z",
      "last_seen_at": "2025-11-29T16:00:00.000Z",
      "latest_price": "219.99",
      "currency": "USD",
      "price_captured_at": "2025-11-29T16:00:00.000Z",
      "price_count": "5"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 3,
    "totalPages": 1
  }
}
```

---

### Get Single Product

```http
GET /api/products/:id
```

Returns a product with its price summary (min, max, avg, volatility).

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Product ID |

**Example Request:**
```bash
curl http://localhost:3001/api/products/1
```

**Example Response:**
```json
{
  "product": {
    "id": 1,
    "url": "https://www.amazon.com/dp/B0ABC123",
    "title": "Apple AirPods Pro 3",
    "site": "Amazon",
    "latest_price": "219.99",
    "currency": "USD"
  },
  "priceSummary": {
    "productId": 1,
    "period": "30 days",
    "minPrice": 199.99,
    "maxPrice": 249.99,
    "avgPrice": 224.99,
    "currentPrice": 219.99,
    "dataPoints": 15,
    "priceRange": 50,
    "volatility": 22,
    "periodChange": {
      "absoluteChange": -10,
      "percentChange": -4.35,
      "direction": "down"
    }
  }
}
```

---

### Get Price History

```http
GET /api/products/:id/history
```

Returns price history for a product.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Product ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Max records (up to 1000) |
| `days` | number | - | Only include last N days |

**Example Request:**
```bash
curl "http://localhost:3001/api/products/1/history?days=7&limit=50"
```

**Example Response:**
```json
{
  "productId": 1,
  "history": [
    {
      "id": 100,
      "price": "219.99",
      "currency": "USD",
      "captured_at": "2025-11-29T16:00:00.000Z"
    },
    {
      "id": 99,
      "price": "224.99",
      "currency": "USD",
      "captured_at": "2025-11-28T16:00:00.000Z"
    }
  ],
  "count": 2
}
```

---

### Delete Product

```http
DELETE /api/products/:id
```

Deletes a product and all its price history.

**Example Request:**
```bash
curl -X DELETE http://localhost:3001/api/products/1
```

**Example Response:**
```json
{
  "success": true,
  "productId": 1
}
```

---

## Tracked Products API

Tracked products are URLs or search terms that the system monitors for price changes.

### List Tracked Products

```http
GET /api/tracked
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `mode` | string | Filter by `url` or `search` |
| `enabled` | boolean | Filter by enabled status |

**Example Request:**
```bash
curl "http://localhost:3001/api/tracked?mode=url&enabled=true"
```

**Example Response:**
```json
{
  "tracked": [
    {
      "id": 1,
      "url": "https://www.amazon.com/dp/B0ABC123",
      "product_name": null,
      "site": "Amazon",
      "tracking_mode": "url",
      "enabled": true,
      "check_interval_minutes": 60,
      "last_checked_at": "2025-11-29T16:00:00.000Z",
      "next_check_at": "2025-11-29T17:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### Get Single Tracked Product

```http
GET /api/tracked/:id
```

**Example Request:**
```bash
curl http://localhost:3001/api/tracked/1
```

---

### Add Tracked Product

```http
POST /api/tracked
```

Add a new product to track. Supports two modes:

#### URL-Based Tracking
Track a specific product URL.

```bash
curl -X POST http://localhost:3001/api/tracked \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.amazon.com/dp/B0ABC123",
    "site": "Amazon",
    "enabled": true,
    "checkIntervalMinutes": 60
  }'
```

#### Search-Based Tracking
Track a product by name (uses Bing search).

```bash
curl -X POST http://localhost:3001/api/tracked \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Apple AirPods Pro 3",
    "site": "any",
    "keywords": ["wireless", "earbuds"],
    "enabled": true,
    "checkIntervalMinutes": 120
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes* | Product URL (for URL-based) |
| `productName` | string | Yes* | Product name (for search-based) |
| `site` | string | No | Site name or "any" |
| `keywords` | array | No | Search keywords |
| `enabled` | boolean | No | Enable tracking (default: true) |
| `checkIntervalMinutes` | number | No | Check interval (default: 60) |

*Either `url` or `productName` is required.

**Example Response:**
```json
{
  "success": true,
  "tracked": {
    "id": 5,
    "url": "https://www.amazon.com/dp/B0ABC123",
    "site": "Amazon",
    "tracking_mode": "url",
    "enabled": true,
    "check_interval_minutes": 60
  }
}
```

---

### Update Tracked Product

```http
PATCH /api/tracked/:id
```

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Enable/disable tracking |
| `checkIntervalMinutes` | number | Check interval in minutes |
| `site` | string | Update site |
| `keywords` | array | Update search keywords |

**Example Request:**
```bash
curl -X PATCH http://localhost:3001/api/tracked/1 \
  -H "Content-Type: application/json" \
  -d '{
    "checkIntervalMinutes": 30,
    "enabled": true
  }'
```

---

### Delete Tracked Product

```http
DELETE /api/tracked/:id
```

**Example Request:**
```bash
curl -X DELETE http://localhost:3001/api/tracked/1
```

---

### Enable/Disable Tracking

```http
POST /api/tracked/:id/enable
POST /api/tracked/:id/disable
```

**Example Request:**
```bash
# Disable tracking
curl -X POST http://localhost:3001/api/tracked/1/disable

# Enable tracking
curl -X POST http://localhost:3001/api/tracked/1/enable
```

---

## Price Changes API

### Get Recent Price Changes

```http
GET /api/price-changes
```

Returns significant price changes within a time period.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hours` | number | 24 | Time period in hours |
| `limit` | number | 20 | Max results |

**Example Request:**
```bash
curl "http://localhost:3001/api/price-changes?hours=48&limit=10"
```

**Example Response:**
```json
{
  "priceChanges": [
    {
      "product_id": 1,
      "url": "https://www.amazon.com/dp/B0ABC123",
      "site": "Amazon",
      "title": "Apple AirPods Pro 3",
      "old_price": "249.99",
      "new_price": "219.99",
      "currency": "USD",
      "percent_change": "-12.00",
      "absolute_change": "-30.00",
      "direction": "down",
      "old_captured_at": "2025-11-28T12:00:00.000Z",
      "new_captured_at": "2025-11-29T12:00:00.000Z"
    }
  ],
  "period": "48 hours",
  "count": 1
}
```

---

### Get Biggest Price Drops

```http
GET /api/price-changes/drops
```

Returns the biggest price drops (deals) in a time period.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 7 | Time period in days |
| `limit` | number | 20 | Max results |

**Example Request:**
```bash
curl "http://localhost:3001/api/price-changes/drops?days=30&limit=5"
```

---

## Stats API

### Get Database Statistics

```http
GET /api/stats
```

Returns database size and record counts.

**Example Response:**
```json
{
  "database": {
    "products": {
      "count": 25,
      "oldestRecord": "2025-11-01T10:00:00.000Z",
      "newestRecord": "2025-11-29T16:00:00.000Z"
    },
    "priceHistory": {
      "count": 500,
      "oldestRecord": "2025-11-01T10:00:00.000Z"
    },
    "trackedProducts": {
      "count": 10,
      "enabled": 8
    }
  },
  "tracking": {
    "total": "10",
    "enabled": "8",
    "url_based": "6",
    "search_based": "4"
  },
  "timestamp": "2025-11-29T16:00:00.000Z"
}
```

---

### Get Configuration

```http
GET /api/stats/config
```

Returns current (non-sensitive) configuration.

**Example Response:**
```json
{
  "priceChange": {
    "minAbsoluteChange": 1,
    "minPercentChange": 5,
    "alertDropThreshold": 10,
    "alertIncreaseThreshold": 20
  },
  "retention": {
    "priceHistoryDays": 90,
    "minPriceRecordsPerProduct": 10,
    "staleProductDays": 180
  },
  "scraper": {
    "useProxy": false,
    "browserPoolSize": 3
  },
  "version": "1.0.0"
}
```

---

## Search API

### Search for Products

```http
POST /api/search
```

Search for products across e-commerce sites using Bing.

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `maxResults` | number | No | Max results (default: 10) |
| `sites` | array | No | Limit to specific sites |

**Example Request:**
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Nintendo Switch OLED",
    "maxResults": 5
  }'
```

**Example Response:**
```json
{
  "query": "Nintendo Switch OLED",
  "results": [
    {
      "title": "Nintendo Switch OLED Model",
      "url": "https://www.amazon.com/dp/B098RKWHHZ",
      "site": "Amazon",
      "price": "$349.99"
    },
    {
      "title": "Nintendo Switch OLED",
      "url": "https://www.target.com/p/-/A-12345",
      "site": "Target",
      "price": "$349.99"
    }
  ],
  "count": 2
}
```

---

## Health Endpoints

These endpoints are on the health server (port 3000 by default).

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Full health check with component status |
| `GET /ready` | Kubernetes readiness probe |
| `GET /live` | Kubernetes liveness probe |
| `GET /metrics` | Prometheus metrics |

**Example:**
```bash
curl http://localhost:3000/health
```

---

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Rate Limiting

The API currently does not implement rate limiting. For production, consider:
- Adding rate limiting middleware
- Using API keys with quotas
- Implementing request throttling

---

## Examples

### Complete Workflow

```bash
# 1. Add a product to track
curl -X POST http://localhost:3001/api/tracked \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.amazon.com/dp/B0FQFB8FMG","site":"Amazon"}'

# 2. Check tracked products
curl http://localhost:3001/api/tracked

# 3. Wait for price monitoring to run (or trigger manually)

# 4. View products with prices
curl http://localhost:3001/api/products

# 5. Check price history
curl http://localhost:3001/api/products/1/history

# 6. Look for price drops
curl http://localhost:3001/api/price-changes/drops

# 7. Get statistics
curl http://localhost:3001/api/stats
```

### Using with JavaScript

```javascript
// Fetch products
const response = await fetch('http://localhost:3001/api/products');
const data = await response.json();
console.log(data.products);

// Add tracked product
await fetch('http://localhost:3001/api/tracked', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productName: 'PlayStation 5',
    site: 'any'
  })
});
```

### Using with Python

```python
import requests

# List products
response = requests.get('http://localhost:3001/api/products')
products = response.json()['products']

# Add tracked product
requests.post('http://localhost:3001/api/tracked', json={
    'url': 'https://www.amazon.com/dp/B0ABC123',
    'site': 'Amazon'
})

# Get price changes
changes = requests.get('http://localhost:3001/api/price-changes?hours=24')
print(changes.json())
```

---

## Changelog

### v1.0.0 (November 29, 2025)
- Initial API release
- Products CRUD operations
- Tracked products management
- Price change detection endpoints
- Search functionality
- Statistics and configuration endpoints

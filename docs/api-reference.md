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

## Charts API

Interactive price history charts with Chart.js-compatible data.

### List Products for Charts

```http
GET /api/charts/products
```

Returns products that have price history available for charting.

**Example Request:**
```bash
curl http://localhost:3001/api/charts/products
```

**Example Response:**
```json
{
  "products": [
    {
      "id": 1,
      "title": "Apple AirPods Pro 3",
      "site": "Amazon",
      "price_count": 15,
      "latest_price": "219.99",
      "currency": "USD"
    }
  ],
  "count": 1
}
```

---

### Get Chart Data

```http
GET /api/charts/product/:id
```

Returns Chart.js-formatted price data for a product.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Product ID |

**Query Parameters:**
| Parameter | Type | Default | Options | Description |
|-----------|------|---------|---------|-------------|
| `range` | string | `30d` | `24h`, `7d`, `30d`, `90d`, `1y`, `all` | Time range |

**Example Request:**
```bash
curl "http://localhost:3001/api/charts/product/1?range=30d"
```

**Example Response:**
```json
{
  "productId": 1,
  "range": "30d",
  "labels": ["2025-11-01", "2025-11-15", "2025-11-29"],
  "datasets": [
    {
      "label": "Price (USD)",
      "data": [249.99, 234.99, 219.99],
      "borderColor": "#4F46E5",
      "fill": false
    }
  ],
  "stats": {
    "min": 219.99,
    "max": 249.99,
    "avg": 234.99,
    "current": 219.99,
    "change": -12.0
  }
}
```

---

### Get Product Info for Chart Header

```http
GET /api/charts/product/:id/info
```

Returns product metadata for chart headers/titles.

**Example Request:**
```bash
curl http://localhost:3001/api/charts/product/1/info
```

**Example Response:**
```json
{
  "id": 1,
  "title": "Apple AirPods Pro 3",
  "site": "Amazon",
  "url": "https://www.amazon.com/dp/B0ABC123",
  "latest_price": "219.99",
  "currency": "USD",
  "price_count": 15
}
```

---

### Get Daily Aggregated Chart Data

```http
GET /api/charts/product/:id/daily
```

Returns daily aggregated price data (min, max, avg per day).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `range` | string | `90d` | Time range |

**Example Request:**
```bash
curl "http://localhost:3001/api/charts/product/1/daily?range=90d"
```

**Example Response:**
```json
{
  "productId": 1,
  "range": "90d",
  "labels": ["2025-09-01", "2025-09-02", "..."],
  "datasets": [
    {
      "label": "Daily Average",
      "data": [249.99, 249.99, "..."],
      "borderColor": "#4F46E5"
    },
    {
      "label": "Daily Min",
      "data": [249.99, 245.99, "..."],
      "borderColor": "#10B981"
    },
    {
      "label": "Daily Max",
      "data": [249.99, 252.99, "..."],
      "borderColor": "#EF4444"
    }
  ]
}
```

---

### Compare Multiple Products

```http
GET /api/charts/compare
```

Returns chart data comparing multiple products.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ids` | string | Yes | Comma-separated product IDs (max 10) |
| `range` | string | No | Time range (default: `30d`) |

**Example Request:**
```bash
curl "http://localhost:3001/api/charts/compare?ids=1,2,3&range=30d"
```

**Example Response:**
```json
{
  "range": "30d",
  "labels": ["2025-11-01", "2025-11-15", "2025-11-29"],
  "datasets": [
    {
      "label": "Apple AirPods Pro 3",
      "data": [249.99, 234.99, 219.99],
      "borderColor": "#4F46E5"
    },
    {
      "label": "Sony WF-1000XM5",
      "data": [279.99, 269.99, 259.99],
      "borderColor": "#10B981"
    }
  ],
  "products": [
    { "id": 1, "title": "Apple AirPods Pro 3" },
    { "id": 2, "title": "Sony WF-1000XM5" }
  ]
}
```

---

### Chart UI

Access the interactive chart interface directly:

```
http://localhost:3001/chart.html?id=1
```

**Features:**
- Interactive Chart.js visualization
- Time range selector (24h, 7d, 30d, 90d, 1y, all)
- Product comparison mode (up to 5 products)
- Statistics cards (current, min, max, avg, change)
- Dark theme UI

---

## Cache API

Redis-based caching for improved API performance.

> **Note:** Cache is optional. Set `CACHE_ENABLED=true` in your environment to enable.

### Get Cache Statistics

```http
GET /api/cache/stats
```

Returns cache statistics and connection status.

**Example Request:**
```bash
curl http://localhost:3001/api/cache/stats
```

**Example Response:**
```json
{
  "enabled": true,
  "connected": true,
  "keyCount": 45,
  "memoryUsed": "2.5MB",
  "hits": 1250,
  "misses": 150,
  "hitRate": "89.29%",
  "uptime": 86400
}
```

**Response when disabled:**
```json
{
  "enabled": false,
  "connected": false,
  "message": "Cache is disabled. Set CACHE_ENABLED=true to enable."
}
```

---

### Clear All Cache

```http
DELETE /api/cache
```

Clears all cached data.

**Example Request:**
```bash
curl -X DELETE http://localhost:3001/api/cache
```

**Example Response:**
```json
{
  "success": true,
  "message": "Cache cleared"
}
```

---

### Clear Product Cache

```http
DELETE /api/cache/product/:id
```

Clears cached data for a specific product.

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | number | Product ID |

**Example Request:**
```bash
curl -X DELETE http://localhost:3001/api/cache/product/1
```

**Example Response:**
```json
{
  "success": true,
  "productId": 1,
  "message": "Product cache cleared"
}
```

---

### Cache Configuration

```env
# Enable caching (optional - defaults to false)
CACHE_ENABLED=true

# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=            # Optional
REDIS_DB=0                 # Optional

# TTL settings (seconds)
CACHE_TTL_PRODUCT=300          # 5 minutes
CACHE_TTL_PRODUCT_LIST=60      # 1 minute
CACHE_TTL_PRICE_HISTORY=120    # 2 minutes
CACHE_TTL_CHART=180            # 3 minutes
CACHE_TTL_SEARCH=600           # 10 minutes
CACHE_TTL_STATS=30             # 30 seconds
```

### Cached Endpoints

The following endpoints use caching when enabled:

| Endpoint | TTL | Description |
|----------|-----|-------------|
| `GET /api/products/:id` | 5 min | Single product data |
| `GET /api/products/:id/history` | 10 min | Price history |
| `GET /api/charts/product/:id` | 3 min | Chart data |
| `GET /api/charts/product/:id/daily` | 3 min | Daily chart data |
| `GET /api/stats` | 5 min | Database statistics |

Cached responses include a `fromCache: true` field when served from cache.

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

### v1.2.0 (December 1, 2025)
- **Cache API** - Redis-based caching layer for performance
  - `GET /api/cache/stats` - Cache statistics
  - `DELETE /api/cache` - Clear all cache
  - `DELETE /api/cache/product/:id` - Clear product cache
- Cached responses include `fromCache: true` indicator

### v1.1.0 (December 1, 2025)
- **Charts API** - Interactive price history visualization
  - `GET /api/charts/products` - List chartable products
  - `GET /api/charts/product/:id` - Get Chart.js data
  - `GET /api/charts/product/:id/info` - Product info for charts
  - `GET /api/charts/product/:id/daily` - Daily aggregated data
  - `GET /api/charts/compare` - Compare multiple products
- Added `/chart.html` interactive chart UI

### v1.0.0 (November 29, 2025)
- Initial API release
- Products CRUD operations
- Tracked products management
- Price change detection endpoints
- Search functionality
- Statistics and configuration endpoints

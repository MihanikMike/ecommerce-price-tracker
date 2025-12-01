# Testing Guide

**E-Commerce Price Tracker - Testing Strategy & Implementation**

This guide outlines the testing approach, tools, and best practices for the price tracker application.

---

## Table of Contents

1. [Testing Stack](#testing-stack)
2. [Test Types](#test-types)
3. [Directory Structure](#directory-structure)
4. [Setup Instructions](#setup-instructions)
5. [Unit Tests](#unit-tests)
6. [Integration Tests](#integration-tests)
7. [End-to-End Tests](#end-to-end-tests)
8. [Test Database](#test-database)
9. [Mocking Strategies](#mocking-strategies)
10. [Coverage Requirements](#coverage-requirements)
11. [CI/CD Integration](#cicd-integration)
12. [Running Tests](#running-tests)

---

## Testing Stack

### Primary Tools

| Tool | Purpose | Why |
|------|---------|-----|
| **Jest** | Test runner & assertions | Industry standard, excellent ES modules support, built-in mocking |
| **Supertest** | HTTP API testing | Easy integration with Node.js HTTP servers |
| **jest-mock-extended** | Enhanced mocking | Better TypeScript/JSDoc support for mocks |
| **Playwright Test** | E2E browser testing | Already using Playwright for scraping |

### Supporting Tools

| Tool | Purpose |
|------|---------|
| **@testcontainers/postgresql** | Disposable PostgreSQL for integration tests |
| **faker-js** | Generate realistic test data |
| **nock** | HTTP request mocking for external APIs |

---

## Test Types

### 1. Unit Tests (70% of tests)
- Test individual functions in isolation
- Mock all dependencies
- Fast execution (<1ms per test)
- No database, no network

**Target modules:**
- `src/utils/validation.js`
- `src/utils/delay.js`
- `src/utils/retry.js`
- `src/services/priceChangeService.js` (pure functions)
- `src/search/product-matcher.js`

### 2. Integration Tests (25% of tests)
- Test modules working together
- Use real test database
- Mock external services (Bing, e-commerce sites)
- Medium execution time

**Target modules:**
- `src/db/productRepository.js`
- `src/db/trackedProductsRepository.js`
- `src/server/api-server.js`
- `src/services/retentionService.js`

### 3. End-to-End Tests (5% of tests)
- Full application workflow
- Real browser (Playwright)
- Expensive, run less frequently

**Target flows:**
- Complete price monitoring cycle
- API → Database → Response flow

---

## Directory Structure

```
tests/
├── setup/
│   ├── jest.setup.js          # Global test setup
│   ├── testDatabase.js        # Test DB utilities
│   └── mocks/
│       ├── browserPool.js     # Mock browser pool
│       ├── logger.js          # Silent logger for tests
│       └── playwright.js      # Mock Playwright
├── unit/
│   ├── utils/
│   │   ├── validation.test.js
│   │   ├── delay.test.js
│   │   ├── retry.test.js
│   │   └── rate-limiter.test.js
│   ├── services/
│   │   ├── priceChangeService.test.js
│   │   └── retentionService.test.js
│   └── search/
│       └── product-matcher.test.js
├── integration/
│   ├── db/
│   │   ├── productRepository.test.js
│   │   └── trackedProductsRepository.test.js
│   ├── api/
│   │   ├── products.test.js
│   │   ├── tracked.test.js
│   │   └── priceChanges.test.js
│   └── services/
│       └── retentionService.test.js
├── e2e/
│   ├── priceMonitor.test.js
│   └── searchMonitor.test.js
└── fixtures/
    ├── products.json          # Sample product data
    ├── priceHistory.json      # Sample price history
    └── html/
        ├── amazon-product.html
        └── target-product.html
```

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install --save-dev \
  jest \
  @jest/globals \
  supertest \
  jest-mock-extended \
  nock \
  @faker-js/faker
```

### 2. Configure Jest

Create `jest.config.js`:

```javascript
export default {
  // Use ES modules
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['./tests/setup/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli/**',
    '!src/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Module name mapping for mocks
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Timeout for async tests
  testTimeout: 10000,
  
  // Run tests in parallel
  maxWorkers: '50%'
};
```

### 3. Create Test Setup File

Create `tests/setup/jest.setup.js`:

```javascript
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection in test:', error);
});
```

### 4. Add npm Scripts

In `package.json`:

```json
{
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
    "test:watch": "NODE_OPTIONS='--experimental-vm-modules' jest --watch",
    "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage",
    "test:unit": "NODE_OPTIONS='--experimental-vm-modules' jest tests/unit",
    "test:integration": "NODE_OPTIONS='--experimental-vm-modules' jest tests/integration",
    "test:e2e": "NODE_OPTIONS='--experimental-vm-modules' jest tests/e2e"
  }
}
```

---

## Unit Tests

### Example: Testing Validation Functions

```javascript
// tests/unit/utils/validation.test.js
import { describe, it, expect } from '@jest/globals';
import { 
  validateUrl, 
  validatePrice, 
  validateScrapedData 
} from '../../../src/utils/validation.js';

describe('validation', () => {
  describe('validateUrl', () => {
    it('should accept valid HTTP URLs', () => {
      const result = validateUrl('https://www.amazon.com/dp/B0ABC123');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePrice', () => {
    it('should accept valid prices', () => {
      expect(validatePrice(99.99).valid).toBe(true);
      expect(validatePrice(0.01).valid).toBe(true);
      expect(validatePrice(10000).valid).toBe(true);
    });

    it('should reject negative prices', () => {
      const result = validatePrice(-10);
      expect(result.valid).toBe(false);
    });

    it('should reject zero prices', () => {
      const result = validatePrice(0);
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric values', () => {
      const result = validatePrice('abc');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateScrapedData', () => {
    it('should validate complete scraped data', () => {
      const data = {
        url: 'https://amazon.com/dp/B0ABC',
        site: 'Amazon',
        title: 'Test Product',
        price: 29.99,
        currency: 'USD'
      };
      const result = validateScrapedData(data);
      expect(result.valid).toBe(true);
    });

    it('should reject missing required fields', () => {
      const data = { url: 'https://amazon.com' };
      const result = validateScrapedData(data);
      expect(result.valid).toBe(false);
    });
  });
});
```

### Example: Testing Price Change Service

```javascript
// tests/unit/services/priceChangeService.test.js
import { describe, it, expect } from '@jest/globals';
import { 
  calculatePriceChange, 
  shouldAlert 
} from '../../../src/services/priceChangeService.js';

describe('priceChangeService', () => {
  describe('calculatePriceChange', () => {
    it('should calculate price decrease correctly', () => {
      const result = calculatePriceChange(100, 80);
      
      expect(result.absoluteChange).toBe(-20);
      expect(result.percentChange).toBe(-20);
      expect(result.direction).toBe('down');
    });

    it('should calculate price increase correctly', () => {
      const result = calculatePriceChange(100, 120);
      
      expect(result.absoluteChange).toBe(20);
      expect(result.percentChange).toBe(20);
      expect(result.direction).toBe('up');
    });

    it('should handle no change', () => {
      const result = calculatePriceChange(100, 100);
      
      expect(result.absoluteChange).toBe(0);
      expect(result.percentChange).toBe(0);
      expect(result.direction).toBe('none');
    });

    it('should handle null old price (new product)', () => {
      const result = calculatePriceChange(null, 50);
      
      expect(result.isNewPrice).toBe(true);
      expect(result.isSignificant).toBe(false);
    });

    it('should mark significant changes correctly', () => {
      // Default threshold: 5% and $1
      const smallChange = calculatePriceChange(100, 99);
      expect(smallChange.isSignificant).toBe(false);

      const bigChange = calculatePriceChange(100, 90);
      expect(bigChange.isSignificant).toBe(true);
    });
  });

  describe('shouldAlert', () => {
    it('should alert on significant price drop', () => {
      const change = {
        percentChange: -15,
        direction: 'down',
        isSignificant: true
      };
      
      const result = shouldAlert(change);
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toBe('price_drop');
    });

    it('should not alert on small changes', () => {
      const change = {
        percentChange: -3,
        direction: 'down',
        isSignificant: false
      };
      
      const result = shouldAlert(change);
      expect(result.shouldAlert).toBe(false);
    });
  });
});
```

---

## Integration Tests

### Test Database Setup

```javascript
// tests/setup/testDatabase.js
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool = null;

export async function setupTestDatabase() {
  pool = new pg.Pool({
    host: process.env.TEST_PG_HOST || 'localhost',
    port: process.env.TEST_PG_PORT || 5432,
    user: process.env.TEST_PG_USER || 'postgres',
    password: process.env.TEST_PG_PASSWORD || 'postgres',
    database: process.env.TEST_PG_DATABASE || 'price_tracker_test',
    max: 5
  });

  // Run migrations
  const migrationsDir = path.join(__dirname, '../../src/db/migrations');
  const files = fs.readdirSync(migrationsDir).sort();
  
  for (const file of files) {
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
    }
  }

  return pool;
}

export async function cleanupTestDatabase() {
  if (pool) {
    // Truncate all tables
    await pool.query(`
      TRUNCATE TABLE price_history CASCADE;
      TRUNCATE TABLE products CASCADE;
      TRUNCATE TABLE tracked_products CASCADE;
    `);
  }
}

export async function closeTestDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function getTestPool() {
  return pool;
}
```

### Example: Testing Product Repository

```javascript
// tests/integration/db/productRepository.test.js
import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  closeTestDatabase,
  getTestPool 
} from '../../setup/testDatabase.js';

// Mock the pool import
jest.mock('../../../src/db/connect-pg.js', () => ({
  pool: getTestPool()
}));

import { 
  upsertProductAndHistory, 
  getAllProductsWithLatestPrice,
  getPriceHistory 
} from '../../../src/db/productRepository.js';

describe('productRepository', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('upsertProductAndHistory', () => {
    it('should insert new product with price', async () => {
      const productId = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/TEST123',
        site: 'Amazon',
        title: 'Test Product',
        price: 99.99,
        currency: 'USD'
      });

      expect(productId).toBeDefined();
      expect(typeof productId).toBe('number');
    });

    it('should update existing product on conflict', async () => {
      // Insert first time
      const id1 = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/TEST123',
        site: 'Amazon',
        title: 'Original Title',
        price: 99.99
      });

      // Insert again with same URL
      const id2 = await upsertProductAndHistory({
        url: 'https://amazon.com/dp/TEST123',
        site: 'Amazon',
        title: 'Updated Title',
        price: 89.99
      });

      expect(id2).toBe(id1);

      // Should have 2 price history records
      const history = await getPriceHistory(id1);
      expect(history.length).toBe(2);
    });
  });

  describe('getAllProductsWithLatestPrice', () => {
    it('should return products with latest price', async () => {
      // Insert product with multiple prices
      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/TEST1',
        site: 'Amazon',
        title: 'Product 1',
        price: 100
      });

      await upsertProductAndHistory({
        url: 'https://amazon.com/dp/TEST1',
        site: 'Amazon',
        title: 'Product 1',
        price: 90  // Price dropped
      });

      const products = await getAllProductsWithLatestPrice();
      
      expect(products.length).toBe(1);
      expect(parseFloat(products[0].latest_price)).toBe(90);
    });
  });
});
```

### Example: Testing API Endpoints

```javascript
// tests/integration/api/products.test.js
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
```

---

## End-to-End Tests

### Example: Full Monitoring Cycle

```javascript
// tests/e2e/priceMonitor.test.js
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import nock from 'nock';

describe('Price Monitor E2E', () => {
  beforeAll(async () => {
    // Setup test database
    // Mock external HTTP requests
    nock.disableNetConnect();
    nock.enableNetConnect('localhost');
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  it('should complete full monitoring cycle', async () => {
    // This test would:
    // 1. Add a tracked product via API
    // 2. Mock the scraper response
    // 3. Run the price monitor
    // 4. Verify price was saved to database
    // 5. Verify price change was detected
  });
});
```

---

## Mocking Strategies

### Mock Browser Pool

```javascript
// tests/setup/mocks/browserPool.js
export const mockBrowserPool = {
  initialize: jest.fn().mockResolvedValue(undefined),
  acquire: jest.fn().mockResolvedValue({
    newContext: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn(),
        content: jest.fn(),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }),
  release: jest.fn(),
  closeAll: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    size: 3,
    currentInUse: 0
  })
};
```

### Mock Logger

```javascript
// tests/setup/mocks/logger.js
export default {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  child: jest.fn().mockReturnThis()
};
```

### Mock HTTP Responses with nock

```javascript
import nock from 'nock';

// Mock Amazon product page
nock('https://www.amazon.com')
  .get('/dp/B0ABC123')
  .reply(200, '<html><span id="productTitle">Test Product</span></html>');

// Mock Bing search
nock('https://www.bing.com')
  .get('/search')
  .query(true)
  .reply(200, '<html><!-- search results --></html>');
```

---

## Coverage Requirements

### Minimum Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Lines | 70% |
| Functions | 70% |
| Branches | 70% |
| Statements | 70% |

### Priority Modules for Coverage

1. **Critical (90%+ coverage):**
   - `src/utils/validation.js`
   - `src/services/priceChangeService.js`
   - `src/db/productRepository.js`

2. **High (80%+ coverage):**
   - `src/db/trackedProductsRepository.js`
   - `src/server/api-server.js`
   - `src/utils/rate-limiter.js`

3. **Medium (70%+ coverage):**
   - `src/services/retentionService.js`
   - `src/utils/retry.js`

4. **Skip coverage:**
   - `src/cli/*` (CLI scripts)
   - `src/index.js` (entry point)

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop/*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: price_tracker_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_PG_HOST: localhost
          TEST_PG_USER: postgres
          TEST_PG_PASSWORD: postgres
          TEST_PG_DATABASE: price_tracker_test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run with watch mode (development)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run specific test file
npm test -- tests/unit/utils/validation.test.js

# Run tests matching pattern
npm test -- --testNamePattern="price"

# Run with verbose output
npm test -- --verbose
```

### Test Database Setup

```bash
# Create test database (one time)
createdb price_tracker_test

# Or using Docker
docker run -d \
  --name postgres-test \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=price_tracker_test \
  -p 5433:5432 \
  postgres:15
```

---

## Best Practices

### Do's

✅ Write tests before or alongside code (TDD/BDD)
✅ Keep tests fast (unit tests < 10ms each)
✅ Use descriptive test names
✅ Test edge cases and error conditions
✅ Mock external dependencies in unit tests
✅ Use fixtures for test data
✅ Clean up after each test
✅ Run tests in CI/CD pipeline

### Don'ts

❌ Don't test implementation details
❌ Don't rely on test execution order
❌ Don't share state between tests
❌ Don't test external services in unit tests
❌ Don't skip tests without good reason
❌ Don't commit with failing tests

---

## Next Steps

1. Install test dependencies
2. Create `jest.config.js`
3. Create test setup files
4. Write unit tests for validation
5. Write unit tests for price change service
6. Set up test database
7. Write integration tests for repositories
8. Write API integration tests
9. Add coverage reporting
10. Set up CI/CD pipeline

---

**Last Updated:** November 29, 2025

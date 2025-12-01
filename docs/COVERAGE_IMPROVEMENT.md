# 📊 Test Coverage Improvement Guide

**Current Coverage:** 22.5%  
**Target Coverage:** 40%+  
**Last Updated:** November 30, 2025

---

## Current Coverage Breakdown

| Module | Coverage | Lines | Status |
|--------|----------|-------|--------|
| `delay.js` | 100% | 100% | ✅ Complete |
| `retry.js` | 95% | 94% | ✅ Excellent |
| `validation.js` | 93% | 94% | ✅ Excellent |
| `rate-limiter.js` | 73% | 79% | 🟡 Good |
| `metrics.js` | 77% | 77% | 🟡 Good |
| `useragents.js` | 76% | 76% | 🟡 Good |
| `product-matcher.js` | 64% | 67% | 🟡 Good |
| `logger.js` | 65% | 65% | 🟡 Good |
| `api-server.js` | 49% | 48% | 🟠 Moderate |
| `priceChangeService.js` | 45% | 45% | 🟠 Moderate |
| `trackedProductsRepository.js` | 19% | 19% | 🔴 Low |
| `connect-pg.js` | 17% | 17% | 🔴 Low |
| `config/index.js` | 15% | 15% | 🔴 Low |
| `exportService.js` | 13% | 13% | 🔴 Low |
| `retentionService.js` | 4% | 4% | 🔴 Low |
| `productRepository.js` | 0% | 0% | ❌ None |
| `amazon.js` | 0% | 0% | ❌ None |
| `burton.js` | 0% | 0% | ❌ None |
| `price-monitor.js` | 0% | 0% | ❌ None |
| `search-monitor.js` | 0% | 0% | ❌ None |
| `BrowserPool.js` | 0% | 0% | ❌ None |
| `fetch-page.js` | 0% | 0% | ❌ None |
| `proxy-manager.js` | 0% | 0% | ❌ None |
| `health-server.js` | 0% | 0% | ❌ None |
| `scrapeWorker.js` | 0% | 0% | ❌ None |

---

## 🎯 Quick Wins (Low Effort, High Impact)

### 1. product-matcher.js (67% → 90%)
**Effort:** Low  
**Impact:** +3% overall coverage

**Untested functions:**
- `levenshteinDistance(a, b)` - Pure function, easy to test
- `normalizeText(text)` - Pure function
- `tokenize(text)` - Pure function  
- `comparePrices(products)` - Pure function

**Example test:**
```javascript
import { comparePrices } from '../../../src/search/product-matcher.js';

describe('comparePrices', () => {
  it('should find lowest and highest prices', () => {
    const products = [
      { title: 'Product A', price: 99.99 },
      { title: 'Product B', price: 149.99 },
      { title: 'Product C', price: 79.99 },
    ];
    
    const result = comparePrices(products);
    
    expect(result.lowestPrice.price).toBe(79.99);
    expect(result.highestPrice.price).toBe(149.99);
    expect(result.priceRange).toBe(70);
  });
});
```

---

### 2. priceChangeService.js (45% → 70%)
**Effort:** Low  
**Impact:** +2% overall coverage

**Untested functions (lines 105-193):**
- `getPreviousPrice(productId)` - Needs DB mock
- `recordPriceChange(productId, oldPrice, newPrice)` - Needs DB mock
- `getRecentPriceChanges(productId, days)` - Needs DB mock

**Approach:** Create integration tests with test database

---

### 3. config/index.js (15% → 50%)
**Effort:** Low  
**Impact:** +2% overall coverage

**Untested code (lines 96-157):**
- `validateConfig()` - Test with various env combinations
- `validateConfigOrExit()` - Test error cases
- Config parsing logic

**Example test:**
```javascript
describe('config validation', () => {
  it('should validate required fields', () => {
    // Test with missing PG_USER
    // Test with missing PG_PASSWORD
    // Test with valid config
  });
});
```

---

### 4. validation.js (93% → 100%)
**Effort:** Very Low  
**Impact:** +0.5% overall coverage

**Uncovered lines:** 168-169, 175-176, 279-280, 302, 307, 314

Add edge case tests for remaining uncovered branches.

---

## 🔧 Medium Effort (Database Required)

### 5. productRepository.js (0% → 80%)
**Effort:** Medium  
**Impact:** +3% overall coverage

**Functions to test:**
- `saveProduct(data)`
- `getProductByUrl(url)`
- `updateProduct(id, data)`
- `getAllProducts(limit, offset)`
- `getProductWithHistory(id)`

**Approach:** Use test database like other integration tests

**Example:**
```javascript
// tests/integration/db/productRepository.test.js
import { saveProduct, getProductByUrl } from '../../../src/db/productRepository.js';

describe('productRepository', () => {
  it('should save and retrieve a product', async () => {
    const product = {
      url: 'https://amazon.com/dp/TEST123',
      title: 'Test Product',
      price: 99.99,
      site: 'Amazon'
    };
    
    await saveProduct(product);
    const retrieved = await getProductByUrl(product.url);
    
    expect(retrieved.title).toBe('Test Product');
  });
});
```

---

### 6. trackedProductsRepository.js (19% → 60%)
**Effort:** Medium  
**Impact:** +2% overall coverage

**Untested functions:**
- `updateProductCheckTime()`
- `setProductEnabled()`
- `deleteTrackedProduct()`
- Search-based tracking functions

---

### 7. retentionService.js (4% → 40%)
**Effort:** Medium  
**Impact:** +2% overall coverage

**Untested functions:**
- `cleanupOldPriceHistory()`
- `cleanupStaleProducts()`
- `runRetentionPolicy()`

---

### 8. db-retry.js (0% → 70%)
**Effort:** Medium  
**Impact:** +1% overall coverage

**Functions to test:**
- `withRetry()` - Test retry logic
- `isRetryableError()` - Test error classification

---

## 🚧 Hard (Requires Complex Mocking)

### 9. Scrapers (amazon.js, burton.js)
**Effort:** High  
**Impact:** +2% overall coverage

**Challenge:** Requires mocking Playwright

**Options:**
1. Use `jest.unstable_mockModule` (ESM support is tricky)
2. Extract pure functions and test those separately
3. Create integration tests against real pages (slow, flaky)

---

### 10. Monitors (price-monitor.js, search-monitor.js)
**Effort:** High  
**Impact:** +3% overall coverage

**Challenge:** Requires mocking both Playwright and database

---

### 11. BrowserPool.js
**Effort:** High  
**Impact:** +1% overall coverage

**Challenge:** Requires mocking Playwright's chromium.launch()

---

### 12. proxy-manager.js
**Effort:** High  
**Impact:** +2% overall coverage

**Challenge:** Requires mocking network requests

---

## 📈 Recommended Implementation Path

### Phase 1: Quick Wins (22.5% → 30%)
| Task | Coverage Gain | Time |
|------|---------------|------|
| Test product-matcher pure functions | +3% | 1 hour |
| Test config validation | +2% | 30 min |
| Complete validation.js coverage | +0.5% | 15 min |
| Test db-retry logic | +1% | 30 min |

**Subtotal: +6.5% → 29% coverage**

---

### Phase 2: Integration Tests (30% → 38%)
| Task | Coverage Gain | Time |
|------|---------------|------|
| productRepository integration tests | +3% | 2 hours |
| trackedProductsRepository tests | +2% | 1 hour |
| retentionService integration tests | +2% | 1 hour |
| priceChangeService DB tests | +1% | 1 hour |

**Subtotal: +8% → 38% coverage**

---

### Phase 3: Complex Mocking (38% → 50%)
| Task | Coverage Gain | Time |
|------|---------------|------|
| BrowserPool with Playwright mock | +1% | 3 hours |
| Scrapers with mock page | +2% | 4 hours |
| Monitors with full mocking | +3% | 6 hours |
| proxy-manager with network mock | +2% | 4 hours |

**Subtotal: +8% → 46% coverage**

---

## 🛠️ Testing Utilities Needed

### 1. Playwright Mock Helper
```javascript
// tests/setup/mocks/playwright.js
export const createMockPage = (responses = {}) => ({
  goto: jest.fn().mockResolvedValue(null),
  $: jest.fn().mockImplementation(selector => {
    if (responses[selector]) {
      return { innerText: () => responses[selector] };
    }
    return null;
  }),
  waitForSelector: jest.fn().mockResolvedValue(null),
  close: jest.fn().mockResolvedValue(null),
});
```

### 2. Database Test Helpers
Already exists in `tests/setup/testDatabase.js`

---

## 📋 Commands

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/search/product-matcher.test.js

# Run tests matching pattern
npm test -- --testPathPattern="product"

# Watch mode for development
npm run test:watch
```

---

## 🎯 Coverage Goals

| Milestone | Target | Status |
|-----------|--------|--------|
| MVP | 15% | ✅ Achieved |
| Good | 30% | ⏳ In Progress |
| Better | 50% | 🎯 Goal |
| Excellent | 70% | 🚀 Stretch |

---

## Notes

1. **ES Module Mocking**: Jest's ESM support is experimental. Use `jest.unstable_mockModule` before imports, or restructure code to inject dependencies.

2. **Integration vs Unit**: For database-heavy code, integration tests with a real test DB are more reliable than complex mocks.

3. **Playwright Mocking**: Consider extracting scraping logic into testable pure functions rather than mocking Playwright.

4. **Priority**: Focus on business logic (price change detection, product matching) over infrastructure code (browser pool, proxy manager).

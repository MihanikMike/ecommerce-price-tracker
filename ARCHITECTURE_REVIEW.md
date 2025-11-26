# 🏗️ SENIOR ARCHITECT CODE REVIEW & REFACTORING PLAN

**Project:** E-Commerce Price Tracker  
**Phase:** 5 (PostgreSQL Migration)  
**Review Date:** November 26, 2025  
**Reviewer:** Senior Software Architect

---

## 📋 EXECUTIVE SUMMARY

**Critical Issues Found:** 12  
**Major Issues:** 18  
**Minor Issues:** 15  
**Architecture Debt:** High  
**Security Risk Level:** Medium-High  
**Scalability Score:** 3/10  

**Overall Assessment:** The project is in a transitional state between MongoDB and PostgreSQL with significant architectural issues, mixed patterns, incomplete migration, and no proper error handling or logging infrastructure.

---

## 🔴 CRITICAL ISSUES

### 1. **DUAL DATABASE ARCHITECTURE (CRITICAL)**
**Files:** `src/monitor/price-monitor.js`, `src/db/connect-mongo.js`, `src/db/connect-pg.js`

**Problem:**
- The project uses BOTH MongoDB and PostgreSQL simultaneously
- `price-monitor.js` uses MongoDB but PostgreSQL infrastructure exists
- No clear migration path or data consistency strategy
- Two connection pools running in parallel (resource leak)

**Impact:** Data inconsistency, resource waste, confusion, maintenance nightmare

**Fix:**
```javascript
// CURRENT (WRONG):
import { connectDB, closeDB } from "../db/connect-mongo.js"; // ❌ MongoDB
// BUT: PostgreSQL infrastructure exists with productRepository.js

// SHOULD BE:
import { connectDB, closeDB } from "../db/connect-pg.js";
import * as productRepo from "../db/productRepository.js";
```

---

### 2. **MISSING ENTRY POINT (CRITICAL)**
**File:** `src/index.js` (EMPTY!)

**Problem:**
- Main entry point is completely empty
- Application cannot start
- No orchestration logic

**Fix Required:** Create proper application bootstrap

---

### 3. **BROKEN IMPORTS IN MONITOR (CRITICAL)**
**File:** `src/monitor/price-monitor.js:2`

```javascript
import { ProductModel } from "../db/models/Product.js"; // ❌ File doesn't exist!
```

**Problem:**
- Imports non-existent MongoDB model
- Directory `src/db/models/` doesn't exist
- Application will crash on startup

---

### 4. **MISSING DEPENDENCY (CRITICAL)**
**File:** `src/utils/logger.js`

```javascript
import pino from "pino"; // ❌ Not in package.json!
```

**Problem:**
- `pino` is imported but not installed
- Application will crash when logger is used

**Fix:**
```bash
npm install pino pino-pretty
```

---

### 5. **WRONG IMPORT PATH IN REPOSITORY (CRITICAL)**
**File:** `src/db/productRepository.js:1`

```javascript
import { pool } from "./connect.js"; // ❌ Wrong! File is connect-pg.js
```

**Problem:**
- Import points to non-existent file
- Should be `./connect-pg.js`

---

### 6. **HARDCODED URLS IN BUSINESS LOGIC (MAJOR)**
**File:** `src/monitor/price-monitor.js:12-16`

**Problem:**
- Product URLs hardcoded in monitoring logic
- No configuration, no database source
- Cannot scale or manage products dynamically

**Should be:** Load from database or configuration

---

### 7. **SYNCHRONOUS FILE I/O IN ASYNC FUNCTION (MAJOR)**
**File:** `src/monitor/price-monitor.js:39-43`

```javascript
fs.writeFileSync("products.json", ...); // ❌ Blocks event loop!
```

**Impact:** Blocks entire Node.js event loop during JSON export

**Fix:**
```javascript
await fs.promises.writeFile("products.json", JSON.stringify(allProducts, null, 2));
```

---

### 8. **SQL INJECTION VULNERABILITY (CRITICAL SECURITY)**
**File:** `src/db/productRepository.js:4-7`

**Current code looks safe (uses parameterized queries) BUT:**

The function signature is wrong:
```javascript
export async function saveProductHistory(url, data) {
    await pool.query(
        `INSERT INTO products (url, title, price, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [url, data.title, data.price] // ✅ Parameterized
    );
}
```

**Problems:**
1. Function name doesn't match schema (saves to `products` not `price_history`)
2. Doesn't match schema structure (missing `product_id`, `currency`)
3. No transaction handling
4. No duplicate URL handling

---

### 9. **MISSING ERROR HANDLING IN SCRAPERS (MAJOR)**
**Files:** `src/scraper/amazon.js`, `src/scraper/burton.js`

**Problems:**
- Catch blocks only log errors, don't propagate or handle properly
- No retry logic
- No circuit breaker for repeated failures
- Browser resources may leak on errors

---

### 10. **CONFIGURATION WITHOUT FALLBACKS (MAJOR)**
**File:** `src/config/index.js`

```javascript
export default {
  port: process.env.PORT || 3000, // ✅ Has fallback
  pg: {
    host: process.env.PG_HOST,    // ❌ No fallback!
    port: process.env.PG_PORT,    // ❌ No fallback!
    // ... all PG config has no fallbacks
  },
  logLevel: process.env.LOG_LEVEL, // ❌ No fallback!
  userAgentsFile: process.env.USER_AGENTS, // ❌ No fallback!
};
```

**Impact:** Application crashes if .env is missing or incomplete

---

### 11. **BROWSER NOT IN HEADLESS MODE (SECURITY/PERFORMANCE)**
**File:** `src/utils/fetch-page.js:18`

```javascript
const browser = await chromium.launch({
    headless: false, // ❌ Opens visible browser!
    slowMo: 50,
});
```

**Problems:**
- Cannot run in Docker/production without display
- Massive performance overhead
- Comment says it's "less detectable" (not true, and not needed)

---

### 12. **NO CONNECTION POOLING STRATEGY (PERFORMANCE)**
**File:** `src/db/connect-pg.js`

**Problems:**
- Pool created at module level (good)
- But no max connections limit specified
- No connection timeout configured
- No idle timeout
- No error handling on pool level

---

## 🟡 MAJOR ARCHITECTURAL ISSUES

### 13. **INCOMPLETE MIGRATION STATE**
**Evidence:** Mixed MongoDB and PostgreSQL code, productService uses PG but monitor uses Mongo

**Required Actions:**
1. Complete PostgreSQL migration
2. Remove all MongoDB code
3. Update all business logic to use PG repositories

---

### 14. **NO SEPARATION OF CONCERNS**
**File:** `src/monitor/price-monitor.js`

**Problems:**
- Orchestration + scraping logic + data persistence + file export all in one function
- Violates Single Responsibility Principle
- Hard to test, maintain, scale

**Should be separated into:**
- Orchestrator service
- Scraping service  
- Data persistence service
- Export service

---

### 15. **NO DEPENDENCY INJECTION**

All modules import dependencies directly:
```javascript
import { pool } from "./connect-pg.js"; // ❌ Tight coupling
```

**Impact:** Hard to test, hard to swap implementations

**Should use:** Constructor/function injection pattern

---

### 16. **MISSING DTOs/INTERFACES**

No data transfer objects or type definitions:
```javascript
return {
    site: "Amazon",
    url,
    title,
    price: parseFloat(price),
    timestamp: new Date()
}; // ❌ No type safety
```

**Should have:**
```typescript
interface ProductData {
    site: string;
    url: string;
    title: string;
    price: number;
    currency: string;
    timestamp: Date;
}
```

---

### 17. **NO VALIDATION LAYER**

Data from scrapers is directly inserted to DB:
- No price validation (could be NaN, negative, etc.)
- No URL validation
- No title sanitization
- No length checks

---

### 18. **NO RETRY MECHANISM**
**File:** `src/utils/retry.js` (EMPTY!)

Scraping operations fail without retries:
- Network errors should retry with exponential backoff
- Selector not found should retry with different strategy
- Empty retry.js indicates planned but not implemented

---

### 19. **WORKER FILE EMPTY**
**File:** `src/workers/scrapeWorker.js` (EMPTY!)

Indicates planned worker architecture but not implemented

---

### 20. **EXPORT SERVICE EMPTY**
**File:** `src/services/exportServive.js` (EMPTY + TYPO IN NAME!)

File name has typo: `exportServive` → `exportService`

---

### 21. **NO LOGGER USAGE**

Logger exists but not used anywhere:
```javascript
// logger.js exists
console.log("Saved: ", data.title, "$" + data.price); // ❌ Still using console.log
console.error("Burton scraper error:", err); // ❌ Should use logger
```

---

### 22. **ANTI-BOT DETECTION OVERKILL**
**File:** `src/utils/fetch-page.js:35-50`

```javascript
// Random delays, scrolling, mouse movements
await page.mouse.move(Math.random() * 1000, Math.random() * 800, { steps: 5 });
await page.waitForTimeout(Math.random() * 1000 + 500);
```

**Problems:**
- Adds 5-10 seconds per page load
- Not needed for most sites
- Should be configurable per site
- Should use stealth plugin instead

**Better approach:**
```javascript
npm install playwright-extra playwright-extra-plugin-stealth
```

---

### 23. **NO GRACEFUL SHUTDOWN**

No signal handlers for SIGTERM/SIGINT:
- Database connections won't close properly
- Browser instances may leak
- In-progress scrapes will be interrupted

---

### 24. **NO RATE LIMITING**

```javascript
for (const url of bindingsUrls) {
    data = await scrapeAmazon(url); // ❌ No delay between requests!
}
```

Will trigger rate limits and blocks

---

### 25. **NO HEALTH CHECKS**

No endpoints or logic for:
- Database health
- Browser availability
- Service status
- Readiness probes

---

## 🟢 CODE QUALITY ISSUES

### 26. **INCONSISTENT ERROR HANDLING**

Mix of patterns:
```javascript
// Pattern 1: Return null
return null;

// Pattern 2: Log and continue  
console.error("Error:", err);

// Pattern 3: Throw (in productService)
throw e;
```

Need unified error handling strategy

---

### 27. **NO INPUT VALIDATION**

```javascript
export async function fetchPage(url, options = {}) {
    // ❌ No validation that url is valid
    await page.goto(url, ...);
}
```

---

### 28. **MAGIC NUMBERS EVERYWHERE**

```javascript
await page.waitForSelector("#productTitle", { timeout: 15000}); // Why 15000?
slowMo: 50, // Why 50?
minDelay: 1200, // Why 1200?
```

Should use named constants

---

### 29. **MIXED COMMENT LANGUAGES**

```javascript
// English comments
await page.waitForSelector("h1.product-name"); // селектор заголовка — пример
// Russian comments  
// селектор цены 
```

Pick one language (preferably English for international projects)

---

### 30. **NO UNIT TESTS**

`package.json` shows:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

Zero test coverage

---

### 31. **EMPTY DOCKER FILES**

Both `Dockerfile` and `docker-compose.yml` are empty but exist

---

### 32. **CREDENTIALS IN .ENV TRACKED**

`.env` file is in the repository with actual credentials:
```
PG_USER=mike228
PG_PASSWORD=12345678
```

**SECURITY RISK:** Should be in `.gitignore`

---

### 33. **NO API/SERVICE LAYER**

Direct access to repositories from monitor:
```javascript
await Products.updateOne(...); // ❌ Business logic calling DB directly
```

---

### 34. **USERAGENTS FILE READING ON EVERY IMPORT**
**File:** `src/utils/useragents.js:2`

```javascript
const agents = fs.readFileSync("./data/useragents.txt","utf8")...
```

File is read synchronously every time module is imported. Should be lazy-loaded or cached properly.

---

### 35. **NO MONITORING/METRICS**

No instrumentation for:
- Scraping success/failure rates
- Response times
- Database query performance
- Error rates

---

### 36. **INCONSISTENT NAMING**

- `connect-mongo.js` vs `connect-pg.js` (good)
- `exportServive.js` (typo!)
- `price-monitor.js` vs `productService.js` (inconsistent naming pattern)

---

### 37. **NO DOCUMENTATION**

No JSDoc comments, no type hints, no inline documentation for complex logic

---

### 38. **TRANSACTION NOT PROPERLY ISOLATED**
**File:** `src/services/productService.js:3-20`

```javascript
const client = await pool.connect();
try {
    await client.query("BEGIN");
    // ... operations
    await client.query("COMMIT");
} catch (e) {
    await client.query("ROLLBACK");
    throw e; // ✅ Good!
} finally {
    client.release(); // ✅ Good!
}
```

**Good aspects:** Transaction handling, client release

**Issues:**
1. No transaction isolation level specified
2. No deadlock retry logic
3. Function not imported/used anywhere (missing in productRepository)

---

### 39. **PROXY CONFIGURATION INCOMPLETE**
**File:** `src/utils/fetch-page.js:4-7`

```javascript
const PROXIES = [
    // "http://username:password@ip:port",
];
```

Proxy infrastructure exists but:
- Empty array (not used)
- Hardcoded in code (should be config)
- No rotation strategy
- No health checking

---

### 40. **NO SCRAPER INTERFACE**

Each scraper implements different patterns:
- Should have base class or interface
- Should share common logic (error handling, retry, etc.)

---

## 📊 DATABASE ISSUES

### 41. **SCHEMA MISMATCH BETWEEN FILES**

**Migration:** `products` table has columns: `id, url, site, title, created_at, last_seen_at`

**productRepository.js:** Inserts `url, title, price, created_at` (missing `price` column!)

**productService.js:** Works with correct schema

**Impact:** Data inconsistency

---

### 42. **NO MIGRATION MANAGEMENT**

- Single migration file `001_init.sql`
- No version tracking
- No rollback capability
- Manual execution required

**Should use:** node-pg-migrate, db-migrate, or similar

---

### 43. **MISSING INDEXES**

Only basic indexes exist:
```sql
CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
```

**Missing:**
- Index on `price_history.captured_at` (for time-series queries)
- Composite index on `(product_id, captured_at DESC)` (for latest price)
- Index on `products.site` (if filtering by site)
- Index on `products.last_seen_at` (for finding stale products)

---

### 44. **NO DATA RETENTION POLICY**

Price history grows forever:
- No partitioning strategy
- No archival process
- Will cause performance degradation

---

### 45. **NUMERIC PRECISION MAY BE INSUFFICIENT**

```sql
price NUMERIC(10,2)
```

Max value: $99,999,999.99

May be insufficient for:
- Luxury goods
- Bulk orders  
- Different currencies (JPY, KRW have no decimals)

---

## 🏗️ PROPOSED ARCHITECTURE

### New Project Structure

```
ecommerce-price-tracker/
├── src/
│   ├── index.js                          # Application entry point
│   ├── app.js                            # Express app (if adding API)
│   │
│   ├── config/
│   │   ├── index.js                      # Main config
│   │   ├── database.js                   # DB-specific config
│   │   ├── scraper.js                    # Scraper config
│   │   └── constants.js                  # App constants
│   │
│   ├── core/
│   │   ├── database/
│   │   │   ├── connection.js             # DB connection pool
│   │   │   ├── transaction.js            # Transaction helper
│   │   │   └── health.js                 # DB health check
│   │   │
│   │   ├── logger/
│   │   │   ├── index.js                  # Logger factory
│   │   │   └── transports.js             # Log transports
│   │   │
│   │   └── errors/
│   │       ├── AppError.js               # Base error class
│   │       ├── ScraperError.js
│   │       ├── DatabaseError.js
│   │       └── ValidationError.js
│   │
│   ├── domain/
│   │   ├── product/
│   │   │   ├── Product.entity.js         # Product domain entity
│   │   │   ├── PriceHistory.entity.js
│   │   │   ├── product.repository.js     # Repository interface
│   │   │   ├── product.service.js        # Business logic
│   │   │   └── product.validator.js      # Validation logic
│   │   │
│   │   └── scraper/
│   │       ├── Scraper.interface.js      # Base scraper interface
│   │       ├── scraper.service.js        # Scraper orchestration
│   │       └── scraper.factory.js        # Scraper factory
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── postgres/
│   │   │   │   ├── PostgresConnection.js
│   │   │   │   ├── ProductRepository.js  # PG implementation
│   │   │   │   └── migrations/
│   │   │   │       ├── 001_init.sql
│   │   │   │       ├── 002_add_indexes.sql
│   │   │   │       └── 003_add_currency.sql
│   │   │   │
│   │   │   └── migrations.js             # Migration runner
│   │   │
│   │   ├── scrapers/
│   │   │   ├── amazon/
│   │   │   │   ├── AmazonScraper.js
│   │   │   │   ├── selectors.js          # CSS selectors
│   │   │   │   └── config.js             # Amazon-specific config
│   │   │   │
│   │   │   ├── burton/
│   │   │   │   ├── BurtonScraper.js
│   │   │   │   ├── selectors.js
│   │   │   │   └── config.js
│   │   │   │
│   │   │   └── base/
│   │   │       ├── BaseScraper.js        # Abstract base class
│   │   │       ├── BrowserManager.js     # Browser pool management
│   │   │       └── AntiBot.js            # Anti-detection logic
│   │   │
│   │   ├── http/
│   │   │   ├── routes/
│   │   │   │   ├── health.routes.js
│   │   │   │   ├── products.routes.js
│   │   │   │   └── scraper.routes.js
│   │   │   │
│   │   │   ├── controllers/
│   │   │   │   ├── health.controller.js
│   │   │   │   ├── products.controller.js
│   │   │   │   └── scraper.controller.js
│   │   │   │
│   │   │   └── middleware/
│   │   │       ├── errorHandler.js
│   │   │       ├── validation.js
│   │   │       └── rateLimiter.js
│   │   │
│   │   └── queue/                        # For future job queue
│   │       ├── QueueManager.js
│   │       └── workers/
│   │           └── scrapeWorker.js
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── ScrapeProduct.usecase.js
│   │   │   ├── GetPriceHistory.usecase.js
│   │   │   ├── ExportProducts.usecase.js
│   │   │   └── MonitorPrices.usecase.js
│   │   │
│   │   └── dto/
│   │       ├── ProductDTO.js
│   │       ├── PriceHistoryDTO.js
│   │       └── ScraperResultDTO.js
│   │
│   ├── shared/
│   │   ├── utils/
│   │   │   ├── retry.js                  # Retry logic with backoff
│   │   │   ├── sleep.js                  # Delay helper
│   │   │   ├── validation.js             # Common validators
│   │   │   └── currency.js               # Currency helpers
│   │   │
│   │   ├── constants/
│   │   │   ├── timeouts.js
│   │   │   ├── errors.js
│   │   │   └── patterns.js
│   │   │
│   │   └── types/
│   │       └── index.js                  # Type definitions (if using TS)
│   │
│   └── cli/
│       ├── commands/
│       │   ├── migrate.js
│       │   ├── scrape.js
│       │   └── export.js
│       └── index.js
│
├── tests/
│   ├── unit/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   └── application/
│   │
│   ├── integration/
│   │   ├── database/
│   │   └── scrapers/
│   │
│   └── e2e/
│       └── scraping.test.js
│
├── config/
│   ├── .env.example
│   ├── .env.development
│   ├── .env.production
│   └── .env.test
│
├── data/
│   ├── useragents.txt
│   └── proxies.txt
│
├── scripts/
│   ├── setup.sh
│   ├── migrate.sh
│   └── seed.js
│
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── docker-compose.yml
│
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── SCRAPING_GUIDE.md
│   └── DEPLOYMENT.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── jest.config.js
├── package.json
├── README.md
└── CHANGELOG.md
```

---

## 🔧 REFACTORING PLAN

### Phase 6A: Critical Fixes (Week 1)

**Priority: CRITICAL - Cannot proceed without these**

1. **Fix Entry Point**
   - [ ] Create proper `src/index.js` with application bootstrap
   - [ ] Add graceful shutdown handlers
   - [ ] Add error boundaries

2. **Complete Database Migration**
   - [ ] Remove all MongoDB code (`connect-mongo.js`, `Product.js` model)
   - [ ] Fix import paths (connect.js → connect-pg.js)
   - [ ] Update `price-monitor.js` to use PostgreSQL
   - [ ] Fix schema mismatch in productRepository

3. **Install Missing Dependencies**
   - [ ] `npm install pino pino-pretty`
   - [ ] `npm install dotenv` (if not already installed)
   - [ ] `npm install express` (for future API)

4. **Fix Configuration**
   - [ ] Add fallback values to all config properties
   - [ ] Create `.env.example`
   - [ ] Add `.env` to `.gitignore`
   - [ ] Remove credentials from repository

5. **Fix Critical Bugs**
   - [ ] Fix ProductModel import
   - [ ] Fix productRepository import path
   - [ ] Fix synchronous file I/O
   - [ ] Set headless: true in production

---

### Phase 6B: Architecture Improvements (Week 2)

**Priority: HIGH - Required for scalability**

1. **Implement Proper Error Handling**
   - [ ] Create error class hierarchy
   - [ ] Add global error handler
   - [ ] Replace all console.log with logger
   - [ ] Add error tracking (Sentry/DataDog)

2. **Implement Retry Logic**
   - [ ] Create retry utility with exponential backoff
   - [ ] Add to all scraper operations
   - [ ] Add circuit breaker pattern
   - [ ] Configure max retries per site

3. **Create Service Layer**
   - [ ] ProductService (business logic)
   - [ ] ScraperService (orchestration)
   - [ ] ExportService (data export)
   - [ ] Separate concerns from monitor

4. **Implement DTOs**
   - [ ] ProductDTO
   - [ ] PriceHistoryDTO
   - [ ] ScraperResultDTO
   - [ ] Add validation with joi/zod

5. **Fix Database Layer**
   - [ ] Complete productRepository implementation
   - [ ] Add transaction helper
   - [ ] Add connection pool configuration
   - [ ] Add database health checks

---

### Phase 6C: Scraper Improvements (Week 3)

**Priority: HIGH - Core functionality**

1. **Create Scraper Architecture**
   - [ ] BaseScraper abstract class
   - [ ] ScraperFactory
   - [ ] Scraper interface/contract
   - [ ] Move common logic to base

2. **Improve Anti-Detection**
   - [ ] Install playwright-extra-plugin-stealth
   - [ ] Make anti-bot measures configurable
   - [ ] Add per-site configuration
   - [ ] Remove unnecessary delays

3. **Add Rate Limiting**
   - [ ] Implement per-site rate limiter
   - [ ] Add configurable delays
   - [ ] Add request throttling
   - [ ] Add cooldown periods

4. **Browser Management**
   - [ ] Create BrowserPool class
   - [ ] Reuse browser contexts
   - [ ] Add browser health checks
   - [ ] Implement graceful browser shutdown

5. **Selector Management**
   - [ ] Move selectors to config files
   - [ ] Add selector fallbacks
   - [ ] Implement selector testing
   - [ ] Add selector versioning

---

### Phase 6D: Monitoring & Observability (Week 4)

**Priority: MEDIUM - Required for production**

1. **Logging Infrastructure**
   - [ ] Implement structured logging
   - [ ] Add log levels everywhere
   - [ ] Add request correlation IDs
   - [ ] Set up log aggregation

2. **Metrics & Monitoring**
   - [ ] Add Prometheus metrics
   - [ ] Track scrape success/failure rates
   - [ ] Track response times
   - [ ] Track database performance

3. **Health Checks**
   - [ ] Database health endpoint
   - [ ] Browser availability check
   - [ ] Disk space check
   - [ ] Memory usage check

4. **Alerting**
   - [ ] Set up alerts for failures
   - [ ] Alert on high error rates
   - [ ] Alert on stale data
   - [ ] Alert on resource exhaustion

---

### Phase 7: Testing & Documentation (Week 5-6)

**Priority: MEDIUM - Required before production**

1. **Unit Tests**
   - [ ] Test all business logic
   - [ ] Test validators
   - [ ] Test DTOs
   - [ ] Target 80% coverage

2. **Integration Tests**
   - [ ] Test database operations
   - [ ] Test scraper operations
   - [ ] Test with real sites (mocked responses)

3. **E2E Tests**
   - [ ] Full scraping workflow
   - [ ] Data consistency tests
   - [ ] Error handling tests

4. **Documentation**
   - [ ] API documentation
   - [ ] Architecture documentation
   - [ ] Deployment guide
   - [ ] Scraping guide

---

### Phase 8: Production Readiness (Week 7-8)

**Priority: MEDIUM - Required for deployment**

1. **Docker & Deployment**
   - [ ] Create proper Dockerfile
   - [ ] Create docker-compose.yml
   - [ ] Add multi-stage builds
   - [ ] Add health checks to containers

2. **CI/CD**
   - [ ] GitHub Actions for testing
   - [ ] Automated deployments
   - [ ] Database migration automation

3. **Security Hardening**
   - [ ] Security audit
   - [ ] Dependency vulnerability scan
   - [ ] Add rate limiting to API
   - [ ] Add authentication if needed

4. **Performance Optimization**
   - [ ] Database query optimization
   - [ ] Add caching layer (Redis)
   - [ ] Optimize scraper concurrency
   - [ ] Load testing

---

### Phase 9: Advanced Features (Future)

**Priority: LOW - Nice to have**

1. **Job Queue System**
   - [ ] Implement Bull/BullMQ
   - [ ] Move scraping to workers
   - [ ] Add job scheduling
   - [ ] Add job monitoring dashboard

2. **API Layer**
   - [ ] REST API for products
   - [ ] GraphQL API (optional)
   - [ ] WebSocket for real-time updates
   - [ ] API documentation with Swagger

3. **Advanced Analytics**
   - [ ] Price trend analysis
   - [ ] Price prediction models
   - [ ] Alert on price drops
   - [ ] Email/SMS notifications

4. **Multi-tenancy**
   - [ ] Support multiple users
   - [ ] User authentication
   - [ ] User-specific product lists
   - [ ] Usage limits and billing

---

## 📝 IMMEDIATE TODO LIST (Next 7 Days)

### Day 1: Critical Bug Fixes
- [ ] Create `src/index.js` entry point
- [ ] Install pino: `npm install pino pino-pretty`
- [ ] Add dotenv to package.json if missing
- [ ] Add `.env` to `.gitignore`
- [ ] Remove MongoDB dependencies from price-monitor.js
- [ ] Delete `src/db/connect-mongo.js`
- [ ] Fix import path in productRepository.js

### Day 2: Database Fixes
- [ ] Fix productRepository schema mismatch
- [ ] Add proper pool configuration to connect-pg.js
- [ ] Update migration to match actual needs
- [ ] Add missing database indexes
- [ ] Create migration management script

### Day 3: Configuration & Error Handling
- [ ] Add fallback values to all config
- [ ] Create `.env.example`
- [ ] Create error class hierarchy
- [ ] Replace all console.log with logger
- [ ] Add global error handler

### Day 4: Refactor Price Monitor
- [ ] Split price-monitor.js into services
- [ ] Move URLs to database or config
- [ ] Fix synchronous file I/O
- [ ] Add proper transaction handling
- [ ] Add validation layer

### Day 5: Scraper Improvements
- [ ] Create BaseScraper class
- [ ] Implement retry logic
- [ ] Add rate limiting
- [ ] Set headless: true
- [ ] Move selectors to config

### Day 6: Testing Setup
- [ ] Install Jest: `npm install -D jest`
- [ ] Create test structure
- [ ] Write first unit tests
- [ ] Set up test database

### Day 7: Documentation
- [ ] Update README.md
- [ ] Document new architecture
- [ ] Create CONTRIBUTING.md
- [ ] Add code comments
- [ ] Create .env.example with docs

---

## 🎯 CODE EXAMPLES FOR IMMEDIATE FIXES

### 1. Proper `src/index.js` Entry Point

```javascript
import logger from './utils/logger.js';
import config from './config/index.js';
import { runMigrations } from './db/connect-pg.js';
import { runPriceMonitor } from './monitor/price-monitor.js';

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    try {
        // Close database connections
        const { pool } = await import('./db/connect-pg.js');
        await pool.end();
        logger.info('Database connections closed');

        process.exit(0);
    } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
    }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection');
    process.exit(1);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught Exception');
    process.exit(1);
});

// Main application
async function main() {
    try {
        logger.info('Starting E-Commerce Price Tracker...');
        logger.info({ config }, 'Configuration loaded');

        // Run migrations
        logger.info('Running database migrations...');
        await runMigrations();
        logger.info('Migrations completed');

        // Start monitoring
        logger.info('Starting price monitoring...');
        await runPriceMonitor();
        logger.info('Price monitoring completed');

    } catch (error) {
        logger.error({ error }, 'Application error');
        process.exit(1);
    }
}

// Start the application
main();
```

---

### 2. Fixed `src/config/index.js`

```javascript
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['PG_HOST', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const config = {
    // Application
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    
    // PostgreSQL
    pg: {
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT, 10) || 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
        max: parseInt(process.env.PG_POOL_MAX, 10) || 20,
        idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT, 10) || 30000,
        connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT, 10) || 10000,
    },
    
    // Scraper
    scraper: {
        retries: parseInt(process.env.SCRAPER_RETRIES, 10) || 3,
        minDelay: parseInt(process.env.SCRAPER_MIN_DELAY, 10) || 1200,
        maxDelay: parseInt(process.env.SCRAPER_MAX_DELAY, 10) || 2500,
        timeout: parseInt(process.env.SCRAPER_TIMEOUT, 10) || 30000,
        headless: process.env.SCRAPER_HEADLESS !== 'false',
        useProxy: process.env.SCRAPER_USE_PROXY === 'true',
    },
    
    // Logging
    log: {
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: process.env.NODE_ENV === 'development',
    },
    
    // Paths
    paths: {
        userAgents: process.env.USER_AGENTS_FILE || path.join(__dirname, '../../data/useragents.txt'),
        exports: process.env.EXPORTS_DIR || path.join(__dirname, '../../exports'),
    },
};

// Freeze config to prevent modifications
Object.freeze(config);
Object.freeze(config.pg);
Object.freeze(config.scraper);
Object.freeze(config.log);
Object.freeze(config.paths);

export default config;
```

---

### 3. Fixed `src/db/connect-pg.js`

```javascript
import pkg from "pg";
const { Pool } = pkg;
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create connection pool
export const pool = new Pool({
    host: config.pg.host,
    port: config.pg.port,
    database: config.pg.database,
    user: config.pg.user,
    password: config.pg.password,
    max: config.pg.max,
    idleTimeoutMillis: config.pg.idleTimeoutMillis,
    connectionTimeoutMillis: config.pg.connectionTimeoutMillis,
});

// Pool error handler
pool.on('error', (err) => {
    logger.error({ error: err }, 'Unexpected error on idle PostgreSQL client');
});

// Pool connect event
pool.on('connect', () => {
    logger.debug('New PostgreSQL client connected');
});

// Pool remove event
pool.on('remove', () => {
    logger.debug('PostgreSQL client removed from pool');
});

// Health check function
export async function checkDatabaseHealth() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        return { healthy: true, timestamp: result.rows[0].now };
    } catch (error) {
        logger.error({ error }, 'Database health check failed');
        return { healthy: false, error: error.message };
    }
}

// Migration runner
export async function runMigrations() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create migrations tracking table
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `);
        
        // Get executed migrations
        const { rows: executedMigrations } = await client.query(
            'SELECT version FROM schema_migrations ORDER BY version'
        );
        const executedVersions = new Set(executedMigrations.map(m => m.version));
        
        // Load migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const migrationFiles = [
            '001_init.sql',
            // Add more migration files here
        ];
        
        // Execute pending migrations
        for (const file of migrationFiles) {
            const version = file.replace('.sql', '');
            
            if (executedVersions.has(version)) {
                logger.info({ version }, 'Migration already executed, skipping');
                continue;
            }
            
            logger.info({ version }, 'Running migration');
            const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            
            // Record migration
            await client.query(
                'INSERT INTO schema_migrations (version) VALUES ($1)',
                [version]
            );
            
            logger.info({ version }, 'Migration completed');
        }
        
        await client.query('COMMIT');
        logger.info('All migrations completed successfully');
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error }, 'Migration failed, rolling back');
        throw error;
    } finally {
        client.release();
    }
}

// Graceful shutdown
export async function closeDatabaseConnection() {
    await pool.end();
    logger.info('Database connection pool closed');
}
```

---

### 4. Fixed `src/db/productRepository.js`

```javascript
import { pool } from "./connect-pg.js";
import logger from "../utils/logger.js";

/**
 * Insert or update product and add price history entry
 * @param {Object} data - Product data
 * @param {string} data.url - Product URL
 * @param {string} data.site - Site name (Amazon, Burton, etc)
 * @param {string} data.title - Product title
 * @param {number} data.price - Product price
 * @param {string} data.currency - Currency code (default: USD)
 * @returns {Promise<number>} Product ID
 */
export async function upsertProductAndHistory({ url, site, title, price, currency = 'USD' }) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Insert or update product
        const productResult = await client.query(
            `INSERT INTO products (url, site, title, last_seen_at) 
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (url) 
             DO UPDATE SET 
                title = EXCLUDED.title,
                site = EXCLUDED.site,
                last_seen_at = NOW()
             RETURNING id`,
            [url, site, title]
        );
        
        const productId = productResult.rows[0].id;
        
        // Insert price history
        await client.query(
            `INSERT INTO price_history (product_id, price, currency, captured_at) 
             VALUES ($1, $2, $3, NOW())`,
            [productId, price, currency]
        );
        
        await client.query('COMMIT');
        
        logger.info({ productId, url, price }, 'Product and price history saved');
        
        return productId;
        
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error({ error, url }, 'Failed to save product');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get product by URL
 */
export async function getProductByUrl(url) {
    const result = await pool.query(
        `SELECT * FROM products WHERE url = $1`,
        [url]
    );
    return result.rows[0];
}

/**
 * Get price history for a product
 */
export async function getPriceHistory(productId, limit = 100) {
    const result = await pool.query(
        `SELECT * FROM price_history 
         WHERE product_id = $1 
         ORDER BY captured_at DESC 
         LIMIT $2`,
        [productId, limit]
    );
    return result.rows;
}

/**
 * Get all products with latest price
 */
export async function getAllProductsWithLatestPrice() {
    const result = await pool.query(`
        SELECT 
            p.*,
            ph.price as latest_price,
            ph.currency,
            ph.captured_at as price_captured_at
        FROM products p
        LEFT JOIN LATERAL (
            SELECT price, currency, captured_at
            FROM price_history
            WHERE product_id = p.id
            ORDER BY captured_at DESC
            LIMIT 1
        ) ph ON true
        ORDER BY p.last_seen_at DESC
    `);
    return result.rows;
}

/**
 * Get products that haven't been scraped recently
 */
export async function getStaleProducts(hoursThreshold = 24) {
    const result = await pool.query(
        `SELECT * FROM products 
         WHERE last_seen_at < NOW() - INTERVAL '${hoursThreshold} hours'
         ORDER BY last_seen_at ASC`,
        []
    );
    return result.rows;
}
```

---

### 5. Refactored `src/monitor/price-monitor.js`

```javascript
import logger from "../utils/logger.js";
import { scrapeAmazon } from "../scraper/amazon.js";
import { scrapeBurton } from "../scraper/burton.js";
import { upsertProductAndHistory, getAllProductsWithLatestPrice } from "../db/productRepository.js";
import { exportToJSON } from "../services/exportService.js";
import { retry } from "../utils/retry.js";
import { delay } from "../utils/delay.js";
import config from "../config/index.js";

// Product URLs - TODO: Move to database
const PRODUCT_URLS = [
    "https://www.amazon.com/dp/B0DHS3B7S1",
    "https://www.amazon.com/dp/B0DHS5F4PZ",
    "https://www.burton.com/us/en/p/mens-burton-freestyle-reflex-snowboard-bindings/W26-105441B27ORG00M.html"
];

/**
 * Determine which scraper to use based on URL
 */
function getScraperForUrl(url) {
    if (url.includes("amazon.com")) return { name: 'Amazon', scraper: scrapeAmazon };
    if (url.includes("burton.com")) return { name: 'Burton', scraper: scrapeBurton };
    return null;
}

/**
 * Scrape a single product with retry logic
 */
async function scrapeProductWithRetry(url) {
    const scraperInfo = getScraperForUrl(url);
    
    if (!scraperInfo) {
        logger.warn({ url }, 'No scraper available for URL');
        return null;
    }

    try {
        const data = await retry(
            () => scraperInfo.scraper(url),
            {
                retries: config.scraper.retries,
                minDelay: config.scraper.minDelay,
                maxDelay: config.scraper.maxDelay,
            }
        );

        return data;
        
    } catch (error) {
        logger.error({ error, url, scraper: scraperInfo.name }, 'Failed to scrape product after retries');
        return null;
    }
}

/**
 * Process a single product: scrape and save
 */
async function processProduct(url) {
    logger.info({ url }, 'Processing product');

    const data = await scrapeProductWithRetry(url);

    if (!data) {
        logger.warn({ url }, 'Scraping returned no data, skipping');
        return false;
    }

    try {
        const productId = await upsertProductAndHistory(data);
        logger.info({ productId, url, title: data.title, price: data.price }, 'Product saved successfully');
        return true;
        
    } catch (error) {
        logger.error({ error, url }, 'Failed to save product to database');
        return false;
    }
}

/**
 * Main price monitoring function
 */
export async function runPriceMonitor() {
    const startTime = Date.now();
    logger.info('Starting price monitoring cycle');

    const results = {
        total: PRODUCT_URLS.length,
        successful: 0,
        failed: 0,
    };

    for (const url of PRODUCT_URLS) {
        try {
            const success = await processProduct(url);
            
            if (success) {
                results.successful++;
            } else {
                results.failed++;
            }

            // Rate limiting: delay between requests
            const delayMs = Math.floor(
                Math.random() * (config.scraper.maxDelay - config.scraper.minDelay) + config.scraper.minDelay
            );
            logger.debug({ delayMs }, 'Waiting before next request');
            await delay(delayMs);
            
        } catch (error) {
            logger.error({ error, url }, 'Unexpected error processing product');
            results.failed++;
        }
    }

    // Export results
    try {
        const products = await getAllProductsWithLatestPrice();
        await exportToJSON(products, 'products.json');
        logger.info({ count: products.length }, 'Products exported to JSON');
    } catch (error) {
        logger.error({ error }, 'Failed to export products');
    }

    const duration = Date.now() - startTime;
    logger.info({ results, durationMs: duration }, 'Price monitoring cycle completed');

    return results;
}
```

---

### 6. New `src/utils/retry.js`

```javascript
import logger from "./logger.js";

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.retries - Maximum number of retries
 * @param {number} options.minDelay - Minimum delay between retries (ms)
 * @param {number} options.maxDelay - Maximum delay between retries (ms)
 * @param {Function} options.shouldRetry - Optional function to determine if error should be retried
 * @returns {Promise} Result of the function
 */
export async function retry(fn, options = {}) {
    const {
        retries = 3,
        minDelay = 1000,
        maxDelay = 5000,
        shouldRetry = () => true,
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt > retries) {
                logger.error({ error, attempt, retries }, 'All retry attempts exhausted');
                throw error;
            }

            if (!shouldRetry(error)) {
                logger.warn({ error, attempt }, 'Error not retryable, throwing');
                throw error;
            }

            // Exponential backoff with jitter
            const exponentialDelay = Math.min(minDelay * Math.pow(2, attempt - 1), maxDelay);
            const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
            const delay = Math.floor(exponentialDelay + jitter);

            logger.warn({ error: error.message, attempt, retries, delayMs: delay }, 'Retrying after error');

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Simple delay helper
 */
export async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### 7. New `src/services/exportService.js`

```javascript
import { promises as fs } from "fs";
import path from "path";
import config from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Export products to JSON file
 */
export async function exportToJSON(data, filename) {
    const filepath = path.join(config.paths.exports, filename);

    try {
        // Ensure exports directory exists
        await fs.mkdir(config.paths.exports, { recursive: true });

        // Write JSON file
        await fs.writeFile(
            filepath,
            JSON.stringify(data, null, 2),
            'utf8'
        );

        logger.info({ filepath, count: data.length }, 'Data exported to JSON');
        
    } catch (error) {
        logger.error({ error, filepath }, 'Failed to export JSON');
        throw error;
    }
}

/**
 * Export products to CSV file
 */
export async function exportToCSV(data, filename) {
    // TODO: Implement CSV export
    throw new Error('CSV export not implemented yet');
}
```

---

### 8. Fixed `src/utils/logger.js`

```javascript
import pino from "pino";
import config from "../config/index.js";

const logger = pino({
    level: config.log.level,
    transport: config.log.prettyPrint ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        }
    } : undefined,
    base: {
        env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
```

---

### 9. New `src/core/errors/AppError.js`

```javascript
export class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

export class DatabaseError extends AppError {
    constructor(message, originalError) {
        super(message, 500, true);
        this.name = 'DatabaseError';
        this.originalError = originalError;
    }
}

export class ScraperError extends AppError {
    constructor(message, url, originalError) {
        super(message, 500, true);
        this.name = 'ScraperError';
        this.url = url;
        this.originalError = originalError;
    }
}

export class ValidationError extends AppError {
    constructor(message, field) {
        super(message, 400, true);
        this.name = 'ValidationError';
        this.field = field;
    }
}
```

---

### 10. New `.env.example`

```bash
# Application
NODE_ENV=development
PORT=3000

# PostgreSQL Database
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_username
PG_PASSWORD=your_password
PG_DATABASE=price_tracker

# PostgreSQL Connection Pool
PG_POOL_MAX=20
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000

# Scraper Configuration
SCRAPER_RETRIES=3
SCRAPER_MIN_DELAY=1200
SCRAPER_MAX_DELAY=2500
SCRAPER_TIMEOUT=30000
SCRAPER_HEADLESS=true
SCRAPER_USE_PROXY=false

# Logging
LOG_LEVEL=info

# File Paths
USER_AGENTS_FILE=./data/useragents.txt
EXPORTS_DIR=./exports

# Optional: Monitoring
# SENTRY_DSN=your_sentry_dsn
# DATADOG_API_KEY=your_datadog_key
```

---

## 📋 MIGRATION CHECKLIST

Before deploying to production, ensure:

- [ ] All critical bugs fixed
- [ ] All tests passing
- [ ] Database migrations tested
- [ ] Configuration validated
- [ ] Logging properly configured
- [ ] Error handling in place
- [ ] Health checks implemented
- [ ] Docker images built and tested
- [ ] CI/CD pipeline working
- [ ] Documentation updated
- [ ] Security audit completed
- [ ] Performance testing done
- [ ] Monitoring and alerts configured
- [ ] Backup and recovery tested

---

## 🎓 RECOMMENDATIONS SUMMARY

### High Priority
1. **Complete PostgreSQL migration** - Remove MongoDB entirely
2. **Fix all critical bugs** - Application must start and run
3. **Implement proper error handling** - Use custom error classes and logger
4. **Add retry logic** - Scraping must be resilient
5. **Separate concerns** - Split monolithic functions into services

### Medium Priority
6. **Add comprehensive tests** - Unit, integration, E2E
7. **Implement monitoring** - Metrics, logs, health checks
8. **Improve scraper architecture** - Base classes, better anti-detection
9. **Add API layer** - REST API for external access
10. **Complete Docker setup** - Production-ready containers

### Low Priority
11. **Add job queue** - For scalable background processing
12. **Implement caching** - Redis for performance
13. **Add advanced analytics** - Price predictions, trends
14. **Multi-tenancy support** - Multiple users

---

## 🚀 EXPECTED OUTCOMES

After implementing this refactoring plan:

- **Stability**: 99.9% uptime with proper error handling
- **Performance**: Handle 1000+ products efficiently
- **Scalability**: Easy to add new sites and features
- **Maintainability**: Clear architecture, well-tested
- **Observability**: Full visibility into operations
- **Security**: Production-grade security practices
- **Developer Experience**: Easy to onboard new developers

---

**End of Architecture Review**

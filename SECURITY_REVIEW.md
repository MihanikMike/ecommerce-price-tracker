# Security & Database Review
**Date:** November 28, 2025  
**Project:** Price Tracker  
**Stack:** Node.js + Playwright + PostgreSQL

---

## ✅ STRENGTHS

### 1. **SQL Injection Protection**
✅ **All queries use parameterized queries** - No string concatenation found
- `pool.query('SELECT * FROM products WHERE id = $1', [id])` ✓
- All user inputs properly escaped through pg library

### 2. **Database Connection**
✅ Connection pooling configured correctly
✅ Pool error handlers in place
✅ Timeouts configured (30s idle, 10s connection)

### 3. **Transaction Management**
✅ Proper BEGIN/COMMIT/ROLLBACK in critical operations
✅ Client release in finally blocks

### 4. **Migration System**
✅ Schema versioning with `schema_migrations` table
✅ Idempotent migrations (IF NOT EXISTS, ON CONFLICT)

---

## 🔴 CRITICAL ISSUES

### 1. **Missing .env File & Authentication Not Updated**
**Severity:** HIGH  
**Impact:** Application cannot connect to database with new credentials

**Problem:**
- No `.env` file detected in project
- Config expects `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` from environment
- You mentioned fixing auth to use "mike228" user, but credentials not configured

**Solution:**
Create `.env` file with new credentials:

```env
# Database Configuration
PG_HOST=localhost
PG_PORT=5432
PG_USER=mike228
PG_PASSWORD=your_password_here
PG_DATABASE=price_tracker
PG_POOL_MAX=20
PG_IDLE_TIMEOUT=30000
PG_CONNECTION_TIMEOUT=10000

# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Scraper
SCRAPER_RETRIES=3
SCRAPER_MIN_DELAY=1200
SCRAPER_MAX_DELAY=2500
SCRAPER_TIMEOUT=30000
SCRAPER_HEADLESS=true
SCRAPER_USE_PROXY=false
```

**Action Required:**
```bash
# 1. Create .env file
cp .env.example .env  # or create manually

# 2. Edit with your credentials
nano .env

# 3. Test connection
npm run migrate
```

---

### 2. **No Input Validation Before Database Operations**
**Severity:** HIGH  
**Impact:** Bad data can corrupt database, cause runtime errors

**Problems:**
- `upsertProductAndHistory()` - No validation of price, title, URL format
- `addTrackedProduct()` - No URL format validation, site validation
- `updateProductCheckTime()` - No validation of productId existence before update
- Scrapers can return `null` but repositories don't validate

**Examples of Missing Validation:**

```javascript
// productRepository.js - Line 7
export async function upsertProductAndHistory({ url, site, title, price, currency = 'USD' }) {
    // ❌ No validation that:
    // - url is valid URL format
    // - price is positive number
    // - title is not empty
    // - site matches known sites
    // - currency is valid (USD, EUR, etc.)
    
    const client = await pool.connect();
    // ...
}

// trackedProductsRepository.js - Line 75
export async function addTrackedProduct({ url, site, enabled = true, checkIntervalMinutes = 60 }) {
    // ❌ No validation that:
    // - url matches supported domains (amazon.com, burton.com)
    // - checkIntervalMinutes is reasonable (1-1440 minutes)
    // - site is valid enum
}

// amazon.js - Line 20
const price = await page.$eval(".a-price > .a-offscreen", el => 
    el.innerText.replace(/[^0-9.]/g, ""));
// ❌ Returns string "123.45" but upsertProductAndHistory expects number
// ❌ No validation if price is "$1,234.56" → becomes "1234.56"
```

---

### 3. **Error Handling Gaps**
**Severity:** MEDIUM  
**Impact:** Silent failures, incomplete transactions

**Problems:**
- CLI scripts (`seed.js`, `view-db.js`) don't close pool on error
- No validation that database operations succeeded
- Circuit breaker in `price-monitor.js` has no reset mechanism

**Example:**
```javascript
// seed.js - Lines 48-61
async function main() {
    try {
        await seedDatabase();
        await closeDatabaseConnection();
        process.exit(0);
    } catch (error) {
        await closeDatabaseConnection();
        process.exit(1);  // ❌ No error message to user
    }
}
```

---

### 4. **No Database Connection Retry Logic**
**Severity:** MEDIUM  
**Impact:** App crashes if DB temporarily unavailable

**Problem:**
```javascript
// index.js startup
await connectToDatabase();
await runMigrations();
await browserPool.initialize();
```
If PostgreSQL is restarting or slow to start, app fails immediately.

---

### 5. **Concurrent Update Race Conditions**
**Severity:** MEDIUM  
**Impact:** Lost updates, inconsistent scheduling

**Problem:**
```javascript
// trackedProductsRepository.js - updateProductCheckTime()
// If same product checked by 2 workers simultaneously:
// Worker A: reads check_interval_minutes
// Worker B: reads check_interval_minutes
// Worker A: calculates next_check_at, updates
// Worker B: calculates next_check_at, updates (OVERWRITES A's work)
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 6. **No Type Checking for Scraped Data**
**Problem:**
- Scrapers return `{ price: parseFloat(price) }` but what if `parseFloat()` returns `NaN`?
- Database stores `NUMERIC(10,2)` - values > 99,999,999.99 will fail

**Solution:**
Add validation layer:
```javascript
function validateScrapedData(data) {
    if (!data) return { valid: false, errors: ['No data'] };
    
    const errors = [];
    
    if (!data.url || !isValidURL(data.url)) {
        errors.push('Invalid URL');
    }
    
    if (!data.title || data.title.trim().length === 0) {
        errors.push('Missing title');
    }
    
    if (typeof data.price !== 'number' || isNaN(data.price) || data.price <= 0) {
        errors.push('Invalid price');
    }
    
    if (data.price > 99999999.99) {
        errors.push('Price exceeds database limit');
    }
    
    if (!['Amazon', 'Burton'].includes(data.site)) {
        errors.push('Unknown site');
    }
    
    return { valid: errors.length === 0, errors };
}
```

---

### 7. **Client Release Not Guaranteed in All Paths**
**Problem:**
```javascript
// productRepository.js - Line 8
export async function upsertProductAndHistory({ url, site, title, price, currency = 'USD' }) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        // ... operations
        await client.query('COMMIT');
        return productId;  // ✓ Finally block will run
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;  // ✓ Finally block will run
    } finally {
        client.release();  // ✓ Good
    }
}
```
✅ This one is actually fine, but some code paths could be missed if logic changes.

---

### 8. **No Connection Pool Monitoring**
**Problem:**
- No visibility into pool health (active connections, waiting queries)
- No alerts if pool is exhausted

**Solution:**
Add monitoring endpoint:
```javascript
export function getPoolStats() {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
        maxConnections: config.pg.max
    };
}
```

---

### 9. **Migration System Has No Rollback**
**Problem:**
- Migrations can only go forward
- If migration 003 fails after 002 succeeds, system is stuck

**Solution:**
Consider adding rollback migrations or snapshot system.

---

### 10. **Hardcoded Credentials in Seed Script**
**Problem:**
```javascript
// seed.js - Lines 4-25
const SEED_PRODUCTS = [
    {
        url: 'https://www.amazon.com/dp/B0DHS3B7S1',
        site: 'Amazon',
        // ...
    }
];
```
Not a security issue, but seed data should be in separate JSON file for easy updates.

---

## 🟢 LOW PRIORITY / RECOMMENDATIONS

### 11. **Query Performance**
- Consider adding `EXPLAIN ANALYZE` logging in development
- Add slow query logging (queries > 100ms)

### 12. **Database Backups**
- No backup strategy documented
- Consider pg_dump cron job

### 13. **Connection String Alternative**
Instead of separate variables, consider:
```javascript
DATABASE_URL=postgresql://mike228:password@localhost:5432/price_tracker
```

### 14. **Prepared Statements**
For frequently executed queries, use named prepared statements:
```javascript
const result = await client.query({
    name: 'get-product-by-url',
    text: 'SELECT * FROM products WHERE url = $1',
    values: [url]
});
```

### 15. **Add Database Health Check to Startup**
```javascript
async function main() {
    // Check DB before starting browser pool
    const health = await checkDatabaseHealth();
    if (!health.healthy) {
        logger.error('Database unhealthy, exiting');
        process.exit(1);
    }
    // ... continue startup
}
```

---

## 📋 ACTION ITEMS (Priority Order)

### Immediate (Today)
1. ✅ Create `.env` file with mike228 credentials
2. ✅ Test database connection: `npm run migrate`
3. ✅ Test seed: `npm run seed`
4. ✅ Add `.env` to `.gitignore`
5. ✅ Create `.env.example` template

### High Priority (This Week)
6. ⚠️ Add input validation to all repository functions
7. ⚠️ Add data validation after scraping
8. ⚠️ Add retry logic to database connection
9. ⚠️ Improve error messages in CLI scripts
10. ⚠️ Add database connection monitoring

### Medium Priority (Next Week)
11. 📌 Fix concurrent update race conditions
12. 📌 Add database health check to startup
13. 📌 Add slow query logging
14. 📌 Document backup strategy

### Nice to Have
15. 💡 Move seed data to JSON file
16. 💡 Add migration rollback support
17. 💡 Use prepared statements for hot paths
18. 💡 Add pool statistics monitoring

---

## 🔍 SQL INJECTION AUDIT

**Status:** ✅ **SECURE**

All queries checked:
- ✅ `connect-pg.js`: Uses parameterized queries
- ✅ `productRepository.js`: All queries use `$1, $2` placeholders
- ✅ `trackedProductsRepository.js`: All queries use `$1, $2` placeholders
- ✅ `seed.js`: Uses parameterized queries
- ✅ `view-db.js`: No user input (safe)
- ✅ CLI scripts: No direct user input to queries

**No SQL injection vulnerabilities found.**

---

## 🛡️ SECURITY BEST PRACTICES CHECK

| Practice | Status | Notes |
|----------|--------|-------|
| Parameterized queries | ✅ | All queries use $1, $2 placeholders |
| Connection pooling | ✅ | Properly configured |
| SSL/TLS to database | ⚠️ | Not configured (OK for localhost) |
| Least privilege user | ✅ | Using mike228, not postgres superuser |
| Password in env var | ⚠️ | .env file missing |
| Input validation | ❌ | Missing |
| Error messages sanitized | ✅ | No sensitive data in logs |
| Rate limiting | ✅ | Scraper has delays |
| Transaction isolation | ✅ | Using transactions properly |
| Audit logging | ⚠️ | Only application logs, no DB audit log |

---

## 📚 TESTING RECOMMENDATIONS

### Database Tests Needed:
1. **Connection Tests**
   - Pool can connect with correct credentials
   - Pool handles connection failures gracefully
   - Pool recovers from temporary DB outages

2. **Repository Tests**
   - `upsertProductAndHistory()` with duplicate URLs
   - `upsertProductAndHistory()` with invalid data
   - `addTrackedProduct()` with malformed URLs
   - Concurrent updates to same product

3. **Migration Tests**
   - Fresh database migrations
   - Re-running migrations (idempotency)
   - Migration failure recovery

4. **Integration Tests**
   - Full scrape → save → retrieve cycle
   - Multiple workers updating same product
   - Database connection pool exhaustion

---

## 💻 QUICK START CHECKLIST

```bash
# 1. Create .env file
cat > .env << 'EOF'
PG_HOST=localhost
PG_PORT=5432
PG_USER=mike228
PG_PASSWORD=YOUR_PASSWORD_HERE
PG_DATABASE=price_tracker
PG_POOL_MAX=20
NODE_ENV=development
LOG_LEVEL=info
SCRAPER_RETRIES=3
SCRAPER_HEADLESS=true
EOF

# 2. Test connection
npm run migrate

# 3. Seed data
npm run seed

# 4. View database
npm run view-db

# 5. Start application
npm start
```

---

**Review completed by:** GitHub Copilot  
**Next review:** After implementing validation layer

# Architecture Guide

## How the Program Works

The price tracker has **two main components** that can run independently:

### 1. API Server (`npm start`)
- Starts **REST API** on port 3001 for viewing/managing data
- Starts **Health Server** on port 3000 for monitoring
- **Does NOT scrape** - just serves data from the database
- Use this when you want to query products, view price history, or build a frontend

### 2. Price Monitor (`npm run monitor`)
- Scrapes tracked products and saves prices to database
- Initializes browser pool (3 Firefox browsers)
- Uses proxy rotation with direct fallback
- **Does NOT need API server** - writes directly to PostgreSQL
- Run this when you want to check/update prices

---

## How They Relate

```
┌─────────────────┐     ┌─────────────────┐
│  Price Monitor  │     │   API Server    │
│(npm run monitor)│     │  (npm start)    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  WRITE prices         │  READ prices
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │   PostgreSQL    │
            │    Database     │
            └─────────────────┘
```

---

## Typical Workflows

### Workflow 1: Just Update Prices
```bash
npm run monitor    # Scrape all due products, save to DB, exit
```
No API server needed.

### Workflow 2: View Data via API
```bash
npm start          # Start API server
# Then visit http://localhost:3001/api/products
```

### Workflow 3: Full Setup (Both)
```bash
# Terminal 1: Start API server
npm start

# Terminal 2: Run monitor (once or scheduled)
npm run monitor
```

### Workflow 4: Continuous Monitoring
You could set up a **cron job** to run monitor periodically:
```bash
# Every hour
0 * * * * cd /path/to/project && npm run monitor
```

---

## Component Summary

| Command | What it does | Needs API? |
|---------|--------------|------------|
| `npm run monitor` | Scrape & save prices | ❌ No |
| `npm start` | Start REST API | - |
| `npm run check-db` | View DB health | ❌ No |
| `npm run view-db` | View DB contents | ❌ No |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/server/api-server.js` | REST API endpoints |
| `src/server/health-server.js` | Health check endpoint |
| `src/monitor/price-monitor.js` | Price scraping orchestration |
| `src/scraper/amazon.js` | Amazon product scraper |
| `src/scraper/burton.js` | Burton product scraper |
| `src/db/productRepository.js` | Database operations for products |
| `src/db/trackedProductsRepository.js` | Tracked products CRUD |
| `src/utils/BrowserPool.js` | Playwright browser pool |
| `src/utils/fetch-page.js` | Page fetching with proxy support |
| `src/utils/proxy-manager.js` | Proxy rotation and validation |

---

## Data Flow

### When Monitor Runs:
1. Load tracked products from `tracked_products` table (URL-based only)
2. For each product:
   - Acquire browser from pool
   - Try proxies (15s timeout), fallback to direct (30s timeout)
   - Scrape product data (title, price)
   - Validate data
   - Save to `products` table (with current price)
   - Save to `price_history` table (skip duplicates within 5 min)
   - Update `tracked_products.next_check_at`
3. Export to `exports/products.json`
4. Close browser pool

### When API Serves Request:
1. Receive HTTP request
2. Query PostgreSQL
3. Return JSON response

---

## FAQ

**Q: Do I need to start the API server before running monitor?**
A: No. The monitor writes directly to the database. Start the API server only when you want HTTP access to the data.

**Q: Can I run both at the same time?**
A: Yes! They don't conflict. API reads, Monitor writes.

**Q: How often does the monitor check products?**
A: Each tracked product has a `check_interval_minutes` (default 60). The monitor only scrapes products where `next_check_at` has passed.

**Q: What if proxies fail?**
A: The system tries 3 proxies (15s timeout each), then falls back to direct connection (30s timeout).

---

*Last Updated: December 1, 2025*

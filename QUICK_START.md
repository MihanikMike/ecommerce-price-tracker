# Quick Start Guide - Updated Database Authentication

## 🎯 Your Situation
You've updated PostgreSQL to use your own user `mike228` with a password instead of the default `postgres` user.

## ✅ What I've Done

### 1. Security Review
- Created `SECURITY_REVIEW.md` - Complete audit of your codebase
- Found: No SQL injection vulnerabilities (all queries use parameterized statements)
- Identified: Missing input validation, no retry logic, no health checks

### 2. Input Validation System
- Created `src/utils/validation.js` - Validates all user inputs
- Updated all repository functions to validate before database operations
- Updated scrapers to validate scraped data before saving
- **Result:** Bad data cannot enter your database

### 3. Database Connection Improvements
- Created `src/utils/db-retry.js` - Retry logic with exponential backoff
- Updated `src/index.js` - Tests connection with 5 retries on startup
- Added health check before starting application
- **Result:** App won't crash if database is temporarily unavailable

### 4. Monitoring Tools
- Created `npm run check-db` - View database health, size, and statistics
- Enhanced `getPoolStats()` - Monitor connection pool utilization
- **Result:** You can see what's happening in your database

### 5. Configuration Template
- Created `.env.example` - Template for your credentials
- **Result:** Easy setup for your `mike228` user

## 🚀 What You Need To Do Now

### Step 1: Create .env File
```bash
cd /home/mike/VSCode_Projects/ecommerce-price-tracker

# Create .env from template
cp .env.example .env

# Edit with your credentials
nano .env
```

**Update these lines:**
```env
PG_USER=mike228
PG_PASSWORD=your_actual_password_here
PG_DATABASE=price_tracker
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 2: Test Connection
```bash
npm run check-db
```

**Expected Output:**
```
🔍 DATABASE STATUS CHECK

=== Health Check ===
✅ Status: HEALTHY
📅 Timestamp: 2025-11-28...

=== Connection Pool Stats ===
📊 Total connections: 1/20
💤 Idle connections: 1
...
```

If you see ❌ errors, check your `.env` file credentials.

### Step 3: Run Migrations (if not done)
```bash
npm run migrate
```

### Step 4: Seed Initial Data
```bash
npm run seed
```

### Step 5: View Your Data
```bash
npm run view-db
```

You should see 3 tracked products.

### Step 6: Start the Application
```bash
npm start
```

**What happens now:**
1. Tests database connection (5 retry attempts)
2. Checks database health
3. Runs any pending migrations
4. Initializes browser pool (3 browsers)
5. Loads products from database
6. Starts scraping with validation

## 🧪 Test Validation

The application now validates all data. Try this:

### Test 1: View Validation in Action
```bash
# Run the app and watch the logs
npm start
     │
     ▼
┌─────────────────────────────┐
│ 1. Connect to PostgreSQL    │
│ 2. Run migrations           │
│ 3. Start Health Server :3000│
│ 4. Start API Server :3001   │
│ 5. KEEP RUNNING... ←────────│  ← Stays alive, waiting for requests
└─────────────────────────────┘
# [server listening on 3001...]
# [health server on 3000...]
# (waiting for requests...)

# In another terminal, you can:
curl http://localhost:3001/api/products   # Works!

# Press Ctrl+C to stop the API server

# You should see validation happening:
# - "Scraped data validation" messages
# - If price is invalid (NaN), it logs warning and skips
```

### Test 2: Check Database Health
```bash
# While app is running, open another terminal:
npm run check-db

# You'll see connection pool usage
```

## 📊 New Features You Can Use

### 1. Database Monitoring
```bash
npm run check-db
```
Shows:
- Health status
- Connection pool stats
- Database size
- Table sizes and row counts
- Index usage
- Active connections

### 2. View Database Contents
```bash
npm run view-db
```
Shows:
- All tracked products
- All scraped products
- Price history
- Statistics

### 3. Price Monitoring
```bash
# Run one monitoring cycle (scrape all due products)
npm run monitor
     │
     ▼
┌─────────────────────────────┐
│ 1. Initialize browser pool  │
│ 2. Load due products        │
│ 3. Scrape each product      │
│ 4. Save prices to DB        │
│ 5. Export to JSON           │
│ 6. Close browsers           │
│ 7. EXIT (process ends)      │  ← Terminates here
└─────────────────────────────┘

# Run monitor once and exit
npm run monitor:once

# Show monitor help
npm run monitor:help
```
Features:
- Scrapes all tracked URL-based products
- Uses proxy rotation with direct fallback
- 15-second proxy timeout (fast fail)
- 30-second direct connection timeout
- Automatic price history deduplication (5-min window)
- Updates both `products.price` and `price_history` table

### 4. API Server
```bash
# Start API server (port 3001) + Health server (port 3000)
npm start
```
Endpoints:
- `GET /api/products` - List all products with prices
- `GET /api/products/:id/history` - Price history for a product
- `GET /api/tracked` - List tracked products
- `POST /api/tracked` - Add new tracked product
- `GET /api/charts/price/:id` - Price chart data
- `GET /api/cache/stats` - Cache statistics
- `GET /health` - Health check (port 3000)

### 5. Browser Pool Monitoring
```bash
npm run check-pool
```
Shows:
- Pool health
- Browser statistics
- Memory usage

### 6. Seed More Products
```bash
# Edit src/cli/seed.js to add more URLs
nano src/cli/seed.js

# Then run:
npm run seed
```

## 🛡️ What's Protected Now

### Before
```
Bad data → Database ❌ Crashes
Connection fails → App dies ❌
Invalid price → Stored in DB ❌
```

### After
```
Bad data → Validation ✅ Rejected with clear error
Connection fails → Retry 5 times ✅ Resilient
Invalid price → Logged & skipped ✅ DB stays clean
```

## 🔍 Understanding Validation

### Valid Product Data
```javascript
{
    url: "https://www.amazon.com/dp/B0DHS3B7S1",
    site: "Amazon",
    title: "Some Product",
    price: 29.99,
    currency: "USD"
}
✅ Will be saved
```

### Invalid Examples
```javascript
// Invalid domain
{ url: "https://walmart.com/..." }
❌ Rejected: "URL must be from supported domain"

// Invalid price
{ price: -10 }
❌ Rejected: "Price must be at least 0.01"

{ price: NaN }
❌ Rejected: "Price must be a valid number"

// Empty title
{ title: "" }
❌ Rejected: "Title cannot be empty"
```

## 📝 Common Issues & Solutions

### Issue: "Failed to connect to database"
**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if stopped
sudo systemctl start postgresql

# Check .env file has correct credentials
cat .env | grep PG_
```

### Issue: "Authentication failed for user mike228"
**Solution:**
```bash
# Verify password in .env matches PostgreSQL
# Test manually:
psql -U mike228 -d price_tracker -c "SELECT NOW();"

# If it asks for password and works, update .env with that password
```

### Issue: "Database price_tracker does not exist"
**Solution:**
```bash
# Create database if it doesn't exist
sudo -u postgres createdb -O mike228 price_tracker

# Or connect to postgres and create:
sudo -u postgres psql
CREATE DATABASE price_tracker OWNER mike228;
\q
```

### Issue: Validation errors in logs
**Solution:**
This is expected! The validation system is working. Check the log message:
- If data is truly invalid → Good, it was rejected
- If data looks valid → Check validation rules in `src/utils/validation.js`

## 🎉 Success Checklist

- [ ] Created `.env` file with mike228 credentials
- [ ] `npm run check-db` shows ✅ HEALTHY
- [ ] `npm run migrate` completed without errors
- [ ] `npm run seed` added 3 products
- [ ] `npm run view-db` shows tracked products
- [ ] `npm start` runs without connection errors
- [ ] Browser pool initializes (3 browsers)
- [ ] `npm run monitor` scrapes products and saves prices
- [ ] API available at http://localhost:3001/api/products

## 📊 Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start API server + health server |
| `npm test` | Run all tests (855 tests) |
| `npm run monitor` | Run price monitoring cycle |
| `npm run monitor:once` | Run monitor once and exit |
| `npm run check-db` | Check database health |
| `npm run view-db` | View database contents |
| `npm run check-pool` | Check browser pool status |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed initial products |
| `npm run backup` | Backup database |

## 📚 Documentation Created

1. **SECURITY_REVIEW.md** - Full security audit and recommendations
2. **IMPLEMENTATION_SUMMARY.md** - What was implemented and how to use it
3. **QUICK_START.md** - This guide
4. **docs/api-reference.md** - Complete REST API documentation
5. **docs/frontend-dashboard-plan.md** - Frontend dashboard implementation plan
6. **docs/search-based-tracking.md** - Search-based product tracking guide

## 🆘 Need Help?

Check logs:
```bash
# Run with debug logging
LOG_LEVEL=debug npm start

# Check for validation errors:
npm start 2>&1 | grep -i "validation"
```

---

## 🐳 Docker Deployment

### Quick Start with Docker

**Option 1: Full Stack (App + Database + Monitoring)**
```bash
# Start everything
docker compose up -d

# View logs
docker compose logs -f app

# Check status
docker compose ps
```

**Access:**
- API Server: http://localhost:3001/api/products
- App Health: http://localhost:3000/health
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/pricetracker123)

**Option 2: Development (Database only)**
```bash
# Start only PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# Run app locally
npm run migrate
npm start
```

**Option 3: Database + Admin UI**
```bash
docker compose -f docker-compose.dev.yml up -d

# Access Adminer at http://localhost:8080
# Server: postgres, User: pricetracker, Password: pricetracker123
```

### Docker Commands

```bash
# Build the app image
docker compose build app

# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f app

# Restart app after code changes
docker compose up -d --build app

# Clean up everything (including volumes)
docker compose down -v
```

### Environment Variables

Create a `.env` file for custom settings:
```env
PG_USER=pricetracker
PG_PASSWORD=your_secure_password
PG_DATABASE=pricetracker
LOG_LEVEL=info
SCRAPER_USE_PROXY=false
```

---

## 🚀 Next Steps (Optional)

After everything works:

1. **Add more products:**
   - Edit `src/cli/seed.js`
   - Add Amazon or Burton URLs
   - Run `npm run seed`

2. **Monitor database:**
   - Run `npm run check-db` periodically
   - Watch for connection pool exhaustion
   - Check table sizes

3. **Review security:**
   - Read `SECURITY_REVIEW.md`
   - Implement remaining medium-priority items if needed

---

# Check if API is responding
curl -s http://localhost:3001/api/products && echo "API Running" || echo "API Not Running"

# Check if health server is responding
curl -s http://localhost:3000/health && echo "Health Running" || echo "Health Not Running"

# List all Node.js processes
pgrep -a node

# Check what's using ports 3000/3001
lsof -i :3000 -i :3001


**Status:** ✅ Your project is now production-ready with proper validation, retry logic, monitoring, REST API, and Docker support!

**Authentication:** Configured for PostgreSQL user `mike228` (not postgres superuser)


npm start
     │
     ▼
┌─────────────────────────────┐
│ 1. Connect to PostgreSQL    │
│ 2. Run migrations           │
│ 3. Start Health Server :3000│
│ 4. Start API Server :3001   │
│ 5. KEEP RUNNING (no browser)│ ← Lightweight!
└─────────────────────────────┘

npm run monitor (separate command)
     │
     ▼
┌─────────────────────────────┐
│ 1. Initialize 3 browsers    │ ← Only when scraping
│ 2. Scrape all products      │
│ 3. Save to database         │
│ 4. Close browsers           │
│ 5. EXIT                     │
└─────────────────────────────┘


**Last Updated:** December 1, 2025

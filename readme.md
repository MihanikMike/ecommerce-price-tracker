# E-Commerce Price Tracker

A Node.js application that monitors and tracks product prices across multiple e-commerce sites. Supports both URL-based tracking and search-based product discovery.

## ✨ Features

- 🔍 **Multi-site scraping**: Amazon, Burton, Target, Best Buy, Walmart, Newegg, B&H Photo
- 🔎 **Search-based tracking**: Track products by name without needing URLs
- 📊 **Price history**: Stores historical price data in PostgreSQL
- 🎭 **Headless browser**: Uses Playwright with Firefox for reliable scraping
- 🔄 **Smart scheduling**: Per-product check intervals with rate limiting
- 🛡️ **Anti-detection**: Rotating user agents, proxies, and delays
- 📈 **Monitoring**: Prometheus metrics + Grafana dashboards
- 🐳 **Docker support**: Full containerized deployment
- ❤️ **Health checks**: `/health`, `/ready`, `/live`, `/metrics` endpoints

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Firefox (installed by Playwright)

### Installation

```bash
# Clone the repository
git clone https://github.com/MihanikMike/ecommerce-price-tracker.git
cd ecommerce-price-tracker

# Install dependencies
npm install

# Install Firefox browser
npx playwright install firefox

# Copy environment template
cp .env.example .env
# Edit .env with your PostgreSQL credentials
```

### Configure Database

Edit `.env`:
```env
PG_HOST=localhost
PG_PORT=5432
PG_USER=your_username
PG_PASSWORD=your_password
PG_DATABASE=price_tracker
```

### Run Migrations

```bash
npm run migrate
```

### Start the App

```bash
npm start
```

## 🐳 Docker Deployment

### Full Stack (App + Database + Monitoring)

```bash
docker compose up -d

# Access:
# - App Health: http://localhost:3000/health
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001 (admin/pricetracker123)
```

### Development (Database only)

```bash
docker compose -f docker-compose.dev.yml up -d
npm start
```

## 📦 Managing Products

### List Products
```bash
npm run products:list
```

### Add URL-based Product
```bash
node src/cli/products.js add-url "https://www.amazon.com/dp/B09V3KXJPB"
```

### Add Search-based Product
```bash
node src/cli/products.js add-search "PlayStation 5"
node src/cli/products.js add-search "Sony WH-1000XM5" headphones wireless
```

### Update/Remove Products
```bash
# Update product name
node src/cli/products.js update 4 product_name "iPhone 16 Pro"

# Change check interval (minutes)
node src/cli/products.js update 4 check_interval_minutes 30

# Disable/Enable
node src/cli/products.js disable 4
node src/cli/products.js enable 4

# Remove
node src/cli/products.js remove 4
```

### Search Products (without tracking)
```bash
node src/cli/search.js search "AirPods Pro"
```

## 🛠️ CLI Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run price monitoring |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed initial products |
| `npm run products:list` | List tracked products |
| `npm run products:help` | Product management help |
| `npm run search` | Search for products |
| `npm run view-db` | View database contents |
| `npm run check-db` | Check database health |
| `npm run check-pool` | Check browser pool status |

## 📁 Project Structure

```
ecommerce-price-tracker/
├── src/
│   ├── index.js              # Application entry point
│   ├── cli/                  # CLI tools
│   │   ├── products.js       # Product management
│   │   ├── search.js         # Search products
│   │   ├── migrate.js        # Run migrations
│   │   └── view-db.js        # View database
│   ├── config/
│   │   └── index.js          # Configuration + validation
│   ├── db/
│   │   ├── connect-pg.js     # PostgreSQL connection
│   │   ├── productRepository.js
│   │   ├── trackedProductsRepository.js
│   │   └── migrations/       # SQL migrations
│   ├── monitor/
│   │   ├── price-monitor.js  # URL-based monitoring
│   │   └── search-monitor.js # Search-based monitoring
│   ├── scraper/
│   │   ├── amazon.js         # Amazon scraper
│   │   └── burton.js         # Burton scraper
│   ├── search/
│   │   ├── direct-search.js  # Direct site search
│   │   ├── search-engine.js  # Bing search
│   │   └── universal-scraper.js
│   ├── server/
│   │   └── health-server.js  # Health endpoints
│   └── utils/
│       ├── BrowserPool.js    # Browser management
│       ├── rate-limiter.js   # Per-site rate limiting
│       ├── proxy-manager.js  # Proxy rotation
│       ├── validation.js     # Input validation
│       └── metrics.js        # Prometheus metrics
├── monitoring/               # Prometheus + Grafana config
├── docker-compose.yml        # Full stack deployment
├── docker-compose.dev.yml    # Development setup
├── Dockerfile
└── package.json
```

## 📊 Database Schema

### Products
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    site TEXT NOT NULL,
    title TEXT,
    last_seen_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Price History
```sql
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    captured_at TIMESTAMP DEFAULT NOW()
);
```

### Tracked Products
```sql
CREATE TABLE tracked_products (
    id SERIAL PRIMARY KEY,
    url TEXT UNIQUE,
    product_name TEXT,
    site TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    check_interval_minutes INTEGER DEFAULT 60,
    tracking_mode TEXT DEFAULT 'url',
    last_checked_at TIMESTAMP,
    next_check_at TIMESTAMP
);
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_HOST` | localhost | PostgreSQL host |
| `PG_PORT` | 5432 | PostgreSQL port |
| `PG_USER` | - | Database user (required) |
| `PG_PASSWORD` | - | Database password (required) |
| `PG_DATABASE` | - | Database name (required) |
| `PORT` | 3000 | Health server port |
| `LOG_LEVEL` | info | Logging level |
| `SCRAPER_USE_PROXY` | false | Enable proxy rotation |
| `SCRAPER_HEADLESS` | true | Run browser headless |
| `SCRAPER_TIMEOUT` | 30000 | Page load timeout (ms) |

## 📈 Monitoring

### Health Endpoints

- `GET /health` - Full health check with component status
- `GET /ready` - Readiness probe (Kubernetes)
- `GET /live` - Liveness probe (Kubernetes)
- `GET /metrics` - Prometheus metrics

### Grafana Dashboard

Pre-configured dashboard includes:
- Scrape success rate
- Response times
- Price changes detected
- Browser pool usage
- Database connections

## 🛡️ Anti-Detection Features

- Firefox browser (less detected than Chrome)
- Random user agent rotation
- Per-site rate limiting with adaptive backoff
- Random delays between requests
- Proxy support (free/paid providers)

## 🐛 Troubleshooting

**Database connection error:**
- Verify PostgreSQL is running
- Check credentials in `.env`
- Run `npm run check-db`

**Scraping errors:**
- Site may have changed selectors
- Rate limited - wait and retry
- Try without proxy: `SCRAPER_USE_PROXY=false`

**Browser errors:**
- Run `npx playwright install firefox`
- Check `npm run check-pool`

## 📝 License

ISC

## 👤 Author

MihanikMike

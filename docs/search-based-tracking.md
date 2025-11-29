# Search-Based Product Tracking System

## Overview

This document describes the upgraded product tracking system that replaces the fixed-URL model with a dynamic search-based approach. Instead of providing direct product URLs, users now simply provide a product name, and the system automatically searches for it across multiple e-commerce sites, scrapes pricing data, and compares results.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                    │
│                   Product Name + Keywords                            │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SEARCH ORCHESTRATOR                                │
│                 src/search/search-orchestrator.js                    │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐   │
│  │ Rate Limiter │  │ Proxy Manager │  │ Browser Pool            │   │
│  │ (per-site)   │  │ (4 sources)   │  │ (3 reusable browsers)   │   │
│  └──────────────┘  └───────────────┘  └─────────────────────────┘   │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
┌─────────────┐ ┌──────────┐ ┌────────────┐
│ 1. SEARCH   │ │ 2. SCRAPE│ │ 3. COMPARE │
│             │ │          │ │            │
│ DuckDuckGo  │ │ Universal│ │ Product    │
│ HTML Search │ │ Scraper  │ │ Matcher    │
└─────────────┘ └──────────┘ └────────────┘
         │            │            │
         ▼            ▼            ▼
┌─────────────┐ ┌──────────┐ ┌────────────┐
│ Filter URLs │ │ Extract  │ │ Score &    │
│ E-commerce  │ │ Price    │ │ Rank       │
│ Domains     │ │ Title    │ │ Results    │
│ Only        │ │ Stock    │ │            │
└─────────────┘ └──────────┘ └────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE                                      │
│  tracked_products (search mode) + search_results (comparisons)      │
└─────────────────────────────────────────────────────────────────────┘
```

## Workflow

### Step 1: Search
- User provides product name and optional keywords
- System searches DuckDuckGo HTML (less bot detection than Google)
- Results are filtered to known e-commerce domains only
- Prioritized by site reputation (Amazon, Walmart, etc.)

### Step 2: Scrape
- Each filtered URL is visited using browser pool
- Universal scraper detects site type and uses appropriate selectors
- Extracts: title, price, currency, availability, brand, SKU
- Falls back to Schema.org/JSON-LD when available

### Step 3: Compare
- Products are scored using fuzzy matching algorithm
- Best match is identified based on title similarity
- Prices are compared across all sources
- Recommendations generated (best price, savings opportunity)

## Files Created

| File | Purpose |
|------|---------|
| `src/search/search-engine.js` | DuckDuckGo HTML search with proxy rotation |
| `src/search/site-registry.js` | E-commerce site detection & selector configs |
| `src/search/universal-scraper.js` | Generic scraper for any e-commerce site |
| `src/search/product-matcher.js` | Fuzzy matching & price comparison |
| `src/search/search-orchestrator.js` | Coordinates the complete workflow |
| `src/search/index.js` | Module exports |
| `src/monitor/search-monitor.js` | Search-based price monitoring |
| `src/cli/search.js` | CLI for searching & tracking |
| `src/db/migrations/004_search_based_tracking.sql` | Database schema updates |

## Database Schema

### Modified: `tracked_products`

New columns added:

| Column | Type | Description |
|--------|------|-------------|
| `product_name` | TEXT | Product name for search-based tracking |
| `search_keywords` | TEXT[] | Additional keywords to improve search accuracy |
| `tracking_mode` | TEXT | 'url' (legacy) or 'search' (new) |
| `last_found_url` | TEXT | Most recent URL found via search |
| `match_confidence` | DECIMAL | Confidence score (0-100) of last match |
| `search_failures` | INTEGER | Count of consecutive search failures |

### New: `search_results`

Stores scraped results for price comparison:

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `tracked_product_id` | INTEGER | FK to tracked_products |
| `search_query` | TEXT | The search query used |
| `result_url` | TEXT | URL of the scraped product |
| `result_title` | TEXT | Product title |
| `site_name` | TEXT | E-commerce site name |
| `price` | DECIMAL | Product price |
| `currency` | TEXT | Currency code |
| `availability` | TEXT | Stock status |
| `match_score` | DECIMAL | Match confidence (0-100) |
| `is_best_match` | BOOLEAN | Whether this is the best match |
| `raw_data` | JSONB | Full scraped data |

## CLI Usage

```bash
# Run the migration first
npm run migrate

# Quick search (one-off, not tracked)
node src/cli/search.js search "iPhone 15 Pro Max"
node src/cli/search.js search "Burton snowboard jacket" --keywords=mens,winter

# Add product to tracking
node src/cli/search.js track "Nintendo Switch OLED" --interval=120

# Run the search monitor (processes all tracked search products)
node src/cli/search.js run

# View all tracked products
node src/cli/search.js list

# Compare prices for a specific tracked product
node src/cli/search.js compare 1

# Help
node src/cli/search.js help
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--keywords=a,b` | Additional search keywords (comma-separated) |
| `--max=N` | Maximum results to return (default: 5) |
| `--site=name` | Preferred site (amazon, burton, etc.) |
| `--interval=N` | Check interval in minutes (default: 60) |
| `--limit=N` | Limit products to process in monitor (default: 50) |

## Programmatic API

### Quick Search

```javascript
import { quickSearch } from './monitor/search-monitor.js';

const result = await quickSearch('iPhone 15 Pro', {
    keywords: ['256gb', 'unlocked'],
    maxResults: 5,
});

console.log(result.bestMatch);
console.log(result.priceComparison);
```

### Full Search & Scrape

```javascript
import { searchAndScrape } from './search/search-orchestrator.js';

const result = await searchAndScrape('Burton snowboard jacket', {
    keywords: ['mens', 'winter'],
    maxResults: 5,
    preferredSites: ['burton', 'rei'],
    expectedPrice: 200,
});

console.log(result.scrapedProducts);
console.log(result.bestMatch);
console.log(result.priceComparison.recommendations);
```

### Track a Product

```javascript
import { trackProduct } from './monitor/search-monitor.js';

const productId = await trackProduct('Nintendo Switch OLED', {
    site: 'any',
    keywords: ['console', 'gaming'],
    checkIntervalMinutes: 120,
});
```

### Run Search Monitor

```javascript
import { runSearchMonitor } from './monitor/search-monitor.js';

const results = await runSearchMonitor({
    limit: 50,
    delayBetweenProducts: 10000,
});

console.log(`Processed ${results.total}, ${results.successful} successful`);
```

## Proxy Integration

The search workflow integrates with the existing `ProxyManager`:

### How Proxies Are Used

1. **Search Phase**: DuckDuckGo searches use `fetchPage()` with proxy rotation
2. **Scrape Phase**: Each product URL is scraped through a rotated proxy
3. **Failure Handling**: Failed proxies are marked via `markProxyFailed()`
4. **Auto-Retry**: System retries with different proxy on failure
5. **Cache Refresh**: Proxy cache is refreshed when running low

### Proxy Sources (4 total)

- SSLProxies.org
- FreeProxyList.net
- ProxyScrape API
- Geonode API

### Configuration

Proxy behavior is configured in `src/utils/proxy-manager.js`:

```javascript
const CONFIG = {
    maxConcurrentChecks: 20,    // Parallel proxy validation
    checkTimeout: 3000,          // 3s timeout per proxy
    minWorkingProxies: 5,        // Minimum to keep in cache
    cacheExpiry: 30 * 60 * 1000, // Refresh every 30 minutes
};
```

## Product Matching Algorithm

Products from search results are ranked using a weighted scoring system:

### Score Components

| Factor | Weight | Description |
|--------|--------|-------------|
| Word Overlap | 25% | Jaccard-like similarity of words |
| Sequential Match | 30% | Words appearing in same order |
| Keyword Match | 15% | Additional keywords found in title |
| Brand Match | 15% | Known brand name presence |
| Price Reasonable | 15% | Price vs median of all results |

### Confidence Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 80-100 | High | Very likely correct product |
| 60-79 | Medium | Probably correct, verify |
| 40-59 | Low | May be related product |
| 0-39 | Very Low | Likely wrong product |

### Example Scoring

```javascript
import { calculateMatchScore } from './search/product-matcher.js';

const score = calculateMatchScore({
    query: 'iPhone 15 Pro Max 256GB',
    keywords: ['unlocked', 'blue'],
    productTitle: 'Apple iPhone 15 Pro Max 256GB Blue Titanium - Unlocked',
    productPrice: 1199,
    productBrand: 'Apple',
    expectedPrice: 1199,
});

// Result:
// {
//   score: 87.5,
//   confidence: 'high',
//   components: {
//     wordOverlap: 0.85,
//     sequentialMatch: 0.90,
//     keywordMatch: 1.0,
//     brandMatch: 1.0,
//     priceReasonable: 0.8
//   }
// }
```

## Supported E-Commerce Sites

The system has optimized selectors for these sites:

### Tier 1 (Full Support)
- **Amazon** - Existing dedicated scraper
- **Burton** - Existing dedicated scraper

### Tier 2 (Optimized Selectors)
- Walmart
- Target
- Best Buy
- eBay

### Tier 3 (Generic Extraction)
- REI
- Backcountry
- Nordstrom
- Any site with Schema.org/JSON-LD markup

### Adding New Sites

```javascript
import { registerSite } from './search/site-registry.js';

registerSite('newsite', {
    name: 'New Site',
    domains: ['newsite.com'],
    selectors: {
        title: ['h1.product-title', '.product-name'],
        price: ['.price', '.product-price'],
        availability: ['.stock-status'],
    },
    rateLimit: { minDelay: 2000, maxDelay: 4000 },
});
```

## Rate Limiting

Search operations respect per-site rate limits:

| Site | Min Delay | Max Delay |
|------|-----------|-----------|
| Amazon | 2000ms | 5000ms |
| Burton | 1000ms | 3000ms |
| Walmart | 2000ms | 4000ms |
| DuckDuckGo | 2000ms | 5000ms |
| Generic | 2000ms | 5000ms |

## Error Handling

### Search Failures
- Retries up to 3 times with exponential backoff
- Falls back to simpler query if no results
- Records failure count in database

### Scrape Failures
- Retries with different proxy
- Continues to next URL on failure
- Circuit breaker after 3 consecutive failures

### Monitoring
- All errors logged via pino logger
- Metrics recorded for Prometheus
- Failed products rescheduled for next cycle

## Metrics

New Prometheus metrics for search monitoring:

```
price_tracker_search_attempts_total{status="success|failure"}
price_tracker_search_duration_seconds
price_tracker_search_results_found
price_tracker_match_confidence_score
```

## Migration

Run the migration to add new columns and tables:

```bash
# Using npm script
npm run migrate

# Or directly
psql -d price_tracker -U your_user -f src/db/migrations/004_search_based_tracking.sql
```

## Backward Compatibility

The new system works alongside the existing URL-based tracking:

- Existing `tracked_products` with URLs continue to work
- New products can use `tracking_mode = 'search'`
- Both monitors can run simultaneously
- Database supports both modes

## Example Output

### CLI Search Output

```
🔍 Searching for: "Nintendo Switch OLED"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Found 4 products in 12.3s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 BEST MATCH:
   Title: Nintendo Switch OLED Model - White...
   Price: $349.00
   Store: Amazon
   Match Score: 92%
   URL: https://amazon.com/dp/B098...

💰 PRICE COMPARISON:
   Lowest:  $339.00
   Highest: $379.99
   Average: $354.50
   💸 Potential savings: $40.99 (10.8%)

📊 ALL PRICES:
   ✓ Walmart         $339.00
   ✓ Amazon          $349.00
   ✓ Target          $349.99
   ✓ Best Buy        $379.99
```

## Troubleshooting

### No Results Found

1. Check if proxies are working: `node src/cli/check-pool.js`
2. Try simpler product name
3. Check if DuckDuckGo is accessible
4. Review logs for blocked requests

### Low Match Scores

1. Add more specific keywords
2. Include brand name in search
3. Check if product exists on tracked sites

### Slow Performance

1. Reduce `maxResults` option
2. Increase delays between scrapes
3. Check browser pool size
4. Verify proxy latency

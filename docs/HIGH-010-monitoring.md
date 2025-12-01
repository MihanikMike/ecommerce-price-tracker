# HIGH-010: Prometheus Metrics & Grafana Dashboard

## Overview

This task implemented comprehensive monitoring for the price tracker application using Prometheus for metrics collection and Grafana for visualization.

## Components Created

### 1. Prometheus Metrics (`src/utils/metrics.js`)

A centralized metrics module using the `prom-client` library that exposes 20+ custom metrics across 7 categories:

#### Scraping Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_scrape_attempts_total` | Counter | Total scrape attempts by site and status |
| `price_tracker_scrape_duration_seconds` | Histogram | Time taken for each scrape operation |
| `price_tracker_scrape_errors_total` | Counter | Scrape errors by site and error type |
| `price_tracker_products_scraped_total` | Counter | Total products successfully scraped |

#### Price Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_current_price` | Gauge | Current price per product |
| `price_tracker_price_changes_total` | Counter | Price changes detected |
| `price_tracker_price_drop_alerts_total` | Counter | Price drop alerts triggered |

#### Browser Pool Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_browser_pool_size` | Gauge | Current browser pool size |
| `price_tracker_browser_pool_available` | Gauge | Available browsers in pool |
| `price_tracker_browser_pool_waiting` | Gauge | Requests waiting for browser |
| `price_tracker_browser_acquisitions_total` | Counter | Browser acquisition attempts |
| `price_tracker_browser_acquisition_duration_seconds` | Histogram | Time to acquire a browser |

#### Proxy Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_proxy_pool_size` | Gauge | Available proxies in pool |
| `price_tracker_proxy_requests_total` | Counter | Proxy usage by status |
| `price_tracker_proxy_refresh_total` | Counter | Proxy list refresh operations |

#### Rate Limiting Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_rate_limit_delays_total` | Counter | Rate limit delays applied |
| `price_tracker_rate_limit_delay_seconds` | Histogram | Duration of rate limit delays |

#### Database Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_db_pool_total_connections` | Gauge | Total DB pool connections |
| `price_tracker_db_pool_idle_connections` | Gauge | Idle DB connections |
| `price_tracker_db_pool_waiting_connections` | Gauge | Waiting DB connections |
| `price_tracker_db_queries_total` | Counter | Database queries by operation |
| `price_tracker_db_query_duration_seconds` | Histogram | Query execution time |

#### Monitoring Cycle Metrics
| Metric | Type | Description |
|--------|------|-------------|
| `price_tracker_monitoring_cycles_total` | Counter | Completed monitoring cycles |
| `price_tracker_monitoring_cycle_duration_seconds` | Histogram | Cycle duration |
| `price_tracker_last_successful_cycle_timestamp` | Gauge | Last successful cycle time |

### 2. Health Server Endpoints (`src/server/health-server.js`)

Enhanced the health server with Prometheus metrics endpoint:

| Endpoint | Purpose |
|----------|---------|
| `GET /metrics` | Prometheus-format metrics (text/plain) |
| `GET /metrics/json` | JSON-format metrics for debugging |
| `GET /health` | Comprehensive health check |
| `GET /ready` | Kubernetes readiness probe |
| `GET /live` | Kubernetes liveness probe |

### 3. Docker Compose Stack (`docker-compose.yml`)

Production-ready monitoring infrastructure:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    # 30-day retention, auto-reload enabled
    
  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    # Pre-configured datasources and dashboards
```

### 4. Prometheus Configuration (`monitoring/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'price-tracker'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: /metrics
```

### 5. Grafana Provisioning

#### Datasource (`monitoring/grafana/provisioning/datasources/prometheus.yml`)
- Auto-configured Prometheus datasource
- Points to `http://prometheus:9090`

#### Dashboard (`monitoring/grafana/provisioning/dashboards/price-tracker.json`)
Pre-built dashboard with 12 panels:

1. **Scrape Success Rate** - Gauge showing % of successful scrapes
2. **Total Products Scraped** - Counter of products processed
3. **Active Browser Pool** - Current browser utilization
4. **Available Proxies** - Proxy pool health
5. **Scrape Rate by Site** - Rate of scrapes per site
6. **Scrape Duration Heatmap** - Latency distribution
7. **Price Changes Over Time** - Trend of detected changes
8. **Browser Pool Metrics** - Pool size/available/waiting
9. **Proxy Health** - Success/failure rates
10. **Rate Limit Delays** - Applied delays by site
11. **Database Connections** - Pool utilization
12. **Monitoring Cycle Duration** - End-to-end cycle time

## Usage

### Starting the Monitoring Stack

```bash
# Start Prometheus and Grafana
docker compose up -d

# View logs
docker compose logs -f
```

### Accessing Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://localhost:9090 | None required |
| Grafana | http://localhost:3001 | admin / pricetracker123 |

### Starting the Price Tracker with Metrics

```bash
# The health server starts automatically with the app
npm start

# Metrics available at
curl http://localhost:3000/metrics
```

## Integration Points

### Recording Metrics in Code

```javascript
import { 
  recordScrape, 
  recordPriceChange,
  recordBrowserAcquisition 
} from '../utils/metrics.js';

// Record a successful scrape
recordScrape('amazon', true, 2.5);

// Record a price change
recordPriceChange('amazon', 'B001234', 99.99, 89.99);

// Record browser acquisition
recordBrowserAcquisition(true, 0.15);
```

### Updating Pool Metrics

```javascript
import { 
  updateBrowserPoolMetrics,
  updateProxyPoolMetrics,
  updateDbPoolMetrics 
} from '../utils/metrics.js';

// Called periodically or on state changes
updateBrowserPoolMetrics(3, 2, 0);
updateProxyPoolMetrics(45);
updateDbPoolMetrics(10, 8, 0);
```

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/metrics.js` | Created | Prometheus metrics definitions |
| `src/server/health-server.js` | Modified | Added /metrics endpoint |
| `src/monitor/price-monitor.js` | Modified | Integrated metric recording |
| `docker-compose.yml` | Created | Monitoring stack |
| `monitoring/prometheus.yml` | Created | Prometheus config |
| `monitoring/grafana/provisioning/datasources/prometheus.yml` | Created | Grafana datasource |
| `monitoring/grafana/provisioning/dashboards/dashboard.yml` | Created | Dashboard provisioning |
| `monitoring/grafana/provisioning/dashboards/price-tracker.json` | Created | Pre-built dashboard |

## Dependencies Added

```json
{
  "prom-client": "^15.1.0"
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Price Tracker App                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Scraper    │  │  Monitor    │  │  Health Server      │  │
│  │             │  │             │  │  :3000              │  │
│  └──────┬──────┘  └──────┬──────┘  │  /metrics ──────────┼──┼───┐
│         │                │         │  /health            │  │   │
│         └────────┬───────┘         │  /ready             │  │   │
│                  │                 │  /live              │  │   │
│                  ▼                 └─────────────────────┘  │   │
│         ┌────────────────┐                                  │   │
│         │  metrics.js    │                                  │   │
│         │  (prom-client) │                                  │   │
│         └────────────────┘                                  │   │
└─────────────────────────────────────────────────────────────┘   │
                                                                   │
┌─────────────────────────────────────────────────────────────┐   │
│                    Docker Compose Stack                      │   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │   │
│  │     Prometheus      │    │          Grafana            │ │   │
│  │     :9090           │◄───│          :3001              │ │   │
│  │                     │    │                             │ │   │
│  │  scrape_configs:    │    │  Dashboards:                │ │   │
│  │  - price-tracker ◄──┼────┼──────────────────────────────┼─┼───┘
│  │                     │    │  - Scrape Success Rate      │ │
│  │  retention: 30d     │    │  - Browser Pool Metrics     │ │
│  │                     │    │  - Proxy Health             │ │
│  └─────────────────────┘    │  - Database Connections     │ │
│                             │  - Price Changes            │ │
│                             └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Alerting (Future Enhancement)

The metrics are ready for alerting. Example Prometheus alert rules:

```yaml
groups:
  - name: price-tracker
    rules:
      - alert: HighScrapeErrorRate
        expr: rate(price_tracker_scrape_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High scrape error rate detected"

      - alert: BrowserPoolExhausted
        expr: price_tracker_browser_pool_available == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "No browsers available in pool"

      - alert: ProxyPoolLow
        expr: price_tracker_proxy_pool_size < 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Proxy pool running low"
```

## Troubleshooting

### Metrics not appearing in Prometheus

1. Check the health server is running: `curl http://localhost:3000/health`
2. Verify Prometheus can reach the app: Check Prometheus targets at `http://localhost:9090/targets`
3. Ensure `host.docker.internal` resolves (Linux may need `extra_hosts` in docker-compose)

### Grafana dashboard empty

1. Verify Prometheus datasource is working (Settings → Data Sources → Prometheus → Test)
2. Check time range in Grafana (may need to adjust to when app was running)
3. Ensure the price tracker has been running to generate metrics

### Docker networking issues on Linux

If Prometheus can't reach `host.docker.internal`:

```yaml
# Already configured in docker-compose.yml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

# Project Roadmap

**Last Updated:** December 3, 2025

This document outlines the planned features and improvements for the E-Commerce Price Tracker project.

---

## Vision

Build a comprehensive, self-hosted price tracking solution that:
- Tracks prices across multiple e-commerce sites
- Provides actionable insights through a beautiful dashboard
- Sends timely alerts for price drops
- Scales from personal use to team deployments

---

## Current Status

### ✅ Completed (v1.0)

#### Core Features
- [x] Price scraping with Playwright
- [x] PostgreSQL database with migrations
- [x] URL-based product tracking
- [x] Search-based product tracking
- [x] Price history storage
- [x] REST API server

#### Sites Supported
- [x] Amazon (US)
- [x] Burton

#### Dashboard (Frontend)
- [x] React 18 + Vite setup
- [x] Dark/Light theme toggle
- [x] Dashboard with real-time stats
- [x] Products list with pagination
- [x] Product detail with Chart.js price history
- [x] Tracked products management
- [x] Add product modal (URL + Search)

#### Infrastructure
- [x] Docker support
- [x] Redis caching
- [x] Prometheus metrics
- [x] Structured logging (Pino)
- [x] Health checks

---

## 🚧 In Progress (v1.1)

### Q1 2026

#### Dashboard Enhancements
- [ ] Price drops page with filters
- [ ] Product comparison tool
- [ ] Settings/Configuration page
- [ ] Cache management UI
- [ ] Export functionality (CSV, JSON)

#### Email Alerts
- [ ] Email notification service
- [ ] Custom alert thresholds
- [ ] Digest emails (daily/weekly)
- [ ] Alert history page

#### New Sites
- [ ] Walmart (US)
- [ ] Target (US)
- [ ] Best Buy (US)

---

## 📋 Planned (v1.2)

### Q2 2026

#### Features
- [ ] User authentication
- [ ] Multi-user support
- [ ] Browser extension for easy tracking
- [ ] Mobile-responsive improvements
- [ ] PWA support

#### Sites
- [ ] eBay
- [ ] Newegg
- [ ] B&H Photo

#### Technical
- [ ] WebSocket real-time updates
- [ ] Background job queue (Bull)
- [ ] API rate limiting
- [ ] Audit logging

---

## 🔮 Future (v2.0+)

### Later 2026

#### Advanced Features
- [ ] Price predictions (ML)
- [ ] Deal scoring algorithm
- [ ] Price alerts via SMS/Push
- [ ] Slack/Discord integrations
- [ ] Zapier/IFTTT webhooks

#### International Expansion
- [ ] Amazon UK, DE, JP
- [ ] Currency conversion
- [ ] Regional price comparison

#### Enterprise Features
- [ ] Team workspaces
- [ ] Role-based access control
- [ ] SSO integration
- [ ] API keys for external access
- [ ] White-label options

---

## Feature Requests

### Community Requested

| Feature | Votes | Status |
|---------|-------|--------|
| Walmart support | 15 | In Progress |
| Mobile app | 12 | Evaluating |
| Price history export | 8 | Planned |
| Browser extension | 7 | Planned |
| Telegram notifications | 5 | Considering |

Vote on features by adding 👍 to the GitHub issue!

---

## Release Schedule

| Version | Target Date | Focus |
|---------|-------------|-------|
| v1.0.0 | ✅ Dec 2025 | Core functionality |
| v1.1.0 | Feb 2026 | Dashboard + Alerts |
| v1.2.0 | May 2026 | Auth + Extensions |
| v2.0.0 | Q4 2026 | Advanced features |

---

## How to Influence the Roadmap

1. **Vote on issues** - Add 👍 to features you want
2. **Create feature requests** - Describe your use case
3. **Contribute** - Help implement features
4. **Sponsor** - Support development financially
5. **Spread the word** - Star the repo, share with others

---

## Technical Debt

Items to address for long-term maintainability:

- [ ] Increase test coverage to 80%+
- [ ] Add E2E tests with Playwright
- [ ] Improve error handling consistency
- [ ] Add OpenAPI/Swagger documentation
- [ ] Set up CI/CD pipeline
- [ ] Add database connection pooling improvements
- [ ] Optimize Docker image size

---

## Non-Goals

Things we've decided **not** to pursue:

- Native mobile apps (PWA preferred)
- Support for non-product pages (category, search)
- Real-time bidding sites (eBay auctions)
- Cryptocurrency/NFT tracking
- Social features (sharing, following)

---

## Changelog

### December 2025
- Added roadmap document
- Completed Phase 2 frontend work
- Added Chart.js integration

### November 2025
- Initial release
- Core scraping functionality
- PostgreSQL integration
- Docker support

---

## Get Involved

- 🐛 [Report bugs](https://github.com/MihanikMike/ecommerce-price-tracker/issues/new?template=bug_report.md)
- ✨ [Request features](https://github.com/MihanikMike/ecommerce-price-tracker/issues/new?template=feature_request.md)
- 🤝 [Contribute code](./CONTRIBUTING.md)
- 💬 [Join discussions](https://github.com/MihanikMike/ecommerce-price-tracker/discussions)

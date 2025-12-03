# Frontend Web Dashboard Plan

**Project:** E-Commerce Price Tracker  
**Created:** December 1, 2025  
**Status:** 📋 Planning

---

## Overview

This document outlines the architecture and implementation plan for adding a web dashboard frontend to the price tracker application.

---

## CORS Middleware - Do We Need It?

**It depends on your deployment architecture:**

| Architecture | CORS Needed? | Description |
|-------------|--------------|-------------|
| **Same Origin** | ❌ No | Frontend served from same server (port 3001) |
| **Different Ports** | ✅ Yes | Frontend on :3000, API on :3001 |
| **Different Domains** | ✅ Yes | Frontend on app.example.com, API on api.example.com |
| **Reverse Proxy** | ❌ No | Nginx/Traefik proxies both to same domain |

---

## Architecture Options

### Option 1: Static Files from API Server (Simplest - No CORS)

```
┌─────────────────────────────────────────┐
│         API Server (:3001)              │
│  ┌─────────────────────────────────┐    │
│  │  /api/*     → REST endpoints    │    │
│  │  /          → Dashboard (React) │    │
│  │  /chart.html → Chart UI         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Pros:**
- Simple deployment
- No CORS configuration needed
- Single container/process
- Works with existing Docker setup

**Cons:**
- Tightly coupled frontend and backend
- Must rebuild backend to update frontend

**Implementation:**
```javascript
// In api-server.js - already partially implemented
app.use(express.static('public'));  // Serve built React app
```

---

### Option 2: Separate Frontend with CORS (More Flexible)

```
┌──────────────────┐     ┌──────────────────┐
│  Frontend (:3000)│────▶│  API (:3001)     │
│  React/Vue/etc   │     │  + CORS enabled  │
└──────────────────┘     └──────────────────┘
```

**Pros:**
- Independent deployments
- Separate scaling
- Hot reload during development
- Different tech stacks possible

**Cons:**
- Requires CORS middleware
- Two processes to manage
- More complex deployment

**CORS Implementation:**
```javascript
// Install: npm install cors
import cors from 'cors';

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',  // Vite dev server
    process.env.FRONTEND_URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

---

### Option 3: Reverse Proxy (Production - No CORS)

```
┌─────────────────────────────────────────┐
│            Nginx (:80/:443)             │
│  ┌─────────────────────────────────┐    │
│  │  /api/*  → API Server (:3001)   │    │
│  │  /*      → Frontend (:3000)     │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Pros:**
- No CORS needed (same origin)
- SSL termination at proxy
- Static file caching
- Load balancing ready

**Cons:**
- Additional infrastructure
- More configuration

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name price-tracker.example.com;

    # Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # API
    location /api {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Recommended Approach

**For this project: Option 1 (Static Files)** is recommended because:

1. ✅ Already serving static files (`/chart.html`) from the API server
2. ✅ Simpler deployment (single container)
3. ✅ No CORS complexity
4. ✅ Works with existing Docker setup
5. ✅ Easier for small team maintenance

---

## Proposed Tech Stack

| Component | Technology | Reason |
|-----------|------------|--------|
| **Framework** | React 18 | Modern, large ecosystem, component-based |
| **Build Tool** | Vite | Fast builds, HMR, simple config |
| **Styling** | Tailwind CSS | Utility-first, matches existing dark theme |
| **Charts** | Chart.js | Already integrated in project |
| **State Management** | React Query (TanStack) | Server state, caching, auto-refresh |
| **Routing** | React Router v6 | SPA navigation |
| **HTTP Client** | Axios or fetch | API communication |
| **Icons** | Lucide React | Modern icon set |
| **Tables** | TanStack Table | Sorting, filtering, pagination |

---

## Dashboard Pages Structure

```
📊 Dashboard Pages
│
├── / (Home/Dashboard)
│   ├── Stats overview cards (products, tracked, price changes)
│   ├── Recent price drops (top 5)
│   ├── System health status
│   └── Quick action buttons
│
├── /products
│   ├── Product list with DataTable
│   ├── Search by title/URL
│   ├── Filter by site
│   ├── Sort by price/date
│   ├── Pagination
│   └── Bulk actions
│
├── /products/:id
│   ├── Product details header
│   ├── Price chart (interactive)
│   ├── Price statistics cards
│   ├── Price history table
│   ├── Related tracked item
│   └── Actions (delete, start tracking)
│
├── /tracked
│   ├── Tracked products list
│   ├── Add new product modal
│   │   ├── URL-based tracking
│   │   └── Search-based tracking
│   ├── Enable/disable toggles
│   ├── Edit check intervals
│   └── Delete tracked items
│
├── /price-drops
│   ├── Best deals grid/list view
│   ├── Time range selector (24h, 7d, 30d)
│   ├── Minimum drop % filter
│   ├── Site filter
│   └── Sort by drop amount
│
├── /compare
│   ├── Product multi-select
│   ├── Side-by-side comparison table
│   ├── Overlay price chart
│   └── Export comparison
│
├── /alerts
│   ├── Price alert history
│   ├── Email configuration
│   ├── Alert thresholds
│   └── Test email button
│
└── /settings
    ├── Cache management
    │   ├── Cache stats display
    │   └── Clear cache buttons
    ├── System configuration view
    ├── Database stats
    └── About/version info
```

---

## Component Architecture

```
src/
├── components/
│   ├── common/
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Modal.jsx
│   │   ├── Table.jsx
│   │   ├── Pagination.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── ErrorBoundary.jsx
│   │
│   ├── layout/
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   └── Layout.jsx
│   │
│   ├── products/
│   │   ├── ProductList.jsx
│   │   ├── ProductCard.jsx
│   │   ├── ProductDetails.jsx
│   │   └── ProductFilters.jsx
│   │
│   ├── charts/
│   │   ├── PriceChart.jsx
│   │   ├── ComparisonChart.jsx
│   │   ├── StatsCards.jsx
│   │   └── ChartControls.jsx
│   │
│   ├── tracked/
│   │   ├── TrackedList.jsx
│   │   ├── AddTrackedModal.jsx
│   │   └── TrackedItem.jsx
│   │
│   └── dashboard/
│       ├── StatsOverview.jsx
│       ├── RecentDrops.jsx
│       └── QuickActions.jsx
│
├── pages/
│   ├── Dashboard.jsx
│   ├── Products.jsx
│   ├── ProductDetail.jsx
│   ├── Tracked.jsx
│   ├── PriceDrops.jsx
│   ├── Compare.jsx
│   ├── Alerts.jsx
│   └── Settings.jsx
│
├── hooks/
│   ├── useProducts.js
│   ├── useTracked.js
│   ├── usePriceChanges.js
│   ├── useChartData.js
│   └── useCache.js
│
├── services/
│   └── api.js          # API client
│
├── utils/
│   ├── formatters.js   # Price, date formatting
│   └── constants.js
│
├── App.jsx
├── main.jsx
└── index.css           # Tailwind imports
```

---

## API Integration Examples

### React Query Hooks

```javascript
// hooks/useProducts.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export function useProducts(page = 1, limit = 20, site = null) {
  return useQuery({
    queryKey: ['products', { page, limit, site }],
    queryFn: () => api.getProducts({ page, limit, site }),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useProduct(id) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => api.getProduct(id),
    enabled: !!id,
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
    },
  });
}
```

### API Service

```javascript
// services/api.js
const API_BASE = '/api';

const api = {
  // Products
  getProducts: async ({ page, limit, site }) => {
    const params = new URLSearchParams({ page, limit });
    if (site) params.append('site', site);
    const res = await fetch(`${API_BASE}/products?${params}`);
    return res.json();
  },
  
  getProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`);
    return res.json();
  },
  
  deleteProduct: async (id) => {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    return res.json();
  },
  
  // Charts
  getChartData: async (id, range = '30d') => {
    const res = await fetch(`${API_BASE}/charts/product/${id}?range=${range}`);
    return res.json();
  },
  
  // Tracked
  getTracked: async ({ page, limit, mode, enabled }) => {
    const params = new URLSearchParams({ page, limit });
    if (mode) params.append('mode', mode);
    if (enabled !== undefined) params.append('enabled', enabled);
    const res = await fetch(`${API_BASE}/tracked?${params}`);
    return res.json();
  },
  
  addTracked: async (data) => {
    const res = await fetch(`${API_BASE}/tracked`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  
  // Stats
  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },
  
  // Cache
  getCacheStats: async () => {
    const res = await fetch(`${API_BASE}/cache/stats`);
    return res.json();
  },
  
  clearCache: async () => {
    const res = await fetch(`${API_BASE}/cache`, { method: 'DELETE' });
    return res.json();
  },
};

export default api;
```

---

## UI Design Guidelines

### Color Palette (Dark Theme)

```css
:root {
  --bg-primary: #0f172a;      /* slate-900 */
  --bg-secondary: #1e293b;    /* slate-800 */
  --bg-card: #334155;         /* slate-700 */
  --text-primary: #f8fafc;    /* slate-50 */
  --text-secondary: #94a3b8;  /* slate-400 */
  --accent-primary: #6366f1;  /* indigo-500 */
  --accent-success: #10b981;  /* emerald-500 */
  --accent-warning: #f59e0b;  /* amber-500 */
  --accent-danger: #ef4444;   /* red-500 */
}
```

### Component Examples

```jsx
// Stats Card
<div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-slate-400 text-sm">Total Products</p>
      <p className="text-3xl font-bold text-white">1,234</p>
    </div>
    <div className="p-3 bg-indigo-500/20 rounded-lg">
      <Package className="h-6 w-6 text-indigo-400" />
    </div>
  </div>
</div>

// Price Drop Badge
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
  <TrendingDown className="h-3 w-3 mr-1" />
  -12.5%
</span>
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1) ✅ COMPLETED - December 2, 2025
- [x] Initialize Vite + React project in `/frontend`
- [x] Set up Tailwind CSS with dark theme
- [x] Create basic layout (sidebar, header)
- [x] Set up React Router
- [x] Configure React Query
- [x] Create API service module

### Phase 2: Core Pages (Week 2)
- [ ] Dashboard with stats cards
- [ ] Products list with pagination
- [ ] Product detail page with existing chart
- [ ] Tracked products list
- [ ] Add tracked product modal

### Phase 3: Features (Week 3)
- [ ] Price drops page
- [ ] Product comparison
- [ ] Search and filtering
- [ ] Settings page
- [ ] Cache management UI

### Phase 4: Polish (Week 4)
- [ ] Loading states and skeletons
- [ ] Error handling and toasts
- [ ] Responsive design
- [ ] Accessibility improvements
- [ ] Build optimization

---

## Build & Deployment

### Development

```bash
cd frontend
npm install
npm run dev        # Starts Vite dev server on :5173

```

### Production Build

```bash
cd frontend
npm run build      # Outputs to frontend/dist
```

### Integration with API Server

```javascript
// In api-server.js
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve React app from frontend/dist
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  }
});
```

### Docker Multi-Stage Build

```dockerfile
# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/

# Final image
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app ./
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3001
CMD ["node", "src/index.js"]
```

---

## Next Steps

1. **Decide on architecture** - Option 1 (static) recommended
2. **Initialize frontend project** - `npm create vite@latest frontend -- --template react`
3. **Start with Layout + Dashboard** - Get basic structure working
4. **Iterate on pages** - Build out each page incrementally

---

## Questions to Consider

- [ ] Do we need user authentication?
- [ ] Should we support multiple users/tenants?
- [ ] Do we need real-time updates (WebSocket)?
- [ ] Mobile app in the future?
- [ ] PWA capabilities needed?

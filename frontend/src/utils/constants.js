// API Configuration
export const API_BASE_URL = '/api';

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Time ranges for charts
export const TIME_RANGES = [
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

// Supported sites
export const SUPPORTED_SITES = [
  { value: 'amazon', label: 'Amazon' },
  { value: 'burton', label: 'Burton' },
];

// Tracking modes
export const TRACKING_MODES = [
  { value: 'url', label: 'URL Based' },
  { value: 'search', label: 'Search Based' },
];

// Chart colors
export const CHART_COLORS = {
  primary: '#6366f1',    // indigo-500
  secondary: '#94a3b8',  // slate-400
  success: '#10b981',    // emerald-500
  warning: '#f59e0b',    // amber-500
  danger: '#ef4444',     // red-500
  background: '#1e293b', // slate-800
  grid: '#334155',       // slate-700
};

// Price change thresholds (for highlighting)
export const PRICE_THRESHOLDS = {
  significantDrop: -10,   // 10% drop or more
  moderateDrop: -5,       // 5% drop or more
  significantRise: 10,    // 10% rise or more
  moderateRise: 5,        // 5% rise or more
};

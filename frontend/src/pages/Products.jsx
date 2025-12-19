import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  Package, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Trash2,
  Clock,
  ArrowUpDown,
  X,
  SlidersHorizontal,
  DollarSign,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { Card, Button, TableRowSkeleton } from '../components/common';
import { SearchInput, Select, Input } from '../components/common/Input';
import { PriceChangeBadge, SiteBadge, Badge } from '../components/common/Badge';
import { useProducts, useDeleteProduct } from '../hooks/useProducts';
import { useToast } from '../context/ToastContext';
import { formatPrice, formatRelativeTime, truncate } from '../utils/formatters';

// Product row component
function ProductRow({ product, index, onDelete }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'group border-b border-slate-800/50',
        'hover:bg-slate-800/30 transition-colors duration-200'
      )}
    >
      {/* Product Info */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'h-10 w-10 rounded-lg flex-shrink-0',
            'bg-gradient-to-br from-slate-700/50 to-slate-800/50',
            'border border-slate-700/50',
            'flex items-center justify-center'
          )}>
            <Package className="h-5 w-5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <Link 
              to={`/products/${product.id}`}
              className="text-sm font-medium text-white hover:text-indigo-400 transition-colors line-clamp-1"
            >
              {truncate(product.title, 50)}
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <SiteBadge site={product.site} />
              {product.isTracked && (
                <Badge variant="primary" size="sm">Tracked</Badge>
              )}
              {product.priceCount > 1 && (
                <Badge variant="secondary" size="sm">{product.priceCount} records</Badge>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Current Price */}
      <td className="py-4 px-4">
        <span className="text-sm font-semibold text-white">
          {formatPrice(product.currentPrice)}
        </span>
      </td>

      {/* Price Change */}
      <td className="py-4 px-4">
        <PriceChangeBadge change={product.priceChange || 0} />
      </td>

      {/* Last Updated */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-1.5 text-slate-400 text-sm">
          <Clock className="h-3.5 w-3.5" />
          {formatRelativeTime(product.lastChecked)}
        </div>
      </td>

      {/* Actions */}
      <td className="py-4 px-4">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link to={`/products/${product.id}`}>
            <Button variant="ghost" size="sm" icon={Eye}>
              View
            </Button>
          </Link>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className={clsx(
                    'absolute right-0 top-full mt-1 z-10',
                    'w-40 py-1 rounded-xl',
                    'bg-slate-800 border border-slate-700/50',
                    'shadow-xl shadow-black/30'
                  )}
                >
                  <a 
                    href={product.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit URL
                  </a>
                  <button 
                    onClick={() => {
                      setShowActions(false);
                      onDelete(product.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-slate-700/50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

// Empty state component
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16"
    >
      <div className={clsx(
        'mx-auto w-20 h-20 rounded-2xl',
        'bg-gradient-to-br from-slate-700/50 to-slate-800/50',
        'border border-slate-700/50',
        'flex items-center justify-center mb-4'
      )}>
        <Package className="h-10 w-10 text-slate-500" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">No products found</h3>
      <p className="text-slate-500 max-w-sm mx-auto">
        Start tracking products to see them here. Add a product by URL or search.
      </p>
      <div className="mt-6">
        <Link to="/tracked">
          <Button variant="primary">
            Add Your First Product
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

// Pagination component
function Pagination({ currentPage, totalPages, total, onPageChange }) {
  const startItem = (currentPage - 1) * 20 + 1;
  const endItem = Math.min(currentPage * 20, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/50">
      <div className="text-sm text-slate-500">
        Showing {startItem}-{endItem} of {total} products
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          icon={ChevronLeft}
        >
          Previous
        </Button>
        
        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                  pageNum === currentPage
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          icon={ChevronRight}
          iconPosition="right"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// Advanced filters panel
function AdvancedFilters({ filters, setFilters, onClear }) {
  const hasActiveFilters = filters.minPrice || filters.maxPrice || filters.dateRange !== 'all';
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-slate-800/50"
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <SlidersHorizontal className="h-4 w-4" />
            Advanced Filters
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Price Range */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Price Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice}
                onChange={(e) => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-slate-800/50 border border-slate-700/50',
                  'text-white placeholder-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
                )}
              />
              <span className="text-slate-500">-</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice}
                onChange={(e) => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-slate-800/50 border border-slate-700/50',
                  'text-white placeholder-slate-500',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
                )}
              />
            </div>
          </div>
          
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Last Updated
            </label>
            <Select
              options={[
                { value: 'all', label: 'All Time' },
                { value: '24h', label: 'Last 24 Hours' },
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
                { value: '90d', label: 'Last 90 Days' },
              ]}
              value={filters.dateRange}
              onChange={(e) => setFilters(f => ({ ...f, dateRange: e.target.value }))}
            />
          </div>
          
          {/* Has Price Data */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              Price History
            </label>
            <Select
              options={[
                { value: 'all', label: 'All Products' },
                { value: 'with-history', label: 'Has Price History' },
                { value: 'single', label: 'Single Price Only' },
              ]}
              value={filters.priceHistory}
              onChange={(e) => setFilters(f => ({ ...f, priceHistory: e.target.value }))}
            />
          </div>
          
          {/* Results per page */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              Results Per Page
            </label>
            <Select
              options={[
                { value: '10', label: '10 per page' },
                { value: '20', label: '20 per page' },
                { value: '50', label: '50 per page' },
                { value: '100', label: '100 per page' },
              ]}
              value={String(filters.limit)}
              onChange={(e) => setFilters(f => ({ ...f, limit: parseInt(e.target.value) }))}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    minPrice: '',
    maxPrice: '',
    dateRange: 'all',
    priceHistory: 'all',
    limit: 20,
  });

  const { data, isLoading, refetch, isFetching } = useProducts(page, advancedFilters.limit, siteFilter || null);
  const { addToast } = useToast();
  const deleteProduct = useDeleteProduct({
    onSuccess: () => {
      addToast('Product deleted successfully', 'success');
    },
    onError: (error) => {
      addToast(`Failed to delete product: ${error.message}`, 'error');
    },
  });
  
  // API returns { products: [], pagination: {} }
  const products = data?.products || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Apply client-side filtering and sorting
  const processedProducts = useMemo(() => {
    let filtered = [...products];
    
    // Search filter
    if (search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(p => 
        p.title?.toLowerCase().includes(query) ||
        p.url?.toLowerCase().includes(query)
      );
    }
    
    // Price range filter
    if (advancedFilters.minPrice) {
      const min = parseFloat(advancedFilters.minPrice);
      filtered = filtered.filter(p => (p.latest_price || 0) >= min);
    }
    if (advancedFilters.maxPrice) {
      const max = parseFloat(advancedFilters.maxPrice);
      filtered = filtered.filter(p => (p.latest_price || Infinity) <= max);
    }
    
    // Date range filter
    if (advancedFilters.dateRange !== 'all') {
      const now = new Date();
      let cutoff;
      switch (advancedFilters.dateRange) {
        case '24h': cutoff = new Date(now - 24 * 60 * 60 * 1000); break;
        case '7d': cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': cutoff = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
        default: cutoff = null;
      }
      if (cutoff) {
        filtered = filtered.filter(p => {
          const date = new Date(p.price_captured_at || p.last_seen_at);
          return date >= cutoff;
        });
      }
    }
    
    // Price history filter
    if (advancedFilters.priceHistory === 'with-history') {
      filtered = filtered.filter(p => (p.price_count || 0) > 1);
    } else if (advancedFilters.priceHistory === 'single') {
      filtered = filtered.filter(p => (p.price_count || 0) <= 1);
    }
    
    // Sort
    switch (sortBy) {
      case 'price-asc':
        filtered.sort((a, b) => (a.latest_price || 0) - (b.latest_price || 0));
        break;
      case 'price-desc':
        filtered.sort((a, b) => (b.latest_price || 0) - (a.latest_price || 0));
        break;
      case 'name':
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'updated':
      default:
        filtered.sort((a, b) => {
          const dateA = new Date(a.price_captured_at || a.last_seen_at || 0);
          const dateB = new Date(b.price_captured_at || b.last_seen_at || 0);
          return dateB - dateA;
        });
        break;
    }
    
    return filtered;
  }, [products, search, sortBy, advancedFilters]);

  // Map API response fields to component expected fields
  const mappedProducts = processedProducts.map(p => ({
    id: p.id,
    title: p.title,
    site: p.site,
    url: p.url,
    currentPrice: p.latest_price,
    currency: p.currency,
    priceChange: 0,
    lastChecked: p.price_captured_at || p.last_seen_at,
    priceCount: p.price_count,
    isTracked: false,
  }));

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      deleteProduct.mutate(id);
    }
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      minPrice: '',
      maxPrice: '',
      dateRange: 'all',
      priceHistory: 'all',
      limit: 20,
    });
  };

  const activeFiltersCount = [
    advancedFilters.minPrice,
    advancedFilters.maxPrice,
    advancedFilters.dateRange !== 'all',
    advancedFilters.priceHistory !== 'all',
  ].filter(Boolean).length;

  const siteOptions = [
    { value: '', label: 'All Sites' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'burton', label: 'Burton' },
  ];

  const sortOptions = [
    { value: 'updated', label: 'Last Updated' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'name', label: 'Name A-Z' },
  ];

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-slate-400 mt-1">
            {pagination.total} products tracked across all sites
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => refetch()}
            loading={isFetching}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          <Link to="/tracked">
            <Button variant="primary" icon={Package}>
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or URL..."
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select
                options={siteOptions}
                value={siteFilter}
                onChange={(e) => {
                  setSiteFilter(e.target.value);
                  setPage(1);
                }}
                className="w-36"
              />
              <Select
                options={sortOptions}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-44"
              />
              <Button
                variant={showAdvanced ? 'primary' : 'secondary'}
                onClick={() => setShowAdvanced(!showAdvanced)}
                icon={SlidersHorizontal}
              >
                Filters
                {activeFiltersCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showAdvanced && (
            <AdvancedFilters
              filters={advancedFilters}
              setFilters={setAdvancedFilters}
              onClear={clearAdvancedFilters}
            />
          )}
        </AnimatePresence>

        {/* Results Summary */}
        {(search || activeFiltersCount > 0) && (
          <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-800/50">
            <p className="text-sm text-slate-400">
              Showing {mappedProducts.length} of {pagination.total} products
              {search && <span> matching "<span className="text-white">{search}</span>"</span>}
            </p>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50 text-left">
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <button 
                    onClick={() => setSortBy(sortBy === 'price-asc' ? 'price-desc' : 'price-asc')}
                    className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                  >
                    Price
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Change
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <button 
                    onClick={() => setSortBy('updated')}
                    className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                  >
                    Updated
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/30">
                    <td colSpan={5} className="p-0">
                      <TableRowSkeleton columns={5} />
                    </td>
                  </tr>
                ))
              ) : mappedProducts.length > 0 ? (
                mappedProducts.map((product, index) => (
                  <ProductRow 
                    key={product.id} 
                    product={product} 
                    index={index}
                    onDelete={handleDelete}
                  />
                ))
              ) : null}
            </tbody>
          </table>
          
          {!isLoading && mappedProducts.length === 0 && <EmptyState />}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            onPageChange={setPage}
          />
        )}
      </Card>
    </motion.div>
  );
}

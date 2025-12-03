import { useState } from 'react';
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
  ArrowUpDown
} from 'lucide-react';
import { Card, Button, TableRowSkeleton } from '../components/common';
import { SearchInput, Select } from '../components/common/Input';
import { PriceChangeBadge, SiteBadge, Badge } from '../components/common/Badge';
import { useProducts } from '../hooks/useProducts';
import { formatPrice, formatRelativeTime, truncate } from '../utils/formatters';

// Product row component
function ProductRow({ product, index }) {
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
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-slate-700/50 transition-colors">
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
function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/50">
      <div className="text-sm text-slate-500">
        Page {currentPage} of {totalPages}
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

export default function Products() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [sortBy, setSortBy] = useState('updated');

  const { data, isLoading } = useProducts(page, 20, siteFilter || null);
  
  const products = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  // Filter products by search
  const filteredProducts = products.filter(p => 
    p.title?.toLowerCase().includes(search.toLowerCase())
  );

  const siteOptions = [
    { value: '', label: 'All Sites' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'burton', label: 'Burton' },
  ];

  const sortOptions = [
    { value: 'updated', label: 'Last Updated' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'name', label: 'Name' },
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
        <Link to="/tracked">
          <Button variant="primary" icon={Package}>
            Add Product
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding={false}>
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
              />
            </div>
            <div className="flex gap-3">
              <Select
                options={siteOptions}
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="w-36"
              />
              <Select
                options={sortOptions}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-44"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50 text-left">
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <button className="flex items-center gap-1 hover:text-slate-300 transition-colors">
                    Price
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Change
                </th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Updated
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
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product, index) => (
                  <ProductRow key={product.id} product={product} index={index} />
                ))
              ) : null}
            </tbody>
          </table>
          
          {!isLoading && filteredProducts.length === 0 && <EmptyState />}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        )}
      </Card>
    </motion.div>
  );
}

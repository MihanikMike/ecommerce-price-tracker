import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  Target, 
  Plus, 
  Link as LinkIcon, 
  Search,
  X,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Card, Button, PageLoader, CardSkeleton } from '../components/common';
import { Input, SearchInput, Toggle } from '../components/common/Input';
import { SiteBadge, StatusBadge, Badge } from '../components/common/Badge';
import { useTracked, useAddTracked, useUpdateTracked, useDeleteTracked } from '../hooks/useTracked';
import { formatRelativeTime, truncate } from '../utils/formatters';

// Add Product Modal
function AddProductModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('url'); // 'url' or 'search'
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { mutate: addTracked, isPending } = useAddTracked();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'url' && url) {
      addTracked({ url, mode: 'url' });
      onClose();
    } else if (mode === 'search' && searchQuery) {
      addTracked({ query: searchQuery, mode: 'search' });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={clsx(
          'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-lg',
          'bg-slate-900/95 backdrop-blur-xl',
          'border border-slate-700/50',
          'rounded-2xl shadow-2xl shadow-black/50',
          'overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
          <h2 className="text-lg font-semibold text-white">Add Product to Track</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Mode Tabs */}
          <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('url')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'url' 
                  ? 'bg-indigo-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <LinkIcon className="h-4 w-4" />
              By URL
            </button>
            <button
              type="button"
              onClick={() => setMode('search')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                mode === 'search' 
                  ? 'bg-indigo-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Search className="h-4 w-4" />
              By Search
            </button>
          </div>

          {/* URL Input */}
          {mode === 'url' && (
            <Input
              label="Product URL"
              placeholder="https://www.amazon.com/dp/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              icon={LinkIcon}
            />
          )}

          {/* Search Input */}
          {mode === 'search' && (
            <Input
              label="Search Query"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={Search}
            />
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isPending}
              className="flex-1"
            >
              Add Product
            </Button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}

// Tracked product card
function TrackedProductCard({ product, index }) {
  const { mutate: updateTracked } = useUpdateTracked();
  const { mutate: deleteTracked } = useDeleteTracked();

  const handleToggle = () => {
    updateTracked({ id: product.id, data: { enabled: !product.enabled } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="group">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={clsx(
            'h-12 w-12 rounded-xl flex-shrink-0',
            'bg-gradient-to-br',
            product.enabled 
              ? 'from-indigo-500/20 to-purple-500/10 border-indigo-500/30' 
              : 'from-slate-700/50 to-slate-800/50 border-slate-600/30',
            'border flex items-center justify-center'
          )}>
            <Target className={clsx(
              'h-6 w-6',
              product.enabled ? 'text-indigo-400' : 'text-slate-500'
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-white line-clamp-1">
                  {product.title || product.query || 'Untitled'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={product.mode === 'url' ? 'primary' : 'info'} size="sm">
                    {product.mode === 'url' ? 'URL' : 'Search'}
                  </Badge>
                  {product.site && <SiteBadge site={product.site} />}
                  <StatusBadge status={product.enabled ? 'active' : 'disabled'} />
                </div>
              </div>
              
              {/* Toggle */}
              <Toggle
                checked={product.enabled}
                onChange={handleToggle}
              />
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Checks every {product.checkInterval || '6h'}
              </span>
              <span>
                Last: {formatRelativeTime(product.lastChecked)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              {product.url && (
                <a href={product.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="xs" icon={ExternalLink}>
                    Visit
                  </Button>
                </a>
              )}
              <Button variant="ghost" size="xs" icon={Edit2}>
                Edit
              </Button>
              <Button 
                variant="ghost" 
                size="xs" 
                icon={Trash2}
                onClick={() => deleteTracked(product.id)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Tracked() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'enabled', 'disabled'

  const { data, isLoading } = useTracked(1, 50);
  const products = data?.data || [];

  const filteredProducts = products.filter(p => {
    if (filter === 'enabled') return p.enabled;
    if (filter === 'disabled') return !p.enabled;
    return true;
  });

  const stats = {
    total: products.length,
    enabled: products.filter(p => p.enabled).length,
    disabled: products.filter(p => !p.enabled).length,
  };

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tracked Products</h1>
          <p className="text-slate-400 mt-1">
            {stats.enabled} active, {stats.disabled} paused
          </p>
        </div>
        <Button 
          variant="primary" 
          icon={Plus}
          onClick={() => setIsModalOpen(true)}
        >
          Add Product
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: 'all', label: `All (${stats.total})` },
          { value: 'enabled', label: `Active (${stats.enabled})` },
          { value: 'disabled', label: `Paused (${stats.disabled})` },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              filter === tab.value
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProducts.map((product, index) => (
            <TrackedProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-center py-12">
            <Target className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No tracked products</h3>
            <p className="text-slate-500 mb-6">Start tracking products to monitor their prices</p>
            <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
              Add Your First Product
            </Button>
          </div>
        </Card>
      )}

      {/* Add Modal */}
      <AddProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </motion.div>
  );
}

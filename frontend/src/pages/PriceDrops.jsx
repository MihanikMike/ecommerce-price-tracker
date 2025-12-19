import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { 
  TrendingDown, 
  Filter,
  Clock,
  Flame,
  ExternalLink,
  Package,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { Card, Button, CardSkeleton } from '../components/common';
import { Select, SearchInput } from '../components/common/Input';
import { PriceChangeBadge, SiteBadge } from '../components/common/Badge';
import { usePriceChanges } from '../hooks/usePriceChanges';
import { formatPrice, formatRelativeTime } from '../utils/formatters';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Price drop card
function PriceDropCard({ drop, index }) {
  const dropPercent = Math.abs(drop.percentChange || 0);
  const isHotDeal = dropPercent >= 20;
  const isGoodDeal = dropPercent >= 10;

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={clsx(
          'relative overflow-hidden h-full',
          isHotDeal && 'ring-1 ring-rose-500/30'
        )}
        hover={false}
      >
        {/* Hot deal badge */}
        {isHotDeal && (
          <div className="absolute top-3 right-3">
            <span className={clsx(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
              'bg-gradient-to-r from-rose-500 to-orange-500 text-white',
              'shadow-lg shadow-rose-500/30'
            )}>
              <Flame className="h-3 w-3" />
              Hot Deal
            </span>
          </div>
        )}

        <div className="space-y-4">
          {/* Product Info */}
          <div>
            <Link 
              to={`/products/${drop.productId}`}
              className="text-sm font-medium text-white hover:text-indigo-400 transition-colors line-clamp-2"
            >
              {drop.title || 'Product Title'}
            </Link>
            <div className="flex items-center gap-2 mt-2">
              <SiteBadge site={drop.site} />
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(drop.detectedAt)}
              </span>
            </div>
          </div>

          {/* Price Info */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Current Price</p>
              <p className="text-2xl font-bold text-white">
                {formatPrice(drop.currentPrice)}
              </p>
              <p className="text-xs text-slate-500 line-through">
                Was {formatPrice(drop.previousPrice)}
              </p>
            </div>
            <PriceChangeBadge 
              change={drop.percentChange || -15} 
              size="lg"
            />
          </div>

          {/* Savings */}
          <div className={clsx(
            'p-3 rounded-xl -mx-2',
            'bg-emerald-500/10 border border-emerald-500/20'
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400">You Save</span>
              <span className="text-sm font-bold text-emerald-400">
                {formatPrice((drop.previousPrice || 0) - (drop.currentPrice || 0))}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Link to={`/products/${drop.productId}`} className="flex-1">
              <Button variant="secondary" size="sm" className="w-full">
                View Details
              </Button>
            </Link>
            {drop.url && (
              <a href={drop.url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" icon={ExternalLink} />
              </a>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Empty state
function EmptyState() {
  return (
    <Card>
      <div className="text-center py-16">
        <div className={clsx(
          'mx-auto w-20 h-20 rounded-2xl',
          'bg-gradient-to-br from-emerald-500/20 to-teal-500/10',
          'border border-emerald-500/20',
          'flex items-center justify-center mb-4'
        )}>
          <TrendingDown className="h-10 w-10 text-emerald-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No Price Drops Found</h3>
        <p className="text-slate-500 max-w-sm mx-auto">
          No significant price drops detected in the selected time period. Check back later!
        </p>
      </div>
    </Card>
  );
}

export default function PriceDrops() {
  const [timeRange, setTimeRange] = useState('24');
  const [minDrop, setMinDrop] = useState('5');
  const [sortBy, setSortBy] = useState('drop');
  const [siteFilter, setSiteFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch, isFetching } = usePriceChanges(parseInt(timeRange), parseInt(minDrop), 100);
  const rawDrops = data?.data || [];

  // Apply client-side filtering and sorting
  const displayDrops = useMemo(() => {
    let filtered = [...rawDrops];
    
    // Filter by site
    if (siteFilter) {
      filtered = filtered.filter(drop => drop.site === siteFilter);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(drop => 
        drop.title?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'drop':
        filtered.sort((a, b) => Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0));
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
        break;
      case 'price':
        filtered.sort((a, b) => (a.currentPrice || 0) - (b.currentPrice || 0));
        break;
      case 'savings':
        filtered.sort((a, b) => 
          ((b.previousPrice || 0) - (b.currentPrice || 0)) - 
          ((a.previousPrice || 0) - (a.currentPrice || 0))
        );
        break;
      default:
        break;
    }
    
    return filtered;
  }, [rawDrops, siteFilter, searchQuery, sortBy]);

  const timeOptions = [
    { value: '24', label: 'Last 24 Hours' },
    { value: '48', label: 'Last 48 Hours' },
    { value: '168', label: 'Last 7 Days' },
    { value: '720', label: 'Last 30 Days' },
  ];

  const dropOptions = [
    { value: '0', label: 'All Drops' },
    { value: '5', label: '5%+ Drop' },
    { value: '10', label: '10%+ Drop' },
    { value: '20', label: '20%+ Drop' },
  ];

  const sortOptions = [
    { value: 'drop', label: 'Biggest Drop %' },
    { value: 'savings', label: 'Most Savings' },
    { value: 'recent', label: 'Most Recent' },
    { value: 'price', label: 'Lowest Price' },
  ];

  const siteOptions = [
    { value: '', label: 'All Sites' },
    { value: 'amazon', label: 'Amazon' },
    { value: 'burton', label: 'Burton' },
  ];

  // Calculate stats
  const stats = useMemo(() => {
    if (displayDrops.length === 0) return null;
    
    const totalSavings = displayDrops.reduce((sum, drop) => 
      sum + ((drop.previousPrice || 0) - (drop.currentPrice || 0)), 0
    );
    const avgDrop = displayDrops.reduce((sum, drop) => 
      sum + Math.abs(drop.percentChange || 0), 0
    ) / displayDrops.length;
    const hotDeals = displayDrops.filter(d => Math.abs(d.percentChange || 0) >= 20).length;
    
    return { totalSavings, avgDrop, hotDeals };
  }, [displayDrops]);

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingDown className="h-7 w-7 text-emerald-400" />
            Price Drops
          </h1>
          <p className="text-slate-400 mt-1">
            {displayDrops.length} deals found in the selected period
          </p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => refetch()}
          loading={isFetching}
          icon={RefreshCw}
        >
          Refresh
        </Button>
      </motion.div>

      {/* Stats Summary */}
      {stats && displayDrops.length > 0 && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Potential Savings</p>
                <p className="text-lg font-bold text-emerald-400">{formatPrice(stats.totalSavings)}</p>
              </div>
            </div>
          </Card>
          <Card padding={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Average Drop</p>
                <p className="text-lg font-bold text-white">{stats.avgDrop.toFixed(1)}%</p>
              </div>
            </div>
          </Card>
          <Card padding={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Hot Deals (20%+)</p>
                <p className="text-lg font-bold text-white">{stats.hotDeals}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card padding={false}>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-3">
                <Select
                  options={timeOptions}
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="w-40"
                />
                <Select
                  options={dropOptions}
                  value={minDrop}
                  onChange={(e) => setMinDrop(e.target.value)}
                  className="w-32"
                />
                <Select
                  options={siteOptions}
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className="w-32"
                />
                <Select
                  options={sortOptions}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Price Drops Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : displayDrops.length > 0 ? (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
        >
          {displayDrops.map((drop, index) => (
            <PriceDropCard key={drop.id} drop={drop} index={index} />
          ))}
        </motion.div>
      ) : (
        <EmptyState />
      )}
    </motion.div>
  );
}

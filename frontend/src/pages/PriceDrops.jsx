import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { 
  TrendingDown, 
  Filter,
  Clock,
  Flame,
  Percent,
  ExternalLink,
  Package
} from 'lucide-react';
import { Card, Button, CardSkeleton } from '../components/common';
import { Select } from '../components/common/Input';
import { PriceChangeBadge, SiteBadge } from '../components/common/Badge';
import { usePriceChanges } from '../hooks/usePriceChanges';
import { formatPrice, formatRelativeTime, truncate } from '../utils/formatters';

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

  const { data, isLoading } = usePriceChanges(parseInt(timeRange), parseInt(minDrop), 50);
  const drops = data?.data || [];

  // Sample data for demo
  const sampleDrops = [
    { id: 1, productId: 1, title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones', site: 'amazon', currentPrice: 279.99, previousPrice: 349.99, percentChange: -20, detectedAt: new Date(Date.now() - 3600000) },
    { id: 2, productId: 2, title: 'Burton Custom Flying V Snowboard 2024', site: 'burton', currentPrice: 449.95, previousPrice: 549.95, percentChange: -18.2, detectedAt: new Date(Date.now() - 7200000) },
    { id: 3, productId: 3, title: 'Apple AirPods Pro (2nd Generation)', site: 'amazon', currentPrice: 189.99, previousPrice: 249.99, percentChange: -24, detectedAt: new Date(Date.now() - 10800000) },
    { id: 4, productId: 4, title: 'Samsung 65" OLED 4K Smart TV', site: 'amazon', currentPrice: 1299.99, previousPrice: 1499.99, percentChange: -13.3, detectedAt: new Date(Date.now() - 14400000) },
    { id: 5, productId: 5, title: 'Burton Step On Bindings', site: 'burton', currentPrice: 319.95, previousPrice: 369.95, percentChange: -13.5, detectedAt: new Date(Date.now() - 18000000) },
    { id: 6, productId: 6, title: 'Dyson V15 Detect Vacuum', site: 'amazon', currentPrice: 549.99, previousPrice: 649.99, percentChange: -15.4, detectedAt: new Date(Date.now() - 21600000) },
  ];

  const displayDrops = drops.length > 0 ? drops : sampleDrops;

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
    { value: 'drop', label: 'Biggest Drop' },
    { value: 'recent', label: 'Most Recent' },
    { value: 'price', label: 'Lowest Price' },
  ];

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
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants}>
        <Card padding={false}>
          <div className="p-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
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
              options={sortOptions}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-36"
            />
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

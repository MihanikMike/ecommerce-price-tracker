import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { 
  Package, 
  ArrowLeft, 
  ExternalLink, 
  TrendingDown, 
  TrendingUp,
  Target,
  Clock,
  Calendar,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { Card, StatsCard, Button, PageLoader } from '../components/common';
import { PriceChangeBadge, SiteBadge, Badge } from '../components/common/Badge';
import { useProduct } from '../hooks/useProducts';
import { formatPrice, formatDateTime } from '../utils/formatters';

// Price Chart Placeholder (would integrate Chart.js)
function PriceChart({ productId }) {
  return (
    <div className={clsx(
      'h-64 rounded-xl',
      'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
      'border border-slate-700/30',
      'flex items-center justify-center'
    )}>
      <div className="text-center">
        <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500">Price chart will be rendered here</p>
        <p className="text-sm text-slate-600 mt-1">Using Chart.js</p>
      </div>
    </div>
  );
}

// Price history table row
function PriceHistoryRow({ entry, index }) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="h-4 w-4" />
          {formatDateTime(entry.checkedAt)}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm font-semibold text-white">
          {formatPrice(entry.price)}
        </span>
      </td>
      <td className="py-3 px-4">
        {entry.change !== 0 && (
          <PriceChangeBadge change={entry.change} size="sm" />
        )}
      </td>
    </motion.tr>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const { data: product, isLoading, error } = useProduct(id);

  if (isLoading) {
    return <PageLoader text="Loading product details..." />;
  }

  if (error || !product) {
    return (
      <div className="text-center py-16">
        <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Product Not Found</h2>
        <p className="text-slate-500 mb-6">The product you're looking for doesn't exist.</p>
        <Link to="/products">
          <Button variant="secondary" icon={ArrowLeft}>
            Back to Products
          </Button>
        </Link>
      </div>
    );
  }

  // Sample price history
  const priceHistory = [
    { id: 1, checkedAt: new Date(), price: product.currentPrice || 99.99, change: 0 },
    { id: 2, checkedAt: new Date(Date.now() - 86400000), price: 109.99, change: -9.1 },
    { id: 3, checkedAt: new Date(Date.now() - 172800000), price: 109.99, change: 0 },
  ];

  const stats = [
    { label: 'Current Price', value: formatPrice(product.currentPrice || 99.99), icon: DollarSign, color: 'indigo' },
    { label: 'Lowest Price', value: formatPrice(product.lowestPrice || 89.99), icon: TrendingDown, color: 'emerald' },
    { label: 'Highest Price', value: formatPrice(product.highestPrice || 129.99), icon: TrendingUp, color: 'rose' },
    { label: 'Price Checks', value: product.checkCount || 24, icon: Clock, color: 'sky' },
  ];

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Back Button */}
      <Link 
        to="/products"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back to Products</span>
      </Link>

      {/* Product Header */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Product Image Placeholder */}
          <div className={clsx(
            'w-full lg:w-48 h-48 rounded-xl flex-shrink-0',
            'bg-gradient-to-br from-slate-700/50 to-slate-800/50',
            'border border-slate-700/50',
            'flex items-center justify-center'
          )}>
            <Package className="h-16 w-16 text-slate-600" />
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white mb-2">
                  {product.title || 'Product Title'}
                </h1>
                <div className="flex items-center gap-2 mb-4">
                  <SiteBadge site={product.site || 'amazon'} />
                  {product.isTracked && (
                    <Badge variant="primary" dot>Actively Tracked</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {product.url && (
                  <a href={product.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" icon={ExternalLink}>
                      Visit
                    </Button>
                  </a>
                )}
                <Button variant="primary" size="sm" icon={Target}>
                  Track
                </Button>
              </div>
            </div>

            {/* Price Display */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-4xl font-bold text-white">
                {formatPrice(product.currentPrice || 99.99)}
              </span>
              <PriceChangeBadge change={product.priceChange || -12.5} size="lg" />
            </div>

            <p className="text-sm text-slate-500">
              Last updated: {formatDateTime(product.lastChecked || new Date())}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatsCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Price Chart & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-400" />
            Price History
          </h2>
          <PriceChart productId={id} />
        </Card>

        {/* Recent Changes */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Changes</h2>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/50">
                  <th className="py-2 px-4 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
                  <th className="py-2 px-4 text-left text-xs font-medium text-slate-500 uppercase">Change</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((entry, index) => (
                  <PriceHistoryRow key={entry.id} entry={entry} index={index} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

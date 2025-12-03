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
  DollarSign,
  BarChart3,
  Database
} from 'lucide-react';
import { Card, StatsCard, Button, PageLoader } from '../components/common';
import { PriceChangeBadge, SiteBadge, Badge } from '../components/common/Badge';
import { PriceChart } from '../components/charts';
import { useProduct } from '../hooks/useProducts';
import { formatPrice, formatDateTime, formatRelativeTime } from '../utils/formatters';

export default function ProductDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useProduct(id);

  if (isLoading) {
    return <PageLoader text="Loading product details..." />;
  }

  if (error || !data?.product) {
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

  const product = data.product;
  const priceSummary = data.priceSummary || {};

  // Get price values
  const currentPrice = product.latest_price || priceSummary.latest_price;
  const lowestPrice = priceSummary.lowest_price;
  const highestPrice = priceSummary.highest_price;
  const avgPrice = priceSummary.average_price;
  const priceCount = priceSummary.price_count || product.price_count || 0;
  const currency = product.currency || 'USD';

  // Calculate price change percentage if we have data
  const priceChange = priceSummary.latest_price && priceSummary.previous_price
    ? ((priceSummary.latest_price - priceSummary.previous_price) / priceSummary.previous_price) * 100
    : 0;

  const stats = [
    { label: 'Current Price', value: formatPrice(currentPrice, currency), icon: DollarSign, color: 'indigo' },
    { label: 'Lowest Price', value: formatPrice(lowestPrice, currency), icon: TrendingDown, color: 'emerald' },
    { label: 'Highest Price', value: formatPrice(highestPrice, currency), icon: TrendingUp, color: 'rose' },
    { label: 'Price Records', value: priceCount, icon: Database, color: 'sky', isNumber: true },
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
                  <SiteBadge site={product.site || 'unknown'} />
                  {product.asin && (
                    <Badge variant="secondary" size="sm">ASIN: {product.asin}</Badge>
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
                <Link to="/tracked">
                  <Button variant="primary" size="sm" icon={Target}>
                    Track
                  </Button>
                </Link>
              </div>
            </div>

            {/* Price Display */}
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-4xl font-bold text-white">
                {formatPrice(currentPrice, currency)}
              </span>
              {priceChange !== 0 && (
                <PriceChangeBadge change={priceChange} size="lg" />
              )}
            </div>

            <p className="text-sm text-slate-500">
              Last updated: {formatRelativeTime(product.price_captured_at || product.last_seen_at)}
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
            value={stat.isNumber ? stat.value.toLocaleString() : stat.value}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      {/* Price Chart */}
      <Card>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-400" />
          Price History
        </h2>
        <PriceChart productId={id} />
      </Card>

      {/* Product Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Additional Info */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Product Information</h2>
          <dl className="space-y-3">
            {product.asin && (
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <dt className="text-slate-400">ASIN</dt>
                <dd className="text-white font-mono text-sm">{product.asin}</dd>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-800/50">
              <dt className="text-slate-400">Site</dt>
              <dd className="text-white capitalize">{product.site}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/50">
              <dt className="text-slate-400">First Seen</dt>
              <dd className="text-white">{formatDateTime(product.first_seen_at)}</dd>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800/50">
              <dt className="text-slate-400">Last Seen</dt>
              <dd className="text-white">{formatDateTime(product.last_seen_at)}</dd>
            </div>
            {avgPrice && (
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <dt className="text-slate-400">Average Price</dt>
                <dd className="text-white">{formatPrice(avgPrice, currency)}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Price Statistics */}
        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Price Statistics</h2>
          <dl className="space-y-3">
            <div className="flex justify-between py-2 border-b border-slate-800/50">
              <dt className="text-slate-400">Current Price</dt>
              <dd className="text-white font-semibold">{formatPrice(currentPrice, currency)}</dd>
            </div>
            {lowestPrice && (
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <dt className="text-slate-400 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-emerald-400" />
                  All-time Low
                </dt>
                <dd className="text-emerald-400 font-semibold">{formatPrice(lowestPrice, currency)}</dd>
              </div>
            )}
            {highestPrice && (
              <div className="flex justify-between py-2 border-b border-slate-800/50">
                <dt className="text-slate-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-rose-400" />
                  All-time High
                </dt>
                <dd className="text-rose-400 font-semibold">{formatPrice(highestPrice, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-800/50">
              <dt className="text-slate-400">Total Price Records</dt>
              <dd className="text-white">{priceCount.toLocaleString()}</dd>
            </div>
            {priceSummary.first_price_date && (
              <div className="flex justify-between py-2">
                <dt className="text-slate-400">Tracking Since</dt>
                <dd className="text-white">{formatDateTime(priceSummary.first_price_date)}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
    </motion.div>
  );
}

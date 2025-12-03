import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { 
  Package, 
  Target, 
  TrendingDown, 
  Activity,
  ArrowRight,
  Plus,
  Search,
  BarChart3,
  Zap,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Card, StatsCard, Button, CardSkeleton } from '../components/common';
import { PriceChangeBadge, SiteBadge } from '../components/common/Badge';
import { useStats } from '../hooks/useStats';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Mini sparkline component
function Sparkline({ data = [], color = 'indigo', className = '' }) {
  if (data.length === 0) {
    data = [30, 45, 35, 50, 40, 60, 55, 70, 65, 80]; // Sample data
  }
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 100;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const gradientId = `sparkline-${color}-${Math.random().toString(36).slice(2)}`;
  const colors = {
    indigo: { stroke: '#818cf8', fill: 'rgba(129, 140, 248, 0.1)' },
    emerald: { stroke: '#34d399', fill: 'rgba(52, 211, 153, 0.1)' },
    amber: { stroke: '#fbbf24', fill: 'rgba(251, 191, 36, 0.1)' },
    rose: { stroke: '#fb7185', fill: 'rgba(251, 113, 133, 0.1)' },
  };
  
  const colorSet = colors[color] || colors.indigo;

  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className={clsx('w-full h-10', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colorSet.stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorSet.stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={colorSet.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Quick action card
function QuickAction({ icon: Icon, title, description, href, color = 'slate' }) {
  const colorClasses = {
    indigo: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 hover:border-indigo-500/50',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-500/50',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-500/50',
    slate: 'from-slate-700/50 to-slate-800/50 border-slate-600/30 hover:border-slate-500/50',
  };

  return (
    <Link to={href}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={clsx(
          'group p-4 rounded-xl',
          'bg-gradient-to-br border',
          'transition-all duration-300',
          'cursor-pointer',
          colorClasses[color]
        )}
      >
        <div className="flex items-start gap-3">
          <div className={clsx(
            'p-2 rounded-lg',
            color === 'indigo' && 'bg-indigo-500/20 text-indigo-400',
            color === 'emerald' && 'bg-emerald-500/20 text-emerald-400',
            color === 'amber' && 'bg-amber-500/20 text-amber-400',
            color === 'slate' && 'bg-slate-600/50 text-slate-400'
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-indigo-300 transition-colors">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
        </div>
      </motion.div>
    </Link>
  );
}

// Recent price drop item
function PriceDropItem({ product }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={clsx(
        'group flex items-center gap-4 p-3 -mx-3',
        'rounded-xl hover:bg-slate-800/30',
        'transition-colors duration-200 cursor-pointer'
      )}
    >
      <div className={clsx(
        'h-12 w-12 rounded-xl',
        'bg-gradient-to-br from-emerald-500/20 to-teal-500/10',
        'flex items-center justify-center',
        'border border-emerald-500/20'
      )}>
        <TrendingDown className="h-5 w-5 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
          {product.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <SiteBadge site={product.site} />
          <span className="text-xs text-slate-500">
            {product.timeAgo}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-white">${product.currentPrice}</div>
        <PriceChangeBadge change={product.change} size="sm" />
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  const statCards = [
    {
      label: 'Total Products',
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'indigo',
      trend: 'up',
      trendValue: '+12%',
      sparklineColor: 'indigo',
    },
    {
      label: 'Tracked Items',
      value: stats?.trackedProducts || 0,
      icon: Target,
      color: 'emerald',
      trend: 'up',
      trendValue: '+5',
      sparklineColor: 'emerald',
    },
    {
      label: 'Price Drops (24h)',
      value: stats?.priceDrops24h || 0,
      icon: TrendingDown,
      color: 'amber',
      trend: 'down',
      trendValue: '-3',
      sparklineColor: 'amber',
    },
    {
      label: 'Active Monitors',
      value: stats?.activeMonitors || 0,
      icon: Activity,
      color: 'sky',
      sparklineColor: 'indigo',
    },
  ];

  const quickActions = [
    { icon: Plus, title: 'Add Product', description: 'Start tracking a new product', href: '/tracked', color: 'indigo' },
    { icon: Search, title: 'Search Products', description: 'Find products in database', href: '/products', color: 'emerald' },
    { icon: BarChart3, title: 'View Analytics', description: 'Price history & trends', href: '/price-drops', color: 'amber' },
  ];

  // Sample price drops data
  const recentDrops = [
    { id: 1, title: 'Sony WH-1000XM5 Wireless Headphones', site: 'amazon', currentPrice: '279.99', change: -15.2, timeAgo: '2h ago' },
    { id: 2, title: 'Burton Custom Flying V Snowboard', site: 'burton', currentPrice: '549.95', change: -12.0, timeAgo: '4h ago' },
    { id: 3, title: 'Apple AirPods Pro (2nd Gen)', site: 'amazon', currentPrice: '189.99', change: -8.5, timeAgo: '6h ago' },
  ];

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">
          Welcome back! 👋
        </h1>
        <p className="text-slate-400 mt-1">
          Here's what's happening with your price tracking
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={itemVariants}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))
        ) : (
          statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <StatsCard
                label={stat.label}
                value={stat.value.toLocaleString()}
                icon={stat.icon}
                color={stat.color}
                trend={stat.trend}
                trendValue={stat.trendValue}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                Quick Actions
              </h2>
            </div>
            <div className="space-y-3">
              {quickActions.map((action) => (
                <QuickAction key={action.title} {...action} />
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent Price Drops */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-emerald-400" />
                Recent Price Drops
              </h2>
              <Link 
                to="/price-drops"
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                View all
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            
            {recentDrops.length > 0 ? (
              <div className="space-y-1">
                {recentDrops.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <PriceDropItem product={product} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingDown className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">No recent price drops</p>
                <p className="text-sm text-slate-600 mt-1">Check back later for deals</p>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Activity Timeline */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-400" />
              Recent Activity
            </h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Price monitor ran successfully</span>
              <span className="text-slate-600">• 5 min ago</span>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

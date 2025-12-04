import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  Settings as SettingsIcon, 
  Database, 
  Trash2,
  HardDrive,
  Gauge,
  Clock,
  Server,
  RefreshCw,
  Shield,
  Bell,
  Moon,
  Sun,
  Package,
  TrendingDown,
  Activity,
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink
} from 'lucide-react';
import { Card, Button } from '../components/common';
import { Toggle, Select } from '../components/common/Input';
import { useCache } from '../hooks/useCache';
import { useStats } from '../hooks/useStats';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { formatBytes, formatRelativeTime } from '../utils/formatters';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Stat item component
function StatItem({ icon: Icon, label, value, subvalue, color = 'slate', loading = false }) {
  const colorClasses = {
    slate: 'bg-slate-700/30 text-slate-400',
    indigo: 'bg-indigo-500/10 text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    rose: 'bg-rose-500/10 text-rose-400',
  };

  return (
    <div className={clsx(
      'p-4 rounded-xl',
      'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
      'border border-slate-700/30'
    )}>
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          {loading ? (
            <div className="h-5 w-16 bg-slate-700/50 rounded animate-pulse mt-1" />
          ) : (
            <>
              <p className="text-lg font-semibold text-white truncate">{value}</p>
              {subvalue && <p className="text-xs text-slate-500">{subvalue}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Settings section component
function SettingsSection({ title, description, icon: Icon, children }) {
  return (
    <Card>
      <div className="flex items-start gap-4 mb-6">
        <div className={clsx(
          'p-3 rounded-xl',
          'bg-indigo-500/10 text-indigo-400'
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

// Setting row component
function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-800/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// Status indicator
function StatusIndicator({ status, label }) {
  const statusConfig = {
    healthy: { color: 'emerald', icon: CheckCircle, text: 'Healthy' },
    warning: { color: 'amber', icon: AlertCircle, text: 'Warning' },
    error: { color: 'rose', icon: AlertCircle, text: 'Error' },
  };
  
  const config = statusConfig[status] || statusConfig.healthy;
  const Icon = config.icon;
  
  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
      config.color === 'emerald' && 'bg-emerald-500/10 text-emerald-400',
      config.color === 'amber' && 'bg-amber-500/10 text-amber-400',
      config.color === 'rose' && 'bg-rose-500/10 text-rose-400'
    )}>
      <Icon className="h-3.5 w-3.5" />
      {label || config.text}
    </div>
  );
}

export default function Settings() {
  const { addToast } = useToast();
  const { data: cacheStats, isLoading: cacheLoading, clearCache, isClearing, refetch: refetchCache } = useCache({
    onClearSuccess: () => {
      addToast('Cache cleared successfully', 'success');
    },
    onClearError: (error) => {
      addToast(`Failed to clear cache: ${error.message}`, 'error');
    },
  });
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useStats();
  const { theme, setTheme } = useTheme();
  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: true,
    dropThreshold: '10',
    dailyDigest: false,
  });
  const [displaySettings, setDisplaySettings] = useState({
    compactView: false,
  });

  // Parse stats data
  const dbStats = statsData?.database || {};
  const trackingStats = statsData?.tracking || {};
  
  // Calculate cache hit rate
  const cacheHitRate = cacheStats?.hits && cacheStats?.misses
    ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
    : 0;

  const handleRefreshAll = () => {
    refetchCache();
    refetchStats();
  };

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
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage your application preferences and view system status</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={handleRefreshAll}
          icon={RefreshCw}
        >
          Refresh All
        </Button>
      </motion.div>

      {/* System Status Overview */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex items-start gap-4 mb-6">
            <div className={clsx(
              'p-3 rounded-xl',
              'bg-emerald-500/10 text-emerald-400'
            )}>
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">System Status</h2>
                <StatusIndicator status="healthy" label="All Systems Operational" />
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Overview of your price tracker system</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatItem
              icon={Package}
              label="Total Products"
              value={statsLoading ? '...' : (dbStats.products?.toLocaleString() || '0')}
              color="indigo"
              loading={statsLoading}
            />
            <StatItem
              icon={TrendingDown}
              label="Price Records"
              value={statsLoading ? '...' : (dbStats.priceHistory?.toLocaleString() || '0')}
              color="emerald"
              loading={statsLoading}
            />
            <StatItem
              icon={Zap}
              label="Active Tracking"
              value={statsLoading ? '...' : (trackingStats.enabled || '0')}
              subvalue={`of ${trackingStats.total || 0} total`}
              color="amber"
              loading={statsLoading}
            />
            <StatItem
              icon={Database}
              label="Database Size"
              value={statsLoading ? '...' : (dbStats.size || 'N/A')}
              color="slate"
              loading={statsLoading}
            />
          </div>
        </Card>
      </motion.div>

      {/* Cache Management */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="Cache Management"
          description="Monitor and manage application cache for optimal performance"
          icon={Database}
        >
          {/* Cache Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatItem
              icon={HardDrive}
              label="Cache Entries"
              value={cacheLoading ? '...' : (cacheStats?.keys || 0)}
              color="indigo"
              loading={cacheLoading}
            />
            <StatItem
              icon={Gauge}
              label="Hit Rate"
              value={cacheLoading ? '...' : `${cacheHitRate}%`}
              subvalue={cacheStats ? `${cacheStats.hits || 0} hits / ${cacheStats.misses || 0} misses` : ''}
              color={cacheHitRate >= 70 ? 'emerald' : cacheHitRate >= 40 ? 'amber' : 'rose'}
              loading={cacheLoading}
            />
            <StatItem
              icon={Server}
              label="Memory Used"
              value={cacheLoading ? '...' : formatBytes(cacheStats?.memory || 0)}
              color="amber"
              loading={cacheLoading}
            />
            <StatItem
              icon={Clock}
              label="Avg TTL"
              value={cacheLoading ? '...' : `${Math.round((cacheStats?.avgTtl || 0) / 60)}m`}
              color="slate"
              loading={cacheLoading}
            />
          </div>

          {/* Cache Info */}
          {cacheStats && (
            <div className="mb-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <Info className="h-4 w-4" />
                Cache Performance
              </div>
              <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div 
                  className={clsx(
                    'h-full rounded-full transition-all duration-500',
                    cacheHitRate >= 70 ? 'bg-emerald-500' : cacheHitRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                  )}
                  style={{ width: `${cacheHitRate}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {cacheHitRate >= 70 
                  ? 'Excellent cache performance! Most requests are served from cache.'
                  : cacheHitRate >= 40
                    ? 'Good cache performance. Consider adjusting TTL for frequently accessed data.'
                    : 'Cache hit rate is low. This may indicate cache is being cleared frequently.'}
              </p>
            </div>
          )}

          {/* Cache Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all cache? This may temporarily slow down the application.')) {
                  clearCache();
                }
              }}
              loading={isClearing}
              icon={Trash2}
            >
              Clear All Cache
            </Button>
            <Button
              variant="secondary"
              onClick={() => refetchCache()}
              icon={RefreshCw}
            >
              Refresh Stats
            </Button>
          </div>
        </SettingsSection>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="Notifications"
          description="Configure how you receive price alerts and updates"
          icon={Bell}
        >
          <div className="space-y-1">
            <SettingRow
              label="Email Notifications"
              description="Receive price drop alerts via email"
            >
              <Toggle 
                checked={notificationSettings.emailEnabled} 
                onChange={(e) => setNotificationSettings(s => ({ ...s, emailEnabled: e.target.checked }))} 
              />
            </SettingRow>
            <SettingRow
              label="Price Drop Threshold"
              description="Only notify for drops greater than this percentage"
            >
              <Select
                options={[
                  { value: '5', label: '5%' },
                  { value: '10', label: '10%' },
                  { value: '15', label: '15%' },
                  { value: '20', label: '20%' },
                  { value: '25', label: '25%' },
                ]}
                value={notificationSettings.dropThreshold}
                onChange={(e) => setNotificationSettings(s => ({ ...s, dropThreshold: e.target.value }))}
                className="w-24"
              />
            </SettingRow>
            <SettingRow
              label="Daily Digest"
              description="Get a daily summary of all price changes"
            >
              <Toggle 
                checked={notificationSettings.dailyDigest} 
                onChange={(e) => setNotificationSettings(s => ({ ...s, dailyDigest: e.target.checked }))} 
              />
            </SettingRow>
          </div>
        </SettingsSection>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="Appearance"
          description="Customize the look and feel of your dashboard"
          icon={theme === 'dark' ? Moon : Sun}
        >
          <div className="space-y-1">
            <SettingRow
              label="Theme"
              description="Choose between light and dark mode"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    theme === 'light' 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-slate-800/50 text-slate-400 hover:text-white'
                  )}
                >
                  <Sun className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-slate-800/50 text-slate-400 hover:text-white'
                  )}
                >
                  <Moon className="h-4 w-4" />
                </button>
              </div>
            </SettingRow>
            <SettingRow
              label="Compact View"
              description="Show more items with less spacing in tables and lists"
            >
              <Toggle 
                checked={displaySettings.compactView} 
                onChange={(e) => setDisplaySettings(s => ({ ...s, compactView: e.target.checked }))} 
              />
            </SettingRow>
          </div>
        </SettingsSection>
      </motion.div>

      {/* System Information */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="System Information"
          description="Application details, configuration, and status"
          icon={SettingsIcon}
        >
          <div className="space-y-3">
            {[
              { label: 'Version', value: '1.0.0' },
              { label: 'API Endpoint', value: '/api' },
              { label: 'Environment', value: import.meta.env.MODE },
              { label: 'Build Date', value: new Date().toLocaleDateString() },
              { label: 'Tracking Modes', value: `${trackingStats.url_based || 0} URL / ${trackingStats.search_based || 0} Search` },
            ].map((item) => (
              <div 
                key={item.label}
                className="flex justify-between py-2 border-b border-slate-800/30 last:border-0"
              >
                <span className="text-sm text-slate-500">{item.label}</span>
                <span className="text-sm font-medium text-white">{item.value}</span>
              </div>
            ))}
          </div>
          
          {/* Links */}
          <div className="mt-6 pt-4 border-t border-slate-800/30">
            <div className="flex flex-wrap gap-4">
              <a 
                href="https://github.com/MihanikMike/ecommerce-price-tracker" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                GitHub Repository
              </a>
              <a 
                href="/api/health" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                API Health Check
              </a>
            </div>
          </div>
        </SettingsSection>
      </motion.div>

      {/* Danger Zone */}
      <motion.div variants={itemVariants}>
        <Card className="border-rose-500/20">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Irreversible actions that may affect your data
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button 
              variant="outline" 
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              onClick={() => alert('This feature is not yet implemented')}
            >
              Reset All Settings
            </Button>
            <Button 
              variant="outline" 
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              onClick={() => alert('This feature is not yet implemented')}
            >
              Export All Data
            </Button>
            <Button 
              variant="outline" 
              className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
              onClick={() => {
                if (window.confirm('This will delete ALL data including products and price history. This action cannot be undone. Are you sure?')) {
                  alert('This feature is not yet implemented');
                }
              }}
            >
              Delete All Data
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

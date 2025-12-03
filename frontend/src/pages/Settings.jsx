import { motion } from 'framer-motion';
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
  Moon
} from 'lucide-react';
import { Card, Button } from '../components/common';
import { Toggle } from '../components/common/Input';
import { useCache } from '../hooks/useCache';

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
function StatItem({ icon: Icon, label, value, color = 'slate' }) {
  const colorClasses = {
    slate: 'bg-slate-700/30 text-slate-400',
    indigo: 'bg-indigo-500/10 text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
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
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-semibold text-white">{value}</p>
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

export default function Settings() {
  const { data: cacheStats, isLoading, clearCache, isClearing } = useCache();

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your application preferences</p>
      </motion.div>

      {/* Cache Management */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="Cache Management"
          description="Monitor and manage application cache"
          icon={Database}
        >
          {/* Cache Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatItem
              icon={HardDrive}
              label="Cache Entries"
              value={isLoading ? '...' : cacheStats?.entries || 0}
              color="indigo"
            />
            <StatItem
              icon={Gauge}
              label="Hit Rate"
              value={isLoading ? '...' : `${cacheStats?.hitRate || 0}%`}
              color="emerald"
            />
            <StatItem
              icon={Server}
              label="Memory Used"
              value={isLoading ? '...' : cacheStats?.memoryUsed || '0 MB'}
              color="amber"
            />
            <StatItem
              icon={Clock}
              label="TTL"
              value={isLoading ? '...' : cacheStats?.ttl || '24h'}
              color="slate"
            />
          </div>

          {/* Cache Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              onClick={clearCache}
              loading={isClearing}
              icon={Trash2}
            >
              Clear All Cache
            </Button>
            <Button
              variant="secondary"
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
          description="Configure how you receive alerts"
          icon={Bell}
        >
          <div className="space-y-1">
            <SettingRow
              label="Email Notifications"
              description="Receive price drop alerts via email"
            >
              <Toggle checked={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow
              label="Price Drop Threshold"
              description="Only notify for drops greater than this"
            >
              <select className={clsx(
                'px-3 py-2 rounded-lg text-sm',
                'bg-slate-800/50 border border-slate-700/50',
                'text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
              )}>
                <option>5%</option>
                <option>10%</option>
                <option>15%</option>
                <option>20%</option>
              </select>
            </SettingRow>
            <SettingRow
              label="Daily Digest"
              description="Get a daily summary of all price changes"
            >
              <Toggle checked={false} onChange={() => {}} />
            </SettingRow>
          </div>
        </SettingsSection>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="Appearance"
          description="Customize the look and feel"
          icon={Moon}
        >
          <div className="space-y-1">
            <SettingRow
              label="Dark Mode"
              description="Use dark theme (always on)"
            >
              <Toggle checked={true} onChange={() => {}} disabled />
            </SettingRow>
            <SettingRow
              label="Compact View"
              description="Show more items with less spacing"
            >
              <Toggle checked={false} onChange={() => {}} />
            </SettingRow>
          </div>
        </SettingsSection>
      </motion.div>

      {/* System Info */}
      <motion.div variants={itemVariants}>
        <SettingsSection
          title="System Information"
          description="Application details and status"
          icon={SettingsIcon}
        >
          <div className="space-y-3">
            {[
              { label: 'Version', value: '1.0.0' },
              { label: 'API Endpoint', value: '/api' },
              { label: 'Environment', value: import.meta.env.MODE },
              { label: 'Build Date', value: new Date().toLocaleDateString() },
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
              <p className="text-sm text-slate-500 mt-0.5">Irreversible actions</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
              Reset All Settings
            </Button>
            <Button variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
              Delete All Data
            </Button>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Edit2, 
  BellRing,
  BellOff,
  Package,
  Mail,
  ArrowDown,
  Percent,
  Check,
  X
} from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../components/common';
import { Input, Select, Toggle } from '../components/common/Input';
import { SiteBadge, StatusBadge } from '../components/common/Badge';
import { formatPrice } from '../utils/formatters';

// Sample alerts
const sampleAlerts = [
  { 
    id: 1, 
    productTitle: 'Sony WH-1000XM5 Headphones', 
    site: 'amazon',
    type: 'price_below',
    targetPrice: 250,
    currentPrice: 279.99,
    enabled: true,
    triggered: false,
    createdAt: '2024-01-15'
  },
  { 
    id: 2, 
    productTitle: 'Apple MacBook Pro 14"', 
    site: 'amazon',
    type: 'percent_drop',
    percentDrop: 15,
    currentPrice: 1799.99,
    enabled: true,
    triggered: true,
    triggeredAt: '2024-01-18',
    createdAt: '2024-01-10'
  },
  { 
    id: 3, 
    productTitle: 'LG C3 55" OLED TV', 
    site: 'amazon',
    type: 'price_below',
    targetPrice: 1000,
    currentPrice: 1196.99,
    enabled: false,
    triggered: false,
    createdAt: '2024-01-08'
  },
];

// Alert card component
function AlertCard({ alert, onToggle, onDelete, onEdit }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={clsx(
        'group relative p-4 rounded-xl',
        'bg-slate-800/30 border transition-all duration-200',
        alert.enabled ? 'border-slate-700/50' : 'border-slate-800/30 opacity-60',
        alert.triggered && 'border-emerald-500/50 bg-emerald-500/5'
      )}
    >
      {/* Triggered indicator */}
      {alert.triggered && (
        <div className="absolute -top-2 -right-2">
          <span className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
            'text-xs font-medium',
            'bg-emerald-500 text-white'
          )}>
            <BellRing className="h-3 w-3" />
            Triggered
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={clsx(
          'h-10 w-10 rounded-lg flex-shrink-0',
          'flex items-center justify-center',
          alert.type === 'price_below' ? 'bg-indigo-500/10' : 'bg-purple-500/10'
        )}>
          {alert.type === 'price_below' 
            ? <ArrowDown className="h-5 w-5 text-indigo-400" />
            : <Percent className="h-5 w-5 text-purple-400" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-1">
            {alert.productTitle}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <SiteBadge site={alert.site} />
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400">
              {alert.type === 'price_below' 
                ? `Alert when below ${formatPrice(alert.targetPrice)}`
                : `Alert on ${alert.percentDrop}% drop`
              }
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Current: {formatPrice(alert.currentPrice)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Toggle 
            checked={alert.enabled} 
            onChange={() => onToggle(alert.id)}
            size="sm"
          />
          <button
            onClick={() => onEdit(alert)}
            className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-700/50"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(alert.id)}
            className="p-2 text-slate-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Create alert modal
function CreateAlertModal({ isOpen, onClose }) {
  const [alertType, setAlertType] = useState('price_below');

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={clsx(
          'relative w-full max-w-lg p-6 rounded-2xl',
          'bg-slate-900 border border-slate-700/50',
          'shadow-2xl'
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-6">Create Price Alert</h2>

        <div className="space-y-5">
          {/* Product search */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Product
            </label>
            <Input
              placeholder="Search for a product..."
              icon={Package}
            />
          </div>

          {/* Alert type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Alert Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAlertType('price_below')}
                className={clsx(
                  'p-4 rounded-xl border transition-all duration-200',
                  'flex flex-col items-center gap-2',
                  alertType === 'price_below'
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-white'
                    : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600/50'
                )}
              >
                <ArrowDown className="h-5 w-5" />
                <span className="text-sm font-medium">Price Below</span>
              </button>
              <button
                onClick={() => setAlertType('percent_drop')}
                className={clsx(
                  'p-4 rounded-xl border transition-all duration-200',
                  'flex flex-col items-center gap-2',
                  alertType === 'percent_drop'
                    ? 'bg-purple-500/10 border-purple-500/50 text-white'
                    : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600/50'
                )}
              >
                <Percent className="h-5 w-5" />
                <span className="text-sm font-medium">Percent Drop</span>
              </button>
            </div>
          </div>

          {/* Target value */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {alertType === 'price_below' ? 'Target Price' : 'Minimum Drop %'}
            </label>
            <Input
              type="number"
              placeholder={alertType === 'price_below' ? '0.00' : '10'}
              icon={alertType === 'price_below' ? ArrowDown : Percent}
            />
          </div>

          {/* Email notification toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-white">Email Notification</p>
                <p className="text-xs text-slate-500">Get notified via email when triggered</p>
              </div>
            </div>
            <Toggle defaultChecked />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="primary" icon={Check} className="flex-1">
              Create Alert
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Empty state
function EmptyState({ onCreateClick }) {
  return (
    <div className="text-center py-16">
      <div className={clsx(
        'mx-auto w-20 h-20 rounded-2xl mb-6',
        'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
        'border border-slate-700/50',
        'flex items-center justify-center'
      )}>
        <BellOff className="h-10 w-10 text-slate-600" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Alerts Yet</h3>
      <p className="text-slate-500 max-w-sm mx-auto mb-6">
        Create price alerts to get notified when products drop to your target price.
      </p>
      <Button variant="primary" icon={Plus} onClick={onCreateClick}>
        Create Your First Alert
      </Button>
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState(sampleAlerts);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all');

  const toggleAlert = (id) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
    ));
  };

  const deleteAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const editAlert = (alert) => {
    console.log('Edit alert:', alert);
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'active') return alert.enabled;
    if (filter === 'triggered') return alert.triggered;
    return true;
  });

  const stats = {
    total: alerts.length,
    active: alerts.filter(a => a.enabled).length,
    triggered: alerts.filter(a => a.triggered).length,
  };

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="h-7 w-7 text-amber-400" />
            Price Alerts
          </h1>
          <p className="text-slate-400 mt-1">
            Get notified when prices drop to your target
          </p>
        </div>
        <Button 
          variant="primary" 
          icon={Plus}
          onClick={() => setShowCreateModal(true)}
        >
          New Alert
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Alerts', value: stats.total, icon: Bell },
          { label: 'Active', value: stats.active, icon: BellRing, color: 'text-emerald-400' },
          { label: 'Triggered', value: stats.triggered, icon: Check, color: 'text-indigo-400' },
        ].map((stat) => (
          <Card key={stat.label} className="!p-4">
            <div className="flex items-center gap-3">
              <stat.icon className={clsx('h-5 w-5', stat.color || 'text-slate-500')} />
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'triggered', label: 'Triggered' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              filter === option.value
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <Card>
        {filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onToggle={toggleAlert}
                  onDelete={deleteAlert}
                  onEdit={editAlert}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState onCreateClick={() => setShowCreateModal(true)} />
        )}
      </Card>

      {/* Create Alert Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateAlertModal 
            isOpen={showCreateModal} 
            onClose={() => setShowCreateModal(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

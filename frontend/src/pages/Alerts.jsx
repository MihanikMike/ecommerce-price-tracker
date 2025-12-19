import { useState, useEffect } from 'react';
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
  X,
  Settings,
  Send,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Server,
  Clock,
  Users,
  TrendingDown,
  TrendingUp,
  Save,
  TestTube
} from 'lucide-react';
import { Card, Button, LoadingSpinner } from '../components/common';
import { Input, Toggle } from '../components/common/Input';
import { SiteBadge, StatusBadge } from '../components/common/Badge';
import { formatPrice } from '../utils/formatters';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

// Provider display info
const PROVIDER_INFO = {
  smtp: { name: 'SMTP', icon: Server, color: 'text-slate-400' },
  gmail: { name: 'Gmail', icon: Mail, color: 'text-rose-400' },
  sendgrid: { name: 'SendGrid', icon: Send, color: 'text-blue-400' },
  ses: { name: 'AWS SES', icon: Server, color: 'text-amber-400' },
  mailgun: { name: 'Mailgun', icon: Mail, color: 'text-purple-400' },
  mailru: { name: 'Mail.ru', icon: Mail, color: 'text-orange-400' },
  test: { name: 'Test Mode', icon: TestTube, color: 'text-emerald-400' },
};

// Email Status Card
function EmailStatusCard({ emailConfig, emailStatus, onRefresh, isRefreshing }) {
  const provider = emailConfig?.provider || 'unknown';
  const providerInfo = PROVIDER_INFO[provider] || { name: provider, icon: Mail, color: 'text-slate-400' };
  const ProviderIcon = providerInfo.icon;

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Mail className="h-5 w-5 text-indigo-400" />
          Email Configuration
        </h3>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            'text-slate-500 hover:text-white hover:bg-slate-700/50',
            isRefreshing && 'animate-spin'
          )}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Provider */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30">
          <div className="flex items-center gap-3">
            <ProviderIcon className={clsx('h-5 w-5', providerInfo.color)} />
            <div>
              <p className="text-sm font-medium text-white">{providerInfo.name}</p>
              <p className="text-xs text-slate-500">Email Provider</p>
            </div>
          </div>
          {emailConfig?.enabled ? (
            <StatusBadge status="success" size="sm">Enabled</StatusBadge>
          ) : (
            <StatusBadge status="warning" size="sm">Disabled</StatusBadge>
          )}
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30">
          <div className="flex items-center gap-3">
            {emailStatus?.verified ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            )}
            <div>
              <p className="text-sm font-medium text-white">
                {emailStatus?.verified ? 'Connected' : 'Not Verified'}
              </p>
              <p className="text-xs text-slate-500">
                {emailStatus?.error || emailStatus?.note || 'Connection status'}
              </p>
            </div>
          </div>
        </div>

        {/* From Address */}
        {emailConfig?.from && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30">
            <div className="flex items-center gap-3">
              <Send className="h-5 w-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-white">{emailConfig.from}</p>
                <p className="text-xs text-slate-500">From Address</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// Notification Settings Card
function NotificationSettingsCard({ settings, onSave, isSaving }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleRecipientsChange = (value) => {
    const recipients = value.split(',').map(e => e.trim()).filter(Boolean);
    handleChange('recipients', recipients);
  };

  return (
    <Card className="!p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-purple-400" />
          Notification Preferences
        </h3>
        {hasChanges && (
          <Button 
            variant="primary" 
            size="sm" 
            icon={Save}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {/* Enable Notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-white">Enable Notifications</p>
              <p className="text-xs text-slate-500">Receive email alerts for price changes</p>
            </div>
          </div>
          <Toggle 
            checked={localSettings?.enabled ?? false} 
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
        </div>

        {/* Price Drop Threshold */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            Price Drop Alert Threshold
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="100"
              value={localSettings?.priceDropThreshold ?? 10}
              onChange={(e) => handleChange('priceDropThreshold', parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-slate-500">% minimum drop to trigger alert</span>
          </div>
        </div>

        {/* Price Increase Threshold */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <TrendingUp className="h-4 w-4 text-rose-400" />
            Price Increase Alert Threshold
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min="0"
              max="100"
              value={localSettings?.priceIncreaseThreshold ?? 20}
              onChange={(e) => handleChange('priceIncreaseThreshold', parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-slate-500">% minimum increase to trigger alert</span>
          </div>
        </div>

        {/* Recipients */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
            <Users className="h-4 w-4 text-indigo-400" />
            Alert Recipients
          </label>
          <Input
            type="text"
            placeholder="email1@example.com, email2@example.com"
            value={(localSettings?.recipients || []).join(', ')}
            onChange={(e) => handleRecipientsChange(e.target.value)}
          />
          <p className="text-xs text-slate-500">Comma-separated list of email addresses</p>
        </div>

        {/* Daily Digest */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/30">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-white">Daily Digest</p>
              <p className="text-xs text-slate-500">Receive a summary of all price changes</p>
            </div>
          </div>
          <Toggle 
            checked={localSettings?.dailyDigest ?? false} 
            onChange={(e) => handleChange('dailyDigest', e.target.checked)}
          />
        </div>

        {/* Digest Time */}
        {localSettings?.dailyDigest && (
          <div className="space-y-2 pl-12">
            <label className="text-sm font-medium text-slate-300">Digest Time</label>
            <Input
              type="time"
              value={localSettings?.digestTime ?? '09:00'}
              onChange={(e) => handleChange('digestTime', e.target.value)}
              className="w-32"
            />
          </div>
        )}
      </div>
    </Card>
  );
}

// Test Email Section
function TestEmailSection({ onSendTest, isSending, emailConfig }) {
  const [testEmail, setTestEmail] = useState('');
  
  const defaultEmail = emailConfig?.alertRecipients?.[0] || '';
  const canSend = emailConfig?.enabled && (testEmail || defaultEmail);

  return (
    <Card className="!p-5">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
        <TestTube className="h-5 w-5 text-amber-400" />
        Test Email
      </h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Send test to:</label>
          <Input
            type="email"
            placeholder={defaultEmail || 'Enter email address'}
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            icon={Mail}
          />
        </div>

        <Button
          variant="secondary"
          icon={Send}
          onClick={() => onSendTest(testEmail || defaultEmail)}
          disabled={!canSend || isSending}
          className="w-full"
        >
          {isSending ? 'Sending...' : 'Send Test Email'}
        </Button>

        {!emailConfig?.enabled && (
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Email notifications are disabled. Enable in environment variables.
          </p>
        )}
      </div>
    </Card>
  );
}

// Alert Card Component
function AlertCard({ alert, onToggle, onDelete, onEdit }) {
  const alertTypeColors = {
    price_below: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
    percent_drop: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={clsx(
        'p-4 rounded-xl border transition-all duration-200',
        'bg-gradient-to-r',
        alertTypeColors[alert.type] || alertTypeColors.price_below,
        alert.triggered && 'ring-2 ring-amber-500/50'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={clsx(
          'p-2 rounded-lg',
          alert.type === 'price_below' ? 'bg-emerald-500/20' : 'bg-purple-500/20'
        )}>
          {alert.type === 'price_below' 
            ? <ArrowDown className="h-5 w-5 text-emerald-400" />
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

// Empty state for alerts
function EmptyAlertsState() {
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
      <h3 className="text-lg font-semibold text-white mb-2">No Price Alerts Yet</h3>
      <p className="text-slate-500 max-w-sm mx-auto mb-6">
        Price alerts are coming soon! For now, configure your email settings above to receive automatic notifications when prices change.
      </p>
      <Button variant="secondary" icon={Settings} disabled>
        Coming Soon
      </Button>
    </div>
  );
}

export default function Alerts() {
  const { addToast } = useToast();
  
  // Sample alerts (for UI demo - future: fetch from API)
  const [alerts, setAlerts] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all');
  
  // Email & notification state
  const [emailConfig, setEmailConfig] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Fetch email config and notification settings
  const fetchSettings = async () => {
    try {
      const [configRes, statusRes, notifRes] = await Promise.all([
        api.getEmailConfig(),
        api.getEmailStatus(),
        api.getNotificationSettings(),
      ]);
      
      setEmailConfig(configRes);
      setEmailStatus(statusRes);
      setNotificationSettings(notifRes);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      addToast({
        type: 'error',
        title: 'Failed to load settings',
        message: error.message,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSettings();
  };

  const handleSendTestEmail = async (email) => {
    setIsSendingTest(true);
    try {
      const result = await api.sendTestEmail(email);
      if (result.success) {
        addToast({
          type: 'success',
          title: 'Test email sent!',
          message: `Check your inbox at ${email}`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Failed to send test email',
          message: result.error,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to send test email',
        message: error.message,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveNotifications = async (settings) => {
    setIsSavingNotifications(true);
    try {
      const result = await api.updateNotificationSettings(settings);
      if (result.success) {
        setNotificationSettings(settings);
        addToast({
          type: 'success',
          title: 'Settings saved!',
          message: 'Notification preferences updated successfully',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to save settings',
        message: error.message,
      });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const toggleAlert = (id) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === id ? { ...alert, enabled: !alert.enabled } : alert
    ));
  };

  const deleteAlert = (id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
    addToast({
      type: 'success',
      title: 'Alert deleted',
    });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

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
            Alerts & Notifications
          </h1>
          <p className="text-slate-400 mt-1">
            Configure email notifications for price changes
          </p>
        </div>
      </div>

      {/* Email & Notification Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Status */}
        <EmailStatusCard 
          emailConfig={emailConfig}
          emailStatus={emailStatus}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        
        {/* Test Email */}
        <TestEmailSection
          emailConfig={emailConfig}
          onSendTest={handleSendTestEmail}
          isSending={isSendingTest}
        />
        
        {/* Quick Stats */}
        <Card className="!p-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <BellRing className="h-5 w-5 text-emerald-400" />
            Alert Stats
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Total Alerts', value: stats.total, icon: Bell },
              { label: 'Active', value: stats.active, icon: BellRing, color: 'text-emerald-400' },
              { label: 'Triggered', value: stats.triggered, icon: Check, color: 'text-indigo-400' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <stat.icon className={clsx('h-5 w-5', stat.color || 'text-slate-500')} />
                  <span className="text-sm text-slate-400">{stat.label}</span>
                </div>
                <span className="text-lg font-bold text-white">{stat.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Notification Preferences */}
      <NotificationSettingsCard 
        settings={notificationSettings}
        onSave={handleSaveNotifications}
        isSaving={isSavingNotifications}
      />

      {/* Price Alerts Section (Future Feature) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-400" />
            Price Alerts
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 ml-2">
              Coming Soon
            </span>
          </h2>
          <Button 
            variant="secondary" 
            size="sm"
            icon={Plus}
            disabled
          >
            New Alert
          </Button>
        </div>

        {/* Filters */}
        {alerts.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
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
        )}

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
            <EmptyAlertsState />
          )}
        </Card>
      </div>

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

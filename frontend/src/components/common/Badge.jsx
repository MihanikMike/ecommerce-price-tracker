import clsx from 'clsx';
import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  dot = false,
  className = '' 
}) {
  const variants = {
    default: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
    primary: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const dotColors = {
    default: 'bg-slate-400',
    primary: 'bg-indigo-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
  };

  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 font-medium rounded-full border',
      variants[variant],
      sizes[size],
      className
    )}>
      {dot && (
        <span className={clsx(
          'h-1.5 w-1.5 rounded-full',
          dotColors[variant]
        )} />
      )}
      {children}
    </span>
  );
}

export function PriceChangeBadge({ 
  change, 
  size = 'md',
  showIcon = true,
  className = '' 
}) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const variant = isNeutral ? 'default' : isPositive ? 'danger' : 'success';
  
  const formattedChange = isNeutral 
    ? '0%' 
    : `${isPositive ? '+' : ''}${change.toFixed(1)}%`;

  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={clsx(
        'inline-flex items-center gap-1 font-semibold rounded-full',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-xs',
        size === 'lg' && 'px-3 py-1.5 text-sm',
        variant === 'success' && 'bg-emerald-500/10 text-emerald-400',
        variant === 'danger' && 'bg-rose-500/10 text-rose-400',
        variant === 'default' && 'bg-slate-700/50 text-slate-400',
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {formattedChange}
    </motion.span>
  );
}

export function SiteBadge({ site, className = '' }) {
  const siteConfig = {
    amazon: { label: 'Amazon', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
    burton: { label: 'Burton', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
    default: { label: site, color: 'bg-slate-700/50 text-slate-300 border-slate-600/50' },
  };

  const config = siteConfig[site?.toLowerCase()] || siteConfig.default;

  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border',
      config.color,
      className
    )}>
      {config.label}
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  const statusConfig = {
    active: { label: 'Active', variant: 'success', dot: true },
    enabled: { label: 'Enabled', variant: 'success', dot: true },
    disabled: { label: 'Disabled', variant: 'default', dot: true },
    pending: { label: 'Pending', variant: 'warning', dot: true },
    error: { label: 'Error', variant: 'danger', dot: true },
  };

  const config = statusConfig[status?.toLowerCase()] || { label: status, variant: 'default', dot: false };

  return (
    <Badge variant={config.variant} dot={config.dot} className={className}>
      {config.label}
    </Badge>
  );
}

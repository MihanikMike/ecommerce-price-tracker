import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const Card = forwardRef(function Card({ 
  children, 
  className = '', 
  padding = true,
  hover = true,
  glow = false,
  gradient = false,
  as = 'div',
  ...props 
}, ref) {
  const Component = motion[as] || motion.div;
  
  return (
    <Component
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      className={clsx(
        'relative rounded-2xl',
        'bg-[var(--bg-card)]',
        'backdrop-blur-xl',
        'border border-slate-700/50',
        'shadow-xl shadow-black/20',
        hover && 'transition-all duration-300 hover:border-slate-600/50 hover:shadow-2xl hover:shadow-black/30',
        glow && 'ring-1 ring-indigo-500/20 hover:ring-indigo-500/40',
        gradient && 'bg-gradient-to-br from-indigo-500/10 via-slate-800/80 to-slate-900/80',
        padding && 'p-6',
        className
      )}
      {...props}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </Component>
  );
});

Card.Header = function CardHeader({ children, className = '', border = true }) {
  return (
    <div className={clsx(
      'px-6 py-4',
      border && 'border-b border-slate-700/50',
      className
    )}>
      {children}
    </div>
  );
};

Card.Body = function CardBody({ children, className = '' }) {
  return (
    <div className={clsx('p-6', className)}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ children, className = '', border = true }) {
  return (
    <div className={clsx(
      'px-6 py-4',
      border && 'border-t border-slate-700/50',
      'bg-slate-900/30',
      className
    )}>
      {children}
    </div>
  );
};

// Stats Card variant
export function StatsCard({ 
  label, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  subtext,
  color = 'indigo',
  className = '' 
}) {
  const colorClasses = {
    indigo: {
      bg: 'bg-indigo-500/10',
      icon: 'text-indigo-400',
      glow: 'shadow-indigo-500/20',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      icon: 'text-emerald-400',
      glow: 'shadow-emerald-500/20',
    },
    amber: {
      bg: 'bg-amber-500/10',
      icon: 'text-amber-400',
      glow: 'shadow-amber-500/20',
    },
    sky: {
      bg: 'bg-sky-500/10',
      icon: 'text-sky-400',
      glow: 'shadow-sky-500/20',
    },
    rose: {
      bg: 'bg-rose-500/10',
      icon: 'text-rose-400',
      glow: 'shadow-rose-500/20',
    },
  };

  const colors = colorClasses[color] || colorClasses.indigo;

  return (
    <Card className={clsx('overflow-hidden', className)} hover>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <motion.p 
            className="text-3xl font-bold text-white tracking-tight"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {value}
          </motion.p>
          {subtext && (
            <p className="text-xs text-slate-500">{subtext}</p>
          )}
          {trend && (
            <div className={clsx(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            )}>
              <span>{trend === 'up' ? '↑' : '↓'}</span>
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        {Icon && (
          <motion.div 
            className={clsx(
              'p-3 rounded-xl',
              colors.bg,
              'shadow-lg',
              colors.glow
            )}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Icon className={clsx('h-6 w-6', colors.icon)} />
          </motion.div>
        )}
      </div>
    </Card>
  );
}

export default Card;

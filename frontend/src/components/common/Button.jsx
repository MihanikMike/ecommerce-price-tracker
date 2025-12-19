import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  fullWidth = false,
  ...props
}, ref) {
  const baseStyles = clsx(
    'relative inline-flex items-center justify-center font-medium rounded-xl',
    'transition-all duration-200 ease-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
    fullWidth && 'w-full'
  );
  
  const variants = {
    primary: clsx(
      'bg-gradient-to-r from-indigo-500 to-indigo-600',
      'text-white shadow-lg shadow-indigo-500/25',
      'hover:from-indigo-600 hover:to-indigo-700 hover:shadow-indigo-500/40',
      'active:scale-[0.98]',
      'focus:ring-indigo-500'
    ),
    secondary: clsx(
      'bg-slate-800/80 backdrop-blur-sm',
      'text-slate-200 border border-slate-700/50',
      'hover:bg-slate-700/80 hover:border-slate-600/50',
      'active:scale-[0.98]',
      'focus:ring-slate-500'
    ),
    success: clsx(
      'bg-gradient-to-r from-emerald-500 to-teal-500',
      'text-white shadow-lg shadow-emerald-500/25',
      'hover:from-emerald-600 hover:to-teal-600 hover:shadow-emerald-500/40',
      'active:scale-[0.98]',
      'focus:ring-emerald-500'
    ),
    danger: clsx(
      'bg-gradient-to-r from-red-500 to-rose-500',
      'text-white shadow-lg shadow-red-500/25',
      'hover:from-red-600 hover:to-rose-600 hover:shadow-red-500/40',
      'active:scale-[0.98]',
      'focus:ring-red-500'
    ),
    ghost: clsx(
      'text-slate-400 bg-transparent',
      'hover:text-white hover:bg-slate-800/50',
      'active:bg-slate-700/50',
      'focus:ring-slate-500'
    ),
    outline: clsx(
      'bg-transparent border border-slate-600/50',
      'text-slate-300',
      'hover:bg-slate-800/50 hover:border-slate-500/50 hover:text-white',
      'active:scale-[0.98]',
      'focus:ring-slate-500'
    ),
    glow: clsx(
      'bg-gradient-to-r from-indigo-500 to-purple-500',
      'text-white',
      'shadow-[0_0_20px_rgba(99,102,241,0.5)]',
      'hover:shadow-[0_0_30px_rgba(99,102,241,0.7)]',
      'active:scale-[0.98]',
      'focus:ring-indigo-500'
    ),
  };

  const sizes = {
    xs: 'px-2.5 py-1.5 text-xs gap-1.5',
    sm: 'px-3 py-2 text-sm gap-2',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
    xl: 'px-8 py-4 text-lg gap-3',
  };

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
    xl: 'h-6 w-6',
  };

  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <svg 
          className={clsx('animate-spin', iconSizes[size], iconPosition === 'right' ? 'order-last' : '')} 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" cy="12" r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      
      {/* Left Icon */}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className={iconSizes[size]} />
      )}
      
      {/* Children */}
      {children}
      
      {/* Right Icon */}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={iconSizes[size]} />
      )}
    </motion.button>
  );
});

export default Button;

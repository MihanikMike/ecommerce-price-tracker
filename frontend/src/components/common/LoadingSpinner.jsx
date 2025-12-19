import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <motion.div
        className={clsx(
          sizes[size],
          'rounded-full',
          'border-2 border-slate-700',
          'border-t-indigo-500'
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}

export function PageLoader({ text = 'Loading...' }) {
  return (
    <motion.div 
      className="min-h-[400px] flex flex-col items-center justify-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="relative"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="h-16 w-16 rounded-full border-4 border-slate-700" />
        <motion.div
          className="absolute inset-0 h-16 w-16 rounded-full border-4 border-transparent border-t-indigo-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-2 h-12 w-12 rounded-full border-4 border-transparent border-t-purple-500"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
      <motion.p
        className="text-slate-400 text-sm font-medium"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {text}
      </motion.p>
    </motion.div>
  );
}

// Skeleton loader for content
export function Skeleton({ className = '', variant = 'text' }) {
  const variants = {
    text: 'h-4 rounded',
    title: 'h-6 rounded',
    avatar: 'h-10 w-10 rounded-full',
    card: 'h-32 rounded-xl',
    image: 'h-48 rounded-xl',
  };

  return (
    <motion.div
      className={clsx(
        'bg-slate-800/50',
        'animate-shimmer',
        variants[variant],
        className
      )}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  );
}

// Card skeleton
export function CardSkeleton() {
  return (
    <div className="p-6 rounded-2xl bg-emerald-900/20 border border-emerald-800/30 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-24" variant="text" />
        <Skeleton variant="avatar" />
      </div>
      <Skeleton className="w-32" variant="title" />
      <Skeleton className="w-16" variant="text" />
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 5 }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-emerald-800/20">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={clsx(
            'flex-1',
            i === 0 && 'max-w-[200px]'
          )} 
          variant="text" 
        />
      ))}
    </div>
  );
}

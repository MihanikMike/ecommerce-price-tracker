import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

// Toast configuration
const TOAST_DURATION = 5000;
const MAX_TOASTS = 5;

// Toast variants with icons and colors
const toastVariants = {
  success: {
    icon: CheckCircle,
    className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    iconClassName: 'text-emerald-400',
  },
  error: {
    icon: XCircle,
    className: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    iconClassName: 'text-rose-400',
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    iconClassName: 'text-amber-400',
  },
  info: {
    icon: Info,
    className: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    iconClassName: 'text-indigo-400',
  },
};

// Individual Toast component
function Toast({ id, type, title, message, onDismiss }) {
  const variant = toastVariants[type] || toastVariants.info;
  const Icon = variant.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        'relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm',
        'shadow-lg shadow-black/10',
        'min-w-[320px] max-w-[420px]',
        variant.className
      )}
    >
      <Icon className={clsx('h-5 w-5 flex-shrink-0 mt-0.5', variant.iconClassName)} />
      
      <div className="flex-1 min-w-0">
        {title && (
          <p className="font-medium text-white text-sm">{title}</p>
        )}
        {message && (
          <p className={clsx('text-sm', title ? 'mt-1 opacity-80' : 'text-white')}>
            {message}
          </p>
        )}
      </div>

      <button
        onClick={() => onDismiss(id)}
        className={clsx(
          'flex-shrink-0 p-1 rounded-lg transition-colors',
          'hover:bg-white/10 text-current opacity-60 hover:opacity-100'
        )}
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
        className={clsx(
          'absolute bottom-0 left-0 right-0 h-0.5 origin-left',
          type === 'success' && 'bg-emerald-400',
          type === 'error' && 'bg-rose-400',
          type === 'warning' && 'bg-amber-400',
          type === 'info' && 'bg-indigo-400'
        )}
      />
    </motion.div>
  );
}

// Toast Container
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Toast Provider
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((options) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
    };

    setToasts((prev) => {
      // Remove oldest toasts if we're at max
      const newToasts = prev.length >= MAX_TOASTS ? prev.slice(1) : prev;
      return [...newToasts, toast];
    });

    // Auto-dismiss after duration
    setTimeout(() => {
      dismissToast(id);
    }, TOAST_DURATION);

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience methods
  const toast = useCallback((message, title) => addToast({ type: 'info', message, title }), [addToast]);
  toast.success = useCallback((message, title) => addToast({ type: 'success', message, title }), [addToast]);
  toast.error = useCallback((message, title) => addToast({ type: 'error', message, title }), [addToast]);
  toast.warning = useCallback((message, title) => addToast({ type: 'warning', message, title }), [addToast]);
  toast.info = useCallback((message, title) => addToast({ type: 'info', message, title }), [addToast]);

  const value = {
    toast,
    addToast,
    dismissToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

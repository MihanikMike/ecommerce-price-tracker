import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, Search, RefreshCw, Command, X, Sun, Moon, Menu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from './Layout';

const pageTitle = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/tracked': 'Tracked Products',
  '/price-drops': 'Price Drops',
  '/compare': 'Compare',
  '/alerts': 'Alerts',
  '/settings': 'Settings',
};

export default function Header() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { theme, toggleTheme, isDark } = useTheme();
  const { toggleSidebar } = useSidebar();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const currentTitle = pageTitle[location.pathname] || 
    (location.pathname.startsWith('/products/') ? 'Product Details' : 'Dashboard');

  return (
    <>
      <header className={clsx(
        'sticky top-0 z-30 h-16',
        'bg-slate-900/80 dark:bg-slate-900/80 backdrop-blur-xl',
        'border-b border-slate-800/50',
        'flex items-center justify-between px-4 sm:px-6'
      )}>
        {/* Left: Mobile Menu + Page Title */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <motion.button
            onClick={toggleSidebar}
            className={clsx(
              'lg:hidden p-2 rounded-xl',
              'bg-slate-800/50 hover:bg-slate-800',
              'border border-slate-700/50 hover:border-slate-600/50',
              'text-slate-400 hover:text-white',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </motion.button>

          <motion.h1 
            key={currentTitle}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]"
          >
            {currentTitle}
          </motion.h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Search Button */}
          <motion.button
            onClick={() => setIsSearchOpen(true)}
            className={clsx(
              'flex items-center gap-2 px-2 sm:px-3 py-2',
              'bg-slate-800/50 hover:bg-slate-800',
              'border border-slate-700/50 hover:border-slate-600/50',
              'rounded-xl text-slate-400 hover:text-white',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm hidden sm:inline">Search</span>
            <kbd className={clsx(
              'hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5',
              'bg-slate-700/50 rounded text-[10px] text-slate-500'
            )}>
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </motion.button>

          {/* Theme Toggle Button */}
          <motion.button
            onClick={toggleTheme}
            className={clsx(
              'p-2.5 rounded-xl',
              'bg-slate-800/50 hover:bg-slate-800',
              'border border-slate-700/50 hover:border-slate-600/50',
              'text-slate-400 hover:text-white',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.05, rotate: 15 }}
            whileTap={{ scale: 0.95 }}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            <AnimatePresence mode="wait">
              {isDark ? (
                <motion.div
                  key="sun"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="h-4 w-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="h-4 w-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Refresh Button */}
          <motion.button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={clsx(
              'p-2.5 rounded-xl',
              'bg-slate-800/50 hover:bg-slate-800',
              'border border-slate-700/50 hover:border-slate-600/50',
              'text-slate-400 hover:text-white',
              'transition-all duration-200',
              'disabled:opacity-50'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Refresh data"
          >
            <RefreshCw className={clsx('h-4 w-4', isRefreshing && 'animate-spin')} />
          </motion.button>

          {/* Notifications */}
          <motion.button
            className={clsx(
              'relative p-2.5 rounded-xl',
              'bg-slate-800/50 hover:bg-slate-800',
              'border border-slate-700/50 hover:border-slate-600/50',
              'text-slate-400 hover:text-white',
              'transition-all duration-200'
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className={clsx(
              'absolute top-1.5 right-1.5',
              'h-2 w-2 rounded-full',
              'bg-rose-500',
              'ring-2 ring-slate-900'
            )} />
          </motion.button>
        </div>
      </header>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsSearchOpen(false)}
            />
            
            {/* Search Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className={clsx(
                'fixed top-[20%] left-1/2 -translate-x-1/2 z-50',
                'w-full max-w-xl',
                'bg-slate-900/95 backdrop-blur-xl',
                'border border-slate-700/50',
                'rounded-2xl shadow-2xl shadow-black/50',
                'overflow-hidden'
              )}
            >
              <div className="flex items-center gap-3 px-4 border-b border-slate-800/50">
                <Search className="h-5 w-5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, tracked items..."
                  className={clsx(
                    'flex-1 py-4 bg-transparent',
                    'text-white placeholder-slate-500',
                    'focus:outline-none'
                  )}
                  autoFocus
                />
                <button 
                  onClick={() => setIsSearchOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 text-center text-slate-500 text-sm">
                Start typing to search...
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

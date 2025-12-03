import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Package,
  Target,
  TrendingDown,
  GitCompare,
  Bell,
  Settings,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Tracked', href: '/tracked', icon: Target },
  { name: 'Price Drops', href: '/price-drops', icon: TrendingDown },
  { name: 'Compare', href: '/compare', icon: GitCompare },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: { 
      duration: 0.3,
      when: 'beforeChildren',
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1 }
};

export default function Sidebar() {
  const location = useLocation();

  return (
    <motion.aside 
      className={clsx(
        'fixed left-0 top-0 h-full w-64',
        'bg-[var(--bg-secondary)]/95 backdrop-blur-xl',
        'border-r border-slate-800/50',
        'flex flex-col z-40'
      )}
      initial="hidden"
      animate="visible"
      variants={sidebarVariants}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/50">
        <motion.div 
          className="flex items-center gap-3"
          whileHover={{ scale: 1.02 }}
        >
          <div className={clsx(
            'p-2 rounded-xl',
            'bg-gradient-to-br from-indigo-500 to-purple-600',
            'shadow-lg shadow-indigo-500/30'
          )}>
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">Price Tracker</span>
            <div className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
              Dashboard
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <motion.div key={item.name} variants={itemVariants}>
              <NavLink
                to={item.href}
                className={clsx(
                  'group relative flex items-center px-3 py-2.5 rounded-xl',
                  'transition-all duration-200',
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}
              >
                {/* Active background */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className={clsx(
                        'absolute inset-0 rounded-xl',
                        'bg-gradient-to-r from-indigo-500/20 to-purple-500/10',
                        'border border-indigo-500/30'
                      )}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </AnimatePresence>

                {/* Active indicator */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      exit={{ opacity: 0, scaleY: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon */}
                <span className={clsx(
                  'relative z-10 p-2 rounded-lg transition-colors duration-200',
                  isActive 
                    ? 'bg-indigo-500/20 text-indigo-400' 
                    : 'text-slate-500 group-hover:text-slate-300 group-hover:bg-slate-800/50'
                )}>
                  <item.icon className="h-5 w-5" />
                </span>

                {/* Label */}
                <span className="relative z-10 ml-3 text-sm font-medium">
                  {item.name}
                </span>

                {/* Hover arrow */}
                <ChevronRight className={clsx(
                  'relative z-10 ml-auto h-4 w-4 transition-all duration-200',
                  isActive 
                    ? 'opacity-100 text-indigo-400' 
                    : 'opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0'
                )} />
              </NavLink>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800/50">
        <div className={clsx(
          'flex items-center gap-3 px-3 py-3 rounded-xl',
          'bg-slate-800/30 border border-slate-700/30'
        )}>
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <div className="text-xs font-medium text-slate-300">System Status</div>
            <div className="text-[10px] text-slate-500">All services running</div>
          </div>
        </div>
        <div className="mt-3 text-center text-[10px] text-slate-600">
          Price Tracker v1.0.0
        </div>
      </div>
    </motion.aside>
  );
}

import { useState, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import { SkipLink } from '../common';

// Context for sidebar state
const SidebarContext = createContext({
  isSidebarOpen: false,
  toggleSidebar: () => {},
  closeSidebar: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, toggleSidebar, closeSidebar }}>
      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* Skip Link for keyboard users */}
        <SkipLink href="#main-content" />
        
        {/* Background decoration */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 right-1/3 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
        </div>
        
        <Sidebar />
        
        {/* Main content - responsive margin */}
        <div className="lg:ml-64 min-h-screen flex flex-col relative">
          <Header />
          <motion.main 
            id="main-content"
            className="flex-1 p-4 sm:p-6 overflow-auto"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={{ duration: 0.3 }}
            role="main"
            tabIndex={-1}
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

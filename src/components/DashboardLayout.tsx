import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const DashboardLayout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const reducedMotion = useReducedMotionSafe();

  return (
    <div className="min-h-screen flex bg-[#101512] text-[#E8F0EA]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6">
          <motion.div
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-[1440px]"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};

import React from 'react';
import {
  Activity,
  Bookmark,
  BrainCircuit,
  CandlestickChart,
  Compass,
  LayoutDashboard,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  { label: 'Overview', to: '/app/overview', icon: LayoutDashboard, match: '/app/overview' },
  { label: 'Explore Stocks', to: '/app/explore', icon: Compass, match: '/app/explore' },
  { label: 'Stock Analysis', to: '/app/stock/RELIANCE', icon: CandlestickChart, match: '/app/stock' },
  { label: 'AI Predictions', to: '/app/predictions', icon: BrainCircuit, match: '/app/predictions' },
  { label: 'Technical Analysis', to: '/app/technical', icon: Activity, match: '/app/technical' },
  { label: 'Market News', to: '/app/news', icon: Newspaper, match: '/app/news' },
  { label: 'Watchlist', to: '/app/watchlist', icon: Bookmark, match: '/app/watchlist' },
  { label: 'Settings', to: '/app/settings', icon: Settings, match: '/app/settings' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();
  const { watchlist } = useAppContext();

  const renderLinks = (isCollapsed: boolean, onClickItem?: () => void) => (
    <nav aria-label="Workspace navigation" className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = location.pathname.startsWith(item.match);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onClickItem}
            title={isCollapsed ? item.label : undefined}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? 'text-[#A5EBC3]'
                : 'text-[#91A197] hover:text-[#E8F0EA] hover:bg-[#18211C]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={
                  onClickItem ? 'sidebar-mobile-indicator' : 'sidebar-active-indicator'
                }
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-lg bg-[#214B37]/65 border border-[#36C982]/30"
              />
            )}
            <Icon className="relative z-10 w-4 h-4 shrink-0" aria-hidden="true" />
            {!isCollapsed && (
              <span className="relative z-10 flex-1 truncate">{item.label}</span>
            )}
            {!isCollapsed && item.label === 'Watchlist' && (
              <span className="relative z-10 text-[11px] font-mono-num text-[#91A197]">
                {watchlist.length}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop / Tablet Persistent Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-white/8 bg-[#141C17] transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        <div className="h-16 px-4 border-b border-white/8 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="font-display font-extrabold text-base tracking-tight text-[#E8F0EA] hover:text-[#A5EBC3] transition-colors truncate"
          >
            {collapsed ? 'BS' : 'BULLSIGHT'}
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md text-[#91A197] hover:text-[#E8F0EA] hover:bg-[#18211C] transition-colors shrink-0"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {renderLinks(collapsed)}

        {!collapsed && (
          <div className="p-4 border-t border-white/8 text-xs text-[#91A197] space-y-1">
            <div className="font-medium text-[#E8F0EA]">Demo Workspace</div>
            <p className="leading-relaxed">
              Sample India &amp; US equity data. No live brokerage link.
            </p>
          </div>
        )}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[82vw] bg-[#141C17] border-r border-white/10 flex flex-col h-full">
            <div className="h-14 px-4 border-b border-white/8 flex items-center justify-between">
              <Link
                to="/"
                onClick={onCloseMobile}
                className="font-display font-extrabold text-base tracking-tight text-[#E8F0EA]"
              >
                BULLSIGHT
              </Link>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close sidebar"
                className="p-2 rounded-lg text-[#91A197] hover:text-[#E8F0EA]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderLinks(false, onCloseMobile)}
          </aside>
        </div>
      )}
    </>
  );
};

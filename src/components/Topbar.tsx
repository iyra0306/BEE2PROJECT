import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Menu,
  Search,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import { MarketRegion, StockRecord } from '../types/market';
import { formatCurrency, formatSignedPercent } from '../utils/formatters';
import { DemoDataBadge } from './DemoDataBadge';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu }) => {
  const navigate = useNavigate();
  const {
    user,
    logoutUser,
    activeMarket,
    setActiveMarket,
    dataMode,
    setDataMode,
    watchlist,
    bhavcopyVersion,
    preferences,
    updatePreferences,
    fxUsdToInr,
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
  } = useAppContext();

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<StockRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [openMenu, setOpenMenu] = useState<
    null | 'notifications' | 'prefs' | 'profile'
  >(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const topbarRef = useRef<HTMLDivElement>(null);
  const searchReqIdRef = useRef(0);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Fetch matching equities from /api/stocks when search is focused or query changes
  useEffect(() => {
    if (!searchFocused && !query.trim()) return;

    const reqId = ++searchReqIdRef.current;
    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);

    const timer = window.setTimeout(
      async () => {
        try {
          const res = await apiClient.getStocks(
            {
              q: query.trim() || undefined,
              market: query.trim() ? 'All' : activeMarket,
              mode: dataMode,
              symbols: watchlist,
            },
            controller.signal
          );
          if (reqId !== searchReqIdRef.current) return;
          const stocks =
            dataMode === 'real'
              ? bhavcopyStore.overlayStocks(res.stocks)
              : res.stocks;
          setSearchResults(stocks.slice(0, query.trim() ? 7 : 6));
          setSearchLoading(false);
        } catch (err) {
          if (isAbortError(err) || reqId !== searchReqIdRef.current) return;
          setSearchError(
            err instanceof Error ? err.message : 'Unable to search tickers.'
          );
          setSearchLoading(false);
        }
      },
      query.trim() ? 140 : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeMarket, searchFocused, dataMode, watchlist, bhavcopyVersion]);

  // '/' keyboard shortcut focuses global ticker search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (e.key === '/' && !inInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setOpenMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close popovers on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleSelectStock = (ticker: string) => {
    setQuery('');
    setSearchFocused(false);
    navigate(`/app/stock/${ticker}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSelectStock(searchResults[0].ticker);
    } else if (query.trim()) {
      const raw = query.trim().toUpperCase();
      setQuery('');
      setSearchFocused(false);
      navigate(`/app/stock/${encodeURIComponent(raw)}`);
    }
  };

  return (
    <header
      ref={topbarRef}
      className="sticky top-0 z-30 h-14 md:h-16 border-b border-white/8 bg-[#101512]/95 px-4 sm:px-6 flex items-center justify-between gap-3"
    >
      {/* Mobile Menu Trigger + Global Ticker Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0 max-w-xl">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open workspace navigation"
          className="md:hidden p-2 rounded-lg border border-white/10 bg-[#18211C] text-[#E8F0EA] min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative flex-1 min-w-0">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              className="w-4 h-4 text-[#91A197] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onFocus={() => {
                setSearchFocused(true);
                setOpenMenu(null);
              }}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Search ticker or company (e.g. RELIANCE, NVDA)..."
              aria-label="Global ticker search"
              className="w-full h-9 pl-9 pr-10 rounded-lg border border-white/10 bg-[#18211C] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/70 focus:border-[#36C982]/60 focus:outline-none"
            />
            <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono-num text-[#91A197] px-1.5 py-0.5 rounded bg-[#141C17] border border-white/8">
              /
            </kbd>
          </form>

          {searchFocused && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-white/12 bg-[#18211C] shadow-2xl overflow-hidden z-50">
              <div className="px-3 py-2 border-b border-white/8 text-[11px] text-[#91A197] flex justify-between">
                <span>
                  {query.trim() ? 'Matching Equities' : 'Tracked Equities'}
                </span>
                <span>
                  {dataMode === 'demo' ? 'Demo data' : 'Real Data Mode'}
                </span>
              </div>
              {searchError ? (
                <div className="px-4 py-4 text-xs text-[#E06C65] text-center">
                  {searchError}
                </div>
              ) : searchLoading && searchResults.length === 0 ? (
                <div className="px-4 py-4 text-xs text-[#91A197] text-center">
                  Searching equities...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-5 text-xs text-[#91A197] text-center">
                  No stocks matched &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y divide-white/6">
                  {searchResults.map((stock) => {
                    const pos = (stock.change ?? 0) >= 0;
                    return (
                      <li key={stock.ticker}>
                        <button
                          type="button"
                          onClick={() => handleSelectStock(stock.ticker)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-[#202B24] transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold font-mono-num text-[#E8F0EA]">
                              {stock.normalizedSymbol}{' '}
                              <span className="font-normal text-[#91A197]">
                                · {stock.feedStatus}
                              </span>
                            </div>
                            <div className="text-xs text-[#91A197] truncate">
                              {stock.name}
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono-num text-xs">
                            <div className="text-[#E8F0EA]">
                              {formatCurrency(
                                stock.price,
                                stock.currency,
                                preferences.currencyMode,
                                2,
                                fxUsdToInr
                              )}
                            </div>
                            <div
                              className={
                                stock.changePercent === null
                                  ? 'text-[#91A197]'
                                  : pos
                                  ? 'text-[#36C982]'
                                  : 'text-[#E06C65]'
                              }
                            >
                              {formatSignedPercent(stock.changePercent)}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {dataMode === 'demo' && (
          <div className="hidden lg:flex items-center">
            <DemoDataBadge compact />
          </div>
        )}

        {/* Demo / Real Data Mode Switch */}
        <div
          className="inline-flex items-center rounded-lg bg-[#141C17] p-0.5 border border-white/8"
          role="group"
          aria-label="Data source mode"
        >
          {(['demo', 'real'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDataMode(m)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                dataMode === m
                  ? m === 'demo'
                    ? 'bg-[#D4A857]/20 text-[#E9C98A]'
                    : 'bg-[#214B37] text-[#A5EBC3]'
                  : 'text-[#91A197] hover:text-[#E8F0EA]'
              }`}
            >
              {m === 'demo' ? 'Demo' : 'Real'}
            </button>
          ))}
        </div>

        {/* Market Filter Segmented Control */}
        <div
          className="hidden sm:inline-flex items-center rounded-lg bg-[#141C17] p-0.5 border border-white/8"
          role="group"
          aria-label="Global market filter"
        >
          {(['All', 'India', 'US'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMarket(m as 'All' | MarketRegion)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeMarket === m
                  ? 'bg-[#214B37] text-[#A5EBC3]'
                  : 'text-[#91A197] hover:text-[#E8F0EA]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((m) => (m === 'notifications' ? null : 'notifications'))
            }
            aria-label="Feed status notifications"
            className="relative p-2 rounded-lg border border-white/8 bg-[#18211C] text-[#91A197] hover:text-[#E8F0EA] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="sr-only">{unreadCount} unread notifications</span>
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-[#36C982] text-[#101512] text-[10px] font-mono-num font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {openMenu === 'notifications' && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/12 bg-[#18211C] shadow-2xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#E8F0EA]">
                  Feed &amp; Provider Status
                </span>
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-[11px] text-[#A5EBC3] hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-white/6 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-xs text-[#91A197]">
                    No status alerts.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        markNotificationRead(item.id);
                        setOpenMenu(null);
                        if (item.ticker) navigate(`/app/stock/${item.ticker}`);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-[#202B24] transition-colors ${
                        item.read ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-[#E8F0EA]">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-[#91A197] shrink-0">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#91A197] leading-snug">
                        {item.detail}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Display Preferences Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'prefs' ? null : 'prefs'))}
            aria-label="Display preferences"
            className="p-2 rounded-lg border border-white/8 bg-[#18211C] text-[#91A197] hover:text-[#E8F0EA] transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {openMenu === 'prefs' && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/12 bg-[#18211C] shadow-2xl p-4 space-y-3 z-50">
              <div className="text-xs font-semibold text-[#E8F0EA]">
                Display Preferences
              </div>

              <div>
                <span className="text-[11px] text-[#91A197] block mb-1">
                  Default Chart Style
                </span>
                <div className="grid grid-cols-2 gap-1 bg-[#141C17] p-0.5 rounded-lg border border-white/8">
                  {(['candlestick', 'line'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updatePreferences({ defaultChartType: t })}
                      className={`py-1 rounded text-xs capitalize ${
                        preferences.defaultChartType === t
                          ? 'bg-[#214B37] text-[#A5EBC3]'
                          : 'text-[#91A197]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-[#91A197] block mb-1">
                  Currency Format
                </span>
                <div className="grid grid-cols-3 gap-1 bg-[#141C17] p-0.5 rounded-lg border border-white/8">
                  {(['Native', 'INR', 'USD'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updatePreferences({ currencyMode: c })}
                      className={`py-1 rounded text-xs ${
                        preferences.currencyMode === c
                          ? 'bg-[#214B37] text-[#A5EBC3]'
                          : 'text-[#91A197]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/8">
                <Link
                  to="/app/settings"
                  onClick={() => setOpenMenu(null)}
                  className="text-xs text-[#A5EBC3] hover:underline"
                >
                  Open full settings →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Account / Guest Profile Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() =>
              setOpenMenu((m) => (m === 'profile' ? null : 'profile'))
            }
            aria-label="Account profile"
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-white/8 bg-[#18211C] text-xs text-[#E8F0EA] hover:border-white/20 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-[#A5EBC3]" />
            <span className="hidden lg:inline whitespace-nowrap max-w-[140px] truncate">
              {user ? user.name : 'Guest'}
            </span>
          </button>

          {openMenu === 'profile' && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/12 bg-[#18211C] shadow-2xl p-4 space-y-2.5 z-50">
              <div>
                <div className="text-xs font-semibold text-[#E8F0EA] truncate">
                  {user ? user.name : 'Guest Workspace'}
                </div>
                <div className="text-[11px] text-[#91A197] truncate">
                  {user
                    ? `${user.email} · MongoDB Sync`
                    : 'Local Storage Watchlist'}
                </div>
              </div>
              <div className="pt-2 border-t border-white/8 space-y-1.5 text-xs">
                <Link
                  to="/app/watchlist"
                  onClick={() => setOpenMenu(null)}
                  className="block py-1 text-[#91A197] hover:text-[#E8F0EA]"
                >
                  Saved Watchlist ({watchlist.length})
                </Link>
                <Link
                  to="/app/settings"
                  onClick={() => setOpenMenu(null)}
                  className="block py-1 text-[#91A197] hover:text-[#E8F0EA]"
                >
                  Workspace Settings
                </Link>
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      void logoutUser();
                    }}
                    className="block w-full text-left py-1 text-[#E06C65] hover:underline"
                  >
                    Sign Out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setOpenMenu(null)}
                    className="block py-1 text-[#A5EBC3] hover:underline"
                  >
                    Sign In / Register
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { StockCard } from '../components/StockCard';
import { StockTable } from '../components/StockTable';
import { useAppContext } from '../context/AppContext';
import { useQuoteRefresh } from '../hooks/useQuoteRefresh';
import { apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import type { ApiProviderMeta, StockRecord } from '../types/market';

export const WatchlistPage: React.FC = () => {
  const {
    user,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    dataMode,
    bhavcopyStats,
    bhavcopyVersion,
  } = useAppContext();
  const [search, setSearch] = useState('');
  const [pickerTicker, setPickerTicker] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const [allStocks, setAllStocks] = useState<StockRecord[]>([]);
  const [meta, setMeta] = useState<ApiProviderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const removeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const reqIdRef = useRef(0);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    apiClient
      .getStocks({ market: 'All', mode: dataMode, symbols: watchlist }, controller.signal)
      .then((res) => {
        if (reqId !== reqIdRef.current) return;
        setAllStocks(res.stocks);
        setMeta(res.meta);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err) || reqId !== reqIdRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load watchlist equity quotes.'
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [retryToken, dataMode, watchlist]);

  useQuoteRefresh(dataMode === 'real' ? meta : null, retry);

  const effectiveAllStocks = useMemo(() => {
    if (dataMode === 'demo') return allStocks;
    void bhavcopyVersion;
    return bhavcopyStore.overlayStocks(allStocks);
  }, [allStocks, dataMode, bhavcopyVersion]);

  const stockByTicker = useMemo(() => {
    const map = new Map<string, StockRecord>();
    for (const s of effectiveAllStocks) map.set(s.ticker, s);
    return map;
  }, [effectiveAllStocks]);

  const savedStocks = useMemo(() => {
    const items = watchlist
      .map((t) => {
        const tracked = stockByTicker.get(t);
        if (tracked) return tracked;
        return dataMode === 'real' ? bhavcopyStore.getStandaloneStockRecord(t) : undefined;
      })
      .filter((s): s is StockRecord => Boolean(s));
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        s.normalizedSymbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }, [watchlist, stockByTicker, search, dataMode, bhavcopyVersion]);

  const availableToAdd = useMemo(
    () => allStocks.filter((s) => !watchlist.includes(s.ticker)),
    [allStocks, watchlist]
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickerTicker) return;
    addToWatchlist(pickerTicker);
    setPickerTicker('');
  };

  const handleRemoveWithFocus = (ticker: string, idx: number) => {
    const remaining = savedStocks.filter((s) => s.ticker !== ticker);
    const nextFocusTicker =
      remaining[idx]?.ticker ?? remaining[idx - 1]?.ticker ?? null;
    removeFromWatchlist(ticker);
    requestAnimationFrame(() => {
      if (nextFocusTicker && removeButtonRefs.current[nextFocusTicker]) {
        removeButtonRefs.current[nextFocusTicker]?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#91A197] flex flex-wrap items-center gap-2">
            <span>
              {user
                ? `Synced to MongoDB account (${user.email})`
                : 'Saved locally for guest session'}{' '}
              ·{' '}
              {dataMode === 'demo'
                ? 'Demo mode quotes'
                : 'Quotes synchronized with configured feeds & local Bhavcopy EOD'}
            </span>
            {dataMode === 'demo' && <DemoDataBadge compact />}
            {!user && (
              <Link to="/login" className="text-[#A5EBC3] hover:underline">
                Sign in to sync
              </Link>
            )}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            Watchlist
          </h1>
        </div>

        <div className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8">
          {(
            [
              { id: 'grid', label: 'Cards' },
              { id: 'table', label: 'Table' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === tab.id
                  ? 'text-[#A5EBC3]'
                  : 'text-[#91A197] hover:text-[#E8F0EA]'
              }`}
            >
              {view === tab.id && (
                <motion.span
                  layoutId="watchlist-view-pill"
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 rounded-md bg-[#214B37]"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="rounded-xl border border-white/8 bg-[#18211C] p-4 flex flex-col md:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="watchlist-search" className="sr-only">
            Search saved stocks
          </label>
          <Search
            className="w-4 h-4 text-[#91A197] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            id="watchlist-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter saved tickers..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/70 focus:border-[#36C982] focus:outline-none"
          />
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <label htmlFor="watchlist-add-select" className="sr-only">
            Add stock to watchlist
          </label>
          <select
            id="watchlist-add-select"
            value={pickerTicker}
            onChange={(e) => setPickerTicker(e.target.value)}
            disabled={loading && allStocks.length === 0}
            className="h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] focus:border-[#36C982] focus:outline-none disabled:opacity-60"
          >
            <option value="">
              {loading && allStocks.length === 0
                ? 'Loading equities...'
                : availableToAdd.length === 0
                ? 'All tracked equities saved'
                : 'Select stock to add...'}
            </option>
            {availableToAdd.map((s) => (
              <option key={s.ticker} value={s.ticker}>
                {s.normalizedSymbol} · {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!pickerTicker}
            className="h-9 px-3.5 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold hover:bg-[#A5EBC3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add
          </button>
        </form>
      </div>

      {dataMode === 'real' &&
        meta &&
        !meta.providers.gfdl.configured &&
        bhavcopyStats.totalRows === 0 &&
        savedStocks.some((s) => s.provider === 'GFDL') && (
          <div className="rounded-xl border border-white/10 bg-[#18211C] px-4 py-2.5 text-xs text-[#91A197]">
            <strong className="text-[#E8F0EA]">Indian market feed not connected</strong>{' '}
            — Watchlist NSE/BSE symbols are preserved locally and will show End of day closes once NSE CM-UDiFF Bhavcopy CSV files are imported or GFDL settings are added.
          </div>
        )}

      {/* Watchlist Content */}
      {error ? (
        <ApiErrorBanner
          title="Unable to load watchlist quotes"
          message={error}
          onRetry={retry}
        />
      ) : loading && allStocks.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-[#18211C] p-10 text-center space-y-3">
          <h2 className="font-display text-lg font-semibold text-[#E8F0EA]">
            Your watchlist is empty
          </h2>
          <p className="text-sm text-[#91A197] max-w-md mx-auto">
            Add Indian or US equities above or star them in the screener to track
            quotes, exchange identifiers, and daily change.
          </p>
          <Link
            to="/app/explore"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold"
          >
            Explore Equities
          </Link>
        </div>
      ) : view === 'table' ? (
        <StockTable
          stocks={savedStocks}
          emptyMessage="No saved stocks match your search."
        />
      ) : savedStocks.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-[#18211C] p-8 text-center text-sm text-[#91A197]">
          No saved stocks matched &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {savedStocks.map((stock, idx) => (
              <motion.div
                key={stock.ticker}
                layout="position"
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-1.5"
              >
                <StockCard stock={stock} />
                <div className="flex justify-end px-1">
                  <button
                    ref={(el) => {
                      removeButtonRefs.current[stock.ticker] = el;
                    }}
                    type="button"
                    onClick={() => handleRemoveWithFocus(stock.ticker, idx)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#91A197] hover:text-[#E06C65] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#36C982] rounded px-1"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    Remove {stock.ticker}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

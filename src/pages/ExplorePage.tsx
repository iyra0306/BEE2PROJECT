import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { StockTable } from '../components/StockTable';
import { useAppContext } from '../context/AppContext';
import { apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import type { ApiProviderMeta, MarketRegion, StockRecord } from '../types/market';

export const ExplorePage: React.FC = () => {
  const {
    activeMarket,
    setActiveMarket,
    dataMode,
    watchlist,
    bhavcopyStats,
    bhavcopyVersion,
  } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<string>('All');
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [priceFilter, setPriceFilter] = useState<string>('All');
  const [performanceFilter, setPerformanceFilter] = useState<
    'All' | 'Gainers' | 'Losers'
  >('All');

  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [meta, setMeta] = useState<ApiProviderMeta | null>(null);
  const [pricedCount, setPricedCount] = useState(0);
  const [universeLabel, setUniverseLabel] = useState(
    'Tracked India (NSE/BSE) & US (NASDAQ/NYSE) Universe'
  );
  const [sectorList, setSectorList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const reqIdRef = useRef(0);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(
      async () => {
        try {
          const res = await apiClient.getStocks(
            {
              market: activeMarket,
              q: searchQuery.trim() || undefined,
              exchange: exchangeFilter,
              sector: sectorFilter,
              priceTier: priceFilter,
              performance: performanceFilter,
              mode: dataMode,
              symbols: watchlist,
            },
            controller.signal
          );
          if (reqId !== reqIdRef.current) return;
          const resolved =
            dataMode === 'real'
              ? bhavcopyStore.overlayStocks(res.stocks)
              : res.stocks;
          setStocks(resolved);
          setMeta(res.meta);
          setPricedCount(resolved.filter((s) => s.price !== null).length);
          setUniverseLabel(res.trackedUniverseLabel);
          setSectorList(res.sectors);
          setLoading(false);
        } catch (err) {
          if (isAbortError(err) || reqId !== reqIdRef.current) return;
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load equity screener data.'
          );
          setLoading(false);
        }
      },
      searchQuery.trim() ? 150 : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeMarket,
    searchQuery,
    exchangeFilter,
    sectorFilter,
    priceFilter,
    performanceFilter,
    retryToken,
    dataMode,
    watchlist,
    bhavcopyVersion,
  ]);

  const sectors = useMemo(() => ['All', ...sectorList], [sectorList]);
  const exchanges = ['All', 'NSE', 'BSE', 'NASDAQ', 'NYSE'];

  const handleReset = () => {
    setSearchQuery('');
    setActiveMarket('All');
    setExchangeFilter('All');
    setSectorFilter('All');
    setPriceFilter('All');
    setPerformanceFilter('All');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#91A197] flex flex-wrap items-center gap-2">
            <span>Equity Screener · {universeLabel}</span>
            {dataMode === 'demo' && <DemoDataBadge compact />}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            Explore Stocks
          </h1>
        </div>
        <div className="text-xs font-mono-num text-[#91A197]">
          Showing <strong className="text-[#E8F0EA]">{stocks.length}</strong>{' '}
          tracked equities ·{' '}
          <strong className="text-[#A5EBC3]">{pricedCount}</strong>{' '}
          {dataMode === 'demo' ? 'demo quotes' : 'with quotes'}
          {loading ? ' · Updating...' : ''}
        </div>
      </div>

      {/* Screener Filter Bar */}
      <section
        aria-label="Screener filters"
        className="rounded-xl border border-white/8 bg-[#18211C] p-4 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <label htmlFor="screener-search" className="sr-only">
              Search ticker or company
            </label>
            <Search
              className="w-4 h-4 text-[#91A197] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="screener-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by symbol (e.g. NSE:RELIANCE, NVDA) or company..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/70 focus:border-[#36C982] focus:outline-none"
            />
          </div>

          {/* Exchange Filter */}
          <div>
            <label htmlFor="filter-exchange" className="sr-only">
              Exchange
            </label>
            <select
              id="filter-exchange"
              value={exchangeFilter}
              onChange={(e) => setExchangeFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] focus:border-[#36C982] focus:outline-none"
            >
              {exchanges.map((ex) => (
                <option key={ex} value={ex}>
                  {ex === 'All' ? 'All Exchanges' : ex}
                </option>
              ))}
            </select>
          </div>

          {/* Sector Filter */}
          <div>
            <label htmlFor="filter-sector" className="sr-only">
              Sector
            </label>
            <select
              id="filter-sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] focus:border-[#36C982] focus:outline-none"
            >
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 'All' ? 'All Sectors' : sec}
                </option>
              ))}
            </select>
          </div>

          {/* Price Tier Filter */}
          <div>
            <label htmlFor="filter-price" className="sr-only">
              Price band
            </label>
            <select
              id="filter-price"
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] focus:border-[#36C982] focus:outline-none"
            >
              <option value="All">All Prices (Native)</option>
              <option value="under500">Under 500</option>
              <option value="500to2000">500 – 2,000</option>
              <option value="over2000">Above 2,000</option>
            </select>
          </div>
        </div>

        {/* Segmented Market + Gainers/Losers + Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8"
              role="group"
              aria-label="Market selection"
            >
              {(['All', 'India', 'US'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveMarket(m as 'All' | MarketRegion)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeMarket === m
                      ? 'bg-[#214B37] text-[#A5EBC3]'
                      : 'text-[#91A197] hover:text-[#E8F0EA]'
                  }`}
                >
                  {m === 'All' ? 'All Markets' : m}
                </button>
              ))}
            </div>

            <div
              className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8"
              role="group"
              aria-label="Gainers and losers filter"
            >
              {(['All', 'Gainers', 'Losers'] as const).map((perf) => (
                <button
                  key={perf}
                  type="button"
                  onClick={() => setPerformanceFilter(perf)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    performanceFilter === perf
                      ? 'bg-[#214B37] text-[#A5EBC3]'
                      : 'text-[#91A197] hover:text-[#E8F0EA]'
                  }`}
                >
                  {perf}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#141C17] text-xs text-[#91A197] hover:text-[#E8F0EA] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset Filters
          </button>
        </div>
      </section>

      {dataMode === 'real' &&
        meta &&
        !meta.providers.gfdl.configured &&
        bhavcopyStats.totalRows === 0 &&
        activeMarket !== 'US' && (
          <div className="rounded-xl border border-white/10 bg-[#18211C] px-4 py-2.5 text-xs text-[#91A197] flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-[#E8F0EA]">Indian market feed not connected</strong>{' '}
              — NSE and BSE equities show unavailable until optional GFDL settings or NSE CM-UDiFF Bhavcopy CSV files are added.
            </span>
            <span className="font-mono-num text-[#A5EBC3]">
              {meta.providers.twelveData.configured
                ? 'Twelve Data US watchlist active'
                : 'US feed also unconfigured'}
            </span>
          </div>
        )}

      {error ? (
        <ApiErrorBanner
          title="Screener request failed"
          message={error}
          onRetry={retry}
        />
      ) : loading && stocks.length === 0 ? (
        <LoadingSkeleton variant="table" rows={8} />
      ) : (
        <StockTable
          stocks={stocks}
          emptyMessage={
            performanceFilter !== 'All' || priceFilter !== 'All'
              ? `No priced equities match the "${performanceFilter}" / price filter combination. Ensure provider credentials are configured.`
              : 'No equities match your current filter combination. Try resetting filters.'
          }
        />
      )}
    </div>
  );
};

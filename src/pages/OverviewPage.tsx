import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BrainCircuit, Newspaper, Radio, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { ArticleModal } from '../components/ArticleModal';
import { ChartContainer, ChartMode } from '../components/ChartContainer';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { MarketIndexCard } from '../components/MarketIndexCard';
import { NewsCard } from '../components/NewsCard';
import { PredictionCard } from '../components/PredictionCard';
import { useAppContext } from '../context/AppContext';
import { useQuoteRefresh } from '../hooks/useQuoteRefresh';
import { apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import type {
  ChartRange,
  MarketOverviewResponse,
  NewsArticle,
  StockPrediction,
  StockRecord,
} from '../types/market';
import {
  formatCurrency,
  formatProviderTimestamp,
  formatSignedPercent,
  formatVolume,
} from '../utils/formatters';

export const OverviewPage: React.FC = () => {
  const {
    activeMarket,
    dataMode,
    bhavcopyStats,
    bhavcopyVersion,
    watchlist,
    removeFromWatchlist,
    preferences,
    fxUsdToInr,
  } = useAppContext();

  const [selectedIndexId, setSelectedIndexId] = useState<string>('NIFTY50');
  const [range, setRange] = useState<ChartRange>(preferences.defaultRange);
  const [chartType, setChartType] = useState<ChartMode>(
    preferences.defaultChartType
  );
  const [moverTab, setMoverTab] = useState<'gainers' | 'losers' | 'active'>(
    'gainers'
  );
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const [overview, setOverview] = useState<MarketOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [allStocks, setAllStocks] = useState<StockRecord[]>([]);
  const [newsState, setNewsState] = useState<{
    connected: boolean;
    message?: string;
    articles: NewsArticle[];
  }>({ connected: false, articles: [] });
  const [predState, setPredState] = useState<{
    connected: boolean;
    message?: string;
    prediction: StockPrediction | null;
  }>({ connected: false, prediction: null });
  const [auxError, setAuxError] = useState<string | null>(null);

  const [retryToken, setRetryToken] = useState(0);
  const overviewReqIdRef = useRef(0);
  const auxReqIdRef = useRef(0);

  const retryAll = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  // Load overview indices, index history, and top movers from /api/market/overview
  useEffect(() => {
    const reqId = ++overviewReqIdRef.current;
    const controller = new AbortController();
    setOverviewLoading(true);
    setOverviewError(null);

    apiClient
      .getMarketOverview(
        {
          market: activeMarket,
          indexId: selectedIndexId,
          range,
          mode: dataMode,
          symbols: watchlist,
        },
        controller.signal
      )
      .then((res) => {
        if (reqId !== overviewReqIdRef.current) return;
        setOverview(res);
        setOverviewLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err) || reqId !== overviewReqIdRef.current) return;
        setOverviewError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch market overview from API.'
        );
        setOverviewLoading(false);
      });

    return () => controller.abort();
  }, [activeMarket, selectedIndexId, range, retryToken, dataMode, watchlist]);

  // Load universe stocks, news status, and prediction service status
  useEffect(() => {
    const reqId = ++auxReqIdRef.current;
    const controller = new AbortController();
    setAuxError(null);

    Promise.all([
      apiClient.getStocks(
        { market: 'All', mode: dataMode, symbols: watchlist },
        controller.signal
      ),
      apiClient.getNews({ mode: dataMode }, controller.signal),
      apiClient.getPrediction('NVDA', '14D', dataMode, controller.signal),
    ])
      .then(([stocksRes, newsRes, predRes]) => {
        if (reqId !== auxReqIdRef.current) return;
        setAllStocks(stocksRes.stocks);
        setNewsState({
          connected: newsRes.connected,
          message: newsRes.message,
          articles: newsRes.articles.slice(0, 3),
        });
        setPredState({
          connected: predRes.connected,
          message: predRes.message,
          prediction: predRes.prediction,
        });
      })
      .catch((err) => {
        if (isAbortError(err) || reqId !== auxReqIdRef.current) return;
        setAuxError(
          err instanceof Error
            ? err.message
            : 'Unable to load watchlist quotes or feed status.'
        );
      });

    return () => controller.abort();
  }, [retryToken, dataMode, watchlist]);

  // Stream / rate-limited poll refresh when providers are configured in Real mode
  useQuoteRefresh(dataMode === 'real' ? overview?.meta : undefined, retryAll);

  const effectiveAllStocks = useMemo(() => {
    if (dataMode === 'demo') return allStocks;
    void bhavcopyVersion;
    return bhavcopyStore.overlayStocks(allStocks);
  }, [allStocks, dataMode, bhavcopyVersion]);

  const stockMap = useMemo(() => {
    const map = new Map<string, StockRecord>();
    for (const s of effectiveAllStocks) map.set(s.ticker, s);
    return map;
  }, [effectiveAllStocks]);

  const watchlistStocks = useMemo(
    () =>
      watchlist
        .map((t) => {
          const tracked = stockMap.get(t);
          if (tracked) return tracked;
          return dataMode === 'real' ? bhavcopyStore.getStandaloneStockRecord(t) : undefined;
        })
        .filter((s): s is StockRecord => Boolean(s)),
    [watchlist, stockMap, dataMode, bhavcopyVersion]
  );

  const activeMoversList = useMemo(() => {
    if (!overview) return [];
    if (dataMode === 'demo') {
      return moverTab === 'gainers'
        ? overview.movers.gainers
        : moverTab === 'losers'
        ? overview.movers.losers
        : overview.movers.mostActive;
    }

    // Recompute movers using Bhavcopy EOD overlay in Real mode when market includes India
    const scoped =
      activeMarket === 'All'
        ? effectiveAllStocks
        : effectiveAllStocks.filter((s) => s.market === activeMarket);
    const priced = scoped.filter((s) => s.price !== null && s.changePercent !== null);
    if (moverTab === 'gainers') {
      return [...priced]
        .filter((s) => (s.changePercent ?? 0) > 0)
        .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
        .slice(0, 4);
    }
    if (moverTab === 'losers') {
      return [...priced]
        .filter((s) => (s.changePercent ?? 0) < 0)
        .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
        .slice(0, 4);
    }
    return [...scoped]
      .filter((s) => s.volume !== null && s.volume > 0)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 4);
  }, [overview, moverTab, dataMode, activeMarket, effectiveAllStocks]);

  const gfdlHealth = overview?.meta.providers.gfdl;
  const tdHealth = overview?.meta.providers.twelveData;

  return (
    <div className="space-y-6">
      {/* Terminal Header Strip */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-3 border-b border-white/8">
        <div>
          <div className="text-xs text-[#91A197] flex flex-wrap items-center gap-2">
            <span>Market Intelligence Terminal</span>
            <span aria-hidden="true">·</span>
            {dataMode === 'demo' ? (
              <DemoDataBadge compact />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#E8F0EA]">
                <Radio className="w-3 h-3 text-[#36C982]" aria-hidden="true" />
                {overview?.meta.streamingActive
                  ? 'WebSocket Stream Active'
                  : overview?.meta.mode === 'unconfigured'
                  ? bhavcopyStats.totalRows > 0
                    ? `NSE Bhavcopy End of day (${bhavcopyStats.latestDate})`
                    : 'No Live Provider Credentials Configured'
                  : `Rate-Limited Polling (${Math.round(
                      (overview?.meta.recommendedPollMs ?? 90000) / 1000
                    )}s)`}
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            Market Overview
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[#91A197] font-mono-num">
          {dataMode === 'demo' ? (
            <span>Mode: Simulated Demo Dataset · Scope: {activeMarket}</span>
          ) : (
            <>
              <span>
                India:{' '}
                <strong
                  className={
                    gfdlHealth?.configured || bhavcopyStats.totalRows > 0
                      ? 'text-[#36C982]'
                      : 'text-[#D4A857]'
                  }
                >
                  {gfdlHealth?.configured
                    ? gfdlHealth.feedStatus
                    : bhavcopyStats.totalRows > 0
                    ? `End of day (${bhavcopyStats.latestDate})`
                    : 'Unavailable'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Twelve Data:{' '}
                <strong
                  className={
                    tdHealth?.configured ? 'text-[#36C982]' : 'text-[#D4A857]'
                  }
                >
                  {tdHealth?.configured ? tdHealth.feedStatus : 'Unavailable'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>Scope: {activeMarket}</span>
            </>
          )}
        </div>
      </div>

      {overviewError && (
        <ApiErrorBanner
          title="Market overview unavailable"
          message={overviewError}
          onRetry={retryAll}
        />
      )}

      {/* Optional Feed Status Notice in Real data mode */}
      {dataMode === 'real' &&
        overview &&
        ((!overview.meta.providers.gfdl.configured && bhavcopyStats.totalRows === 0) ||
          !overview.meta.providers.twelveData.configured) && (
          <div className="rounded-xl border border-white/10 bg-[#18211C] px-4 py-3 text-xs text-[#91A197] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {!overview.meta.providers.gfdl.configured &&
                bhavcopyStats.totalRows === 0 && (
                  <span>
                    <strong className="text-[#E8F0EA]">
                      Indian market feed not connected
                    </strong>{' '}
                    (NSE/BSE, NIFTY 50, SENSEX unavailable — import NSE CM-UDiFF Bhavcopy CSV in{' '}
                    <Link to="/app/settings" className="text-[#A5EBC3] underline">
                      Settings
                    </Link>{' '}
                    or add GFDL settings).
                  </span>
                )}
              {!overview.meta.providers.twelveData.configured && (
                <span>
                  <strong className="text-[#E8F0EA]">
                    US market feed not connected
                  </strong>{' '}
                  (NASDAQ/NYSE, IXIC, SPX unavailable until optional TWELVE_DATA_API_KEY is added).
                </span>
              )}
            </div>
            <span className="font-mono-num text-[11px] text-[#A5EBC3] shrink-0">
              Real mode · Zero simulated values
            </span>
          </div>
        )}

      {/* Compact Market Index Strip */}
      <section aria-label="Market indices">
        {overviewLoading && !overview ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
        ) : overview ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {overview.indices.map((idx) => (
              <MarketIndexCard
                key={idx.id}
                index={idx}
                compact
                active={overview.selectedIndex.id === idx.id}
                onSelect={(selected) => setSelectedIndexId(selected.id)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* Primary Chart Center + Watchlist Docked Alongside on Desktop */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-8">
          {overviewLoading && !overview ? (
            <LoadingSkeleton variant="chart" />
          ) : overview ? (
            <div className="relative">
              <ChartContainer
                bars={overview.indexHistory}
                currency={overview.selectedIndex.currency}
                range={range}
                onRangeChange={setRange}
                chartType={chartType}
                onChartTypeChange={setChartType}
                showVolume={preferences.showVolumeByDefault}
                fxUsdToInr={fxUsdToInr}
                height={380}
                title={`${overview.selectedIndex.normalizedSymbol} — ${overview.selectedIndex.name}`}
                subtitle={`${overview.historyStatus.provider} · ${
                  overview.historyStatus.feedStatus
                }${overview.historyStatus.stale ? ' (Stale)' : ''} · ${
                  overview.historyStatus.providerTimestamp
                    ? formatProviderTimestamp(overview.historyStatus.providerTimestamp)
                    : overview.historyStatus.unavailableReason ?? 'No provider timestamp'
                }${overviewLoading ? ' · Updating...' : ''}`}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 bg-[#18211C] p-10 text-center text-sm text-[#91A197]">
              Index chart unavailable until API connection recovers.
            </div>
          )}
        </div>

        {/* Side Watchlist Research Panel */}
        <aside
          aria-label="Watchlist panel"
          className="xl:col-span-4 rounded-xl border border-white/8 bg-[#18211C] flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold font-display text-[#E8F0EA]">
                Watchlist
              </h2>
              <p className="text-[11px] text-[#91A197]">
                {watchlist.length} tracked locally
              </p>
            </div>
            <Link
              to="/app/watchlist"
              className="text-xs font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
            >
              Manage
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex-1 divide-y divide-white/6 overflow-y-auto max-h-[380px]">
            {auxError && allStocks.length === 0 ? (
              <div className="p-4 text-xs text-[#E06C65] space-y-2">
                <p>{auxError}</p>
                <button
                  type="button"
                  onClick={retryAll}
                  className="text-[#A5EBC3] underline"
                >
                  Retry
                </button>
              </div>
            ) : allStocks.length === 0 && watchlist.length > 0 ? (
              <div className="p-4">
                <LoadingSkeleton variant="line" rows={4} />
              </div>
            ) : watchlistStocks.length === 0 ? (
              <div className="p-6 text-xs text-[#91A197] space-y-2">
                <p>Your watchlist is empty.</p>
                <Link
                  to="/app/explore"
                  className="inline-block text-[#A5EBC3] underline"
                >
                  Screen equities to pin tickers
                </Link>
              </div>
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {watchlistStocks.map((stock) => {
                  const pos = (stock.change ?? 0) >= 0;
                  return (
                    <motion.div
                      key={stock.ticker}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.22 }}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#202B24]/70 transition-colors"
                    >
                      <Link
                        to={`/app/stock/${stock.ticker}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-1.5 font-mono-num">
                          <span className="text-sm font-semibold text-[#E8F0EA] hover:text-[#A5EBC3]">
                            {stock.normalizedSymbol}
                          </span>
                          <FeedStatusBadge
                            status={stock.feedStatus}
                            stale={stock.stale}
                            compact
                          />
                        </div>
                        <div className="text-[11px] text-[#91A197] truncate">
                          {stock.name} ·{' '}
                          {formatProviderTimestamp(stock.providerTimestamp)}
                        </div>
                      </Link>

                      <div className="text-right font-mono-num shrink-0">
                        <div className="text-xs font-semibold text-[#E8F0EA]">
                          {formatCurrency(
                            stock.price,
                            stock.currency,
                            preferences.currencyMode,
                            2,
                            fxUsdToInr
                          )}
                        </div>
                        <div
                          className={`text-[11px] ${
                            stock.changePercent === null
                              ? 'text-[#91A197]'
                              : pos
                              ? 'text-[#36C982]'
                              : 'text-[#E06C65]'
                          }`}
                        >
                          {formatSignedPercent(stock.changePercent)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromWatchlist(stock.ticker)}
                        aria-label={`Remove ${stock.ticker} from watchlist`}
                        className="p-1 rounded text-[#A5EBC3] hover:text-[#E06C65] transition-colors shrink-0"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-white/8 bg-[#141C17] flex items-center justify-between text-[11px] text-[#91A197]">
            <span>Saved locally · Quotes from API</span>
            <Link
              to="/app/explore"
              className="text-[#A5EBC3] hover:text-[#36C982] font-medium"
            >
              + Add Equities
            </Link>
          </div>
        </aside>
      </div>

      {/* Market Movers Terminal Table Strip */}
      {overview && (
        <section className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold font-display text-[#E8F0EA]">
                Market Movers · {activeMarket}
              </h2>
              <p className="text-[11px] text-[#91A197]">
                {overview.meta.universeLabel} ({activeMoversList.length} shown ·{' '}
                {dataMode === 'demo'
                  ? 'Demo data'
                  : `${effectiveAllStocks.filter((s) => s.price !== null).length}/${
                      effectiveAllStocks.length
                    } priced`}
                )
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8">
                {(
                  [
                    { id: 'gainers', label: 'Gainers' },
                    { id: 'losers', label: 'Losers' },
                    { id: 'active', label: 'Active' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMoverTab(tab.id)}
                    className={`relative px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      moverTab === tab.id
                        ? 'text-[#A5EBC3]'
                        : 'text-[#91A197] hover:text-[#E8F0EA]'
                    }`}
                  >
                    {moverTab === tab.id && (
                      <motion.span
                        layoutId="overview-mover-tab"
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 rounded bg-[#214B37]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>

              <Link
                to="/app/explore"
                className="text-xs font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
              >
                Screener
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {activeMoversList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#91A197] space-y-1">
              {!gfdlHealth?.configured && activeMarket !== 'US' && (
                <div className="text-sm font-medium text-[#E8F0EA]">
                  Indian market feed not connected
                </div>
              )}
              <p>
                No priced {moverTab} available in the tracked {activeMarket} universe.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeMarket}-${moverTab}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 md:gap-px bg-white/6"
              >
                {activeMoversList.map((stock) => {
                  const pos = (stock.change ?? 0) >= 0;
                  return (
                    <Link
                      key={stock.ticker}
                      to={`/app/stock/${stock.ticker}`}
                      className="px-4 py-3 bg-[#18211C] flex items-center justify-between gap-3 hover:bg-[#202B24] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold font-mono-num text-[#E8F0EA]">
                          {stock.normalizedSymbol}
                        </div>
                        <div className="text-xs text-[#91A197] truncate">
                          {stock.name} · {stock.feedStatus}
                        </div>
                      </div>
                      <div className="text-right font-mono-num shrink-0">
                        <div className="text-sm font-medium text-[#E8F0EA]">
                          {formatCurrency(
                            stock.price,
                            stock.currency,
                            preferences.currencyMode,
                            2,
                            fxUsdToInr
                          )}
                        </div>
                        <div
                          className={`text-xs ${
                            moverTab === 'active'
                              ? 'text-[#A5EBC3]'
                              : pos
                              ? 'text-[#36C982]'
                              : 'text-[#E06C65]'
                          }`}
                        >
                          {moverTab === 'active'
                            ? `Vol ${formatVolume(stock.volume)}`
                            : formatSignedPercent(stock.changePercent)}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </section>
      )}

      {/* AI Prediction Centre Status */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
                AI Prediction Centre
              </h2>
              {dataMode === 'demo' && <DemoDataBadge compact />}
            </div>
            <p className="text-xs text-[#91A197]">
              {dataMode === 'demo'
                ? 'Illustrative demo forecast trajectory and evaluation metrics.'
                : 'Model outputs and backtest evaluation metrics from Python prediction endpoint.'}
            </p>
          </div>
          <Link
            to="/app/predictions"
            className="text-xs font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
          >
            Open Prediction Centre
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {predState.connected && predState.prediction ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PredictionCard
              prediction={predState.prediction}
              stock={stockMap.get(predState.prediction.ticker)}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-white/8 bg-[#18211C] p-6 flex items-center gap-4">
            <BrainCircuit className="w-5 h-5 text-[#91A197] shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-[#E8F0EA]">
                {predState.message ?? 'Prediction service not connected'}
              </div>
              <p className="text-xs text-[#91A197] mt-0.5">
                Configure <code className="text-[#A5EBC3]">PYTHON_PREDICTION_URL</code> on the server to display model targets and evaluation metrics.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Market News */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
              Market News
            </h2>
            <p className="text-xs text-[#91A197]">
              Headlines and disclosures from connected news provider.
            </p>
          </div>
          <Link
            to="/app/news"
            className="text-xs font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
          >
            All News
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {!newsState.connected ? (
          <div className="rounded-xl border border-white/8 bg-[#18211C] p-6 flex items-center gap-4">
            <Newspaper className="w-5 h-5 text-[#91A197] shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-[#E8F0EA]">
                {newsState.message ?? 'News feed not connected.'}
              </div>
              <p className="text-xs text-[#91A197] mt-0.5">
                No licensed news provider endpoint is currently connected. Configure{' '}
                <code className="text-[#A5EBC3]">NEWS_API_URL</code> on the server when licensed news access is available.
              </p>
            </div>
          </div>
        ) : newsState.articles.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-[#18211C] p-6 text-xs text-[#91A197]">
            No articles returned by the connected news feed.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {newsState.articles.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                onOpen={setActiveArticle}
              />
            ))}
          </div>
        )}
      </section>

      <ArticleModal
        article={activeArticle}
        onClose={() => setActiveArticle(null)}
      />
    </div>
  );
};

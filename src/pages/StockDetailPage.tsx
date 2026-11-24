import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  Newspaper,
  Star,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { ArticleModal } from '../components/ArticleModal';
import { ChartContainer, ChartMode } from '../components/ChartContainer';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { NewsCard } from '../components/NewsCard';
import { useAppContext } from '../context/AppContext';
import { ApiError, apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import type {
  ChartRange,
  FeedStatus,
  NewsArticle,
  OhlcvBar,
  StockRecord,
} from '../types/market';
import {
  formatCurrency,
  formatMarketCap,
  formatProviderTimestamp,
  formatSignedNumber,
  formatSignedPercent,
  formatVolume,
} from '../utils/formatters';
import { summarizeIndicators } from '../utils/indicators';

export const StockDetailPage: React.FC = () => {
  const { ticker = 'RELIANCE' } = useParams<{ ticker: string }>();
  const normalizedTicker = ticker.trim().toUpperCase();
  const {
    isInWatchlist,
    toggleWatchlist,
    preferences,
    fxUsdToInr,
    dataMode,
    bhavcopyVersion,
  } = useAppContext();

  const [range, setRange] = useState<ChartRange>(preferences.defaultRange);
  const [chartType, setChartType] = useState<ChartMode>(
    preferences.defaultChartType
  );
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const [stock, setStock] = useState<StockRecord | null>(null);
  const [relatedNewsState, setRelatedNewsState] = useState<{
    connected: boolean;
    articles: NewsArticle[];
    message?: string;
  }>({ connected: false, articles: [] });
  const [indicatorBars, setIndicatorBars] = useState<OhlcvBar[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [notFoundSuggestions, setNotFoundSuggestions] = useState<string[]>([]);
  const [isNotFound, setIsNotFound] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [historyMeta, setHistoryMeta] = useState<{
    feedStatus: FeedStatus;
    stale: boolean;
    providerTimestamp: string | null;
    unavailableReason?: string;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [retryToken, setRetryToken] = useState(0);
  const detailReqIdRef = useRef(0);
  const historyReqIdRef = useRef(0);

  const retryAll = useCallback(() => setRetryToken((t) => t + 1), []);

  // Load company profile, fundamentals, related news, and 6M indicator bars
  useEffect(() => {
    const reqId = ++detailReqIdRef.current;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setIsNotFound(false);
    setNotFoundSuggestions([]);

    (async () => {
      try {
        await bhavcopyStore.hydrate();
        const [detailRes, indRes] = await Promise.all([
          apiClient.getStock(normalizedTicker, dataMode, controller.signal),
          apiClient.getStockHistory(
            normalizedTicker,
            '6M',
            dataMode,
            controller.signal
          ),
        ]);
        if (reqId !== detailReqIdRef.current) return;

        const nextStock =
          dataMode === 'real'
            ? bhavcopyStore.overlayStockRecord(detailRes.stock)
            : detailRes.stock;
        let nextIndicatorBars = indRes.bars;

        if (
          dataMode === 'real' &&
          nextIndicatorBars.length === 0 &&
          nextStock.exchange === 'NSE'
        ) {
          const eodInd = bhavcopyStore.getHistoryBars(nextStock.ticker, '6M');
          if (eodInd.bars.length > 0) {
            nextIndicatorBars = eodInd.bars;
          }
        }

        setStock(nextStock);
        setRelatedNewsState(detailRes.relatedNews);
        setIndicatorBars(nextIndicatorBars);
        setDetailLoading(false);
      } catch (err) {
        if (isAbortError(err) || reqId !== detailReqIdRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          if (dataMode === 'real') {
            const standalone =
              bhavcopyStore.getStandaloneStockRecord(normalizedTicker);
            if (standalone) {
              const eodInd = bhavcopyStore.getHistoryBars(standalone.ticker, '6M');
              setStock(standalone);
              setRelatedNewsState({
                connected: false,
                articles: [],
                message: 'News feed not connected.',
              });
              setIndicatorBars(eodInd.bars);
              setDetailLoading(false);
              return;
            }
          }
          setStock(null);
          setIsNotFound(true);
          const sugg = Array.isArray(err.details?.suggestions)
            ? (err.details?.suggestions as string[])
            : ['RELIANCE', 'TCS', 'INFY', 'NVDA', 'AAPL', 'MSFT'];
          setNotFoundSuggestions(sugg);
          setDetailLoading(false);
          return;
        }
        setDetailError(
          err instanceof Error
            ? err.message
            : 'Unable to load equity profile from API.'
        );
        setDetailLoading(false);
      }
    })();

    return () => controller.abort();
  }, [normalizedTicker, dataMode, bhavcopyVersion, retryToken]);

  // Load selected chart range history independently with race-condition protection
  useEffect(() => {
    const reqId = ++historyReqIdRef.current;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError(null);

    (async () => {
      try {
        await bhavcopyStore.hydrate();
        const res = await apiClient.getStockHistory(
          normalizedTicker,
          range,
          dataMode,
          controller.signal
        );
        if (reqId !== historyReqIdRef.current) return;

        if (dataMode === 'real' && res.bars.length === 0) {
          const eod = bhavcopyStore.getHistoryBars(normalizedTicker, range);
          if (eod.bars.length > 0) {
            setBars(eod.bars);
            setHistoryMeta({
              feedStatus: 'End of day',
              stale: false,
              providerTimestamp: eod.providerTimestamp,
              unavailableReason: eod.insufficientReason,
            });
            setHistoryLoading(false);
            return;
          }
        }

        setBars(res.bars);
        setHistoryMeta({
          feedStatus: res.feedStatus,
          stale: res.stale,
          providerTimestamp: res.providerTimestamp,
          unavailableReason: res.unavailableReason,
        });
        setHistoryLoading(false);
      } catch (err) {
        if (isAbortError(err) || reqId !== historyReqIdRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          if (dataMode === 'real') {
            const eod = bhavcopyStore.getHistoryBars(normalizedTicker, range);
            if (eod.bars.length > 0) {
              setBars(eod.bars);
              setHistoryMeta({
                feedStatus: 'End of day',
                stale: false,
                providerTimestamp: eod.providerTimestamp,
                unavailableReason: eod.insufficientReason,
              });
              setHistoryLoading(false);
              return;
            }
          }
          setBars([]);
          setHistoryLoading(false);
          return;
        }
        setHistoryError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch historical price bars.'
        );
        setHistoryLoading(false);
      }
    })();

    return () => controller.abort();
  }, [normalizedTicker, range, dataMode, bhavcopyVersion, retryToken]);

  const techSummary = useMemo(
    () => summarizeIndicators(indicatorBars),
    [indicatorBars]
  );

  const recentHistoricalRows = useMemo(() => {
    return [...bars].slice(-12).reverse();
  }, [bars]);

  if (detailLoading && !stock) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="chart" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#18211C] p-8 max-w-2xl mx-auto text-center space-y-5 my-8">
        <h1 className="font-display text-2xl font-bold text-[#E8F0EA]">
          Ticker &ldquo;{normalizedTicker}&rdquo; Not Found
        </h1>
        <p className="text-sm text-[#91A197]">
          This symbol could not be resolved in the tracked universe, connected provider feeds, or imported Bhavcopy files. Choose a tracked ticker below or return to the screener.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {notFoundSuggestions.map((sym) => (
            <Link
              key={sym}
              to={`/app/stock/${sym}`}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#141C17] text-xs font-mono-num text-[#A5EBC3] hover:border-[#36C982]/50"
            >
              {sym}
            </Link>
          ))}
        </div>
        <div>
          <Link
            to="/app/explore"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Screener
          </Link>
        </div>
      </div>
    );
  }

  if (detailError || !stock) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/explore"
          className="inline-flex items-center gap-1.5 text-xs text-[#91A197] hover:text-[#E8F0EA] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Screener
        </Link>
        <ApiErrorBanner
          title={`Failed to load ${normalizedTicker}`}
          message={detailError || 'Equity data is currently unavailable.'}
          onRetry={retryAll}
        />
      </div>
    );
  }

  const saved = isInWatchlist(stock.ticker);
  const hasPrice = stock.price !== null && Number.isFinite(stock.price);
  const isPos = (stock.change ?? 0) >= 0;
  const f = stock.fundamentals;
  const p = stock.profile;

  const formatMetric = (val: number | null | undefined, suffix = '') =>
    val !== null && val !== undefined && Number.isFinite(val)
      ? `${val.toFixed(2)}${suffix}`
      : 'Unavailable';

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/app/explore"
          className="inline-flex items-center gap-1.5 text-xs text-[#91A197] hover:text-[#E8F0EA] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to Screener
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/technical?ticker=${stock.ticker}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#18211C] text-xs font-medium text-[#E8F0EA] hover:border-white/25 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-[#36C982]" aria-hidden="true" />
            Technical Indicators
          </Link>
          <Link
            to={`/app/predictions?ticker=${stock.ticker}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#18211C] text-xs font-medium text-[#E8F0EA] hover:border-white/25 transition-colors"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-[#A5EBC3]" aria-hidden="true" />
            AI Prediction Centre
          </Link>
          <button
            type="button"
            onClick={() => toggleWatchlist(stock.ticker)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              saved
                ? 'bg-[#214B37] border-[#36C982]/50 text-[#A5EBC3]'
                : 'bg-[#36C982] border-transparent text-[#101512] hover:bg-[#A5EBC3]'
            }`}
          >
            <Star
              className="w-3.5 h-3.5"
              fill={saved ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
            {saved ? 'In Watchlist' : 'Add to Watchlist'}
          </button>
        </div>
      </div>

      {/* Company Identity & Price Header */}
      <div className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#91A197]">
            {dataMode === 'demo' && <DemoDataBadge compact />}
            <span className="font-mono-num text-[#A5EBC3] font-semibold">
              {stock.normalizedSymbol}
            </span>
            <span aria-hidden="true">·</span>
            <span>{stock.market} Equity ({stock.currency})</span>
            <span aria-hidden="true">·</span>
            <span>{stock.sector}</span>
            <span aria-hidden="true">·</span>
            <FeedStatusBadge
              status={stock.feedStatus}
              stale={stock.stale}
              provider={stock.provider}
            />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            {stock.name}
          </h1>

          {hasPrice ? (
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-bold font-mono-num text-[#E8F0EA]">
                {formatCurrency(
                  stock.price,
                  stock.currency,
                  preferences.currencyMode,
                  2,
                  fxUsdToInr
                )}
              </span>
              {stock.change !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-sm font-mono-num font-semibold ${
                    isPos ? 'text-[#36C982]' : 'text-[#E06C65]'
                  }`}
                >
                  {isPos ? (
                    <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                  )}
                  {formatSignedNumber(stock.change)} (
                  {formatSignedPercent(stock.changePercent)})
                </span>
              )}
              <span className="text-xs font-mono-num text-[#91A197]">
                As of {formatProviderTimestamp(stock.providerTimestamp)}
              </span>
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <div className="text-xl sm:text-2xl font-bold font-mono-num text-[#91A197]">
                {stock.provider === 'GFDL' &&
                (stock.unavailableReason?.includes('not connected') ?? true)
                  ? 'Indian market feed not connected'
                  : 'Quote Unavailable'}
              </div>
              <p className="text-xs text-[#91A197]">
                {stock.unavailableReason ??
                  `${stock.provider} quote unavailable for ${stock.normalizedSymbol}.`}
              </p>
            </div>
          )}
        </div>

        {/* OHLC + Session Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/8 text-xs font-mono-num">
          <div>
            <span className="text-[#91A197] block">Open</span>
            <span className="text-sm font-semibold text-[#E8F0EA]">
              {formatCurrency(
                stock.open,
                stock.currency,
                preferences.currencyMode,
                2,
                fxUsdToInr
              )}
            </span>
          </div>
          <div>
            <span className="text-[#91A197] block">Day High</span>
            <span className="text-sm font-semibold text-[#36C982]">
              {formatCurrency(
                stock.high,
                stock.currency,
                preferences.currencyMode,
                2,
                fxUsdToInr
              )}
            </span>
          </div>
          <div>
            <span className="text-[#91A197] block">Day Low</span>
            <span className="text-sm font-semibold text-[#E06C65]">
              {formatCurrency(
                stock.low,
                stock.currency,
                preferences.currencyMode,
                2,
                fxUsdToInr
              )}
            </span>
          </div>
          <div>
            <span className="text-[#91A197] block">Prev Close</span>
            <span className="text-sm font-semibold text-[#E8F0EA]">
              {formatCurrency(
                stock.previousClose,
                stock.currency,
                preferences.currencyMode,
                2,
                fxUsdToInr
              )}
            </span>
          </div>
          <div>
            <span className="text-[#91A197] block">Volume</span>
            <span className="text-sm font-semibold text-[#A5EBC3]">
              {formatVolume(stock.volume)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      {historyError ? (
        <ApiErrorBanner
          title="Historical chart data failed to load"
          message={historyError}
          onRetry={retryAll}
        />
      ) : historyLoading && bars.length === 0 ? (
        <LoadingSkeleton variant="chart" />
      ) : (
        <div className="space-y-3">
          {historyMeta?.unavailableReason && bars.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#18211C] px-4 py-3 flex items-start gap-2.5 text-xs text-[#91A197]">
              <AlertCircle
                className="w-4 h-4 text-[#D4A857] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <span className="font-medium text-[#E8F0EA]">
                  Insufficient historical dates:{' '}
                </span>
                {historyMeta.unavailableReason}
              </div>
            </div>
          )}
          <ChartContainer
            bars={bars}
            currency={stock.currency}
            currencyMode={preferences.currencyMode}
            fxUsdToInr={fxUsdToInr}
            range={range}
            onRangeChange={setRange}
            chartType={chartType}
            onChartTypeChange={setChartType}
            showVolume={preferences.showVolumeByDefault}
            height={400}
            title={`${stock.normalizedSymbol} Price & Volume`}
            subtitle={`${stock.provider} · ${
              historyMeta?.feedStatus ?? stock.feedStatus
            }${historyMeta?.stale ? ' (Stale)' : ''} · ${
              historyMeta?.providerTimestamp
                ? formatProviderTimestamp(historyMeta.providerTimestamp)
                : historyMeta?.unavailableReason ?? `Range: ${range}`
            }${historyLoading ? ' · Updating...' : ''}`}
          />
        </div>
      )}

      {/* Company Overview + Fundamentals + Quick Technicals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Company Overview & Profile */}
        <div className="lg:col-span-5 rounded-xl border border-white/8 bg-[#18211C] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
              Company Profile
            </h2>
            {p?.asOfDate && (
              <span className="text-[11px] font-mono-num text-[#91A197]">
                As of {p.asOfDate}
              </span>
            )}
          </div>
          {p?.description ? (
            <p className="text-sm text-[#91A197] leading-relaxed">
              {p.description}
            </p>
          ) : (
            <p className="text-xs text-[#91A197] leading-relaxed">
              {p?.unavailableReason ??
                'Company profile details are unavailable on the current provider configuration.'}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 pt-3 border-t border-white/8 text-xs">
            <div>
              <dt className="text-[#91A197]">Headquarters</dt>
              <dd className="text-[#E8F0EA] font-medium mt-0.5">
                {p?.headquarters ?? 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-[#91A197]">Chief Executive</dt>
              <dd className="text-[#E8F0EA] font-medium mt-0.5">
                {p?.ceo ?? 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-[#91A197]">Industry</dt>
              <dd className="text-[#E8F0EA] font-medium mt-0.5">
                {p?.industry ?? stock.sector}
              </dd>
            </div>
            <div>
              <dt className="text-[#91A197]">Employees</dt>
              <dd className="text-[#E8F0EA] font-medium mt-0.5 font-mono-num">
                {p?.employees ?? 'Unavailable'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Fundamentals Grid */}
        <div className="lg:col-span-4 rounded-xl border border-white/8 bg-[#18211C] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
              Fundamentals
            </h2>
            {f?.reportingDate && (
              <span className="text-[11px] font-mono-num text-[#A5EBC3]">
                Reported: {f.reportingDate}
              </span>
            )}
          </div>
          {f?.unavailableReason && !f.marketCap && !f.peRatio && !f.high52W && (
            <p className="text-xs text-[#91A197] leading-relaxed">
              {f.unavailableReason}
            </p>
          )}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
            <div>
              <span className="text-[#91A197] block">Market Cap</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatMarketCap(
                  f?.marketCap ?? stock.marketCap,
                  stock.currency,
                  preferences.currencyMode,
                  fxUsdToInr
                )}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">P/E Ratio</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatMetric(f?.peRatio, 'x')}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">P/B Ratio</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatMetric(f?.pbRatio, 'x')}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">ROE</span>
              <span className="font-mono-num text-sm font-semibold text-[#36C982]">
                {formatMetric(f?.roe, '%')}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">EPS (TTM)</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatCurrency(
                  f?.eps,
                  stock.currency,
                  preferences.currencyMode,
                  2,
                  fxUsdToInr
                )}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">Dividend Yield</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatMetric(f?.dividendYield, '%')}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">52W High</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatCurrency(
                  f?.high52W,
                  stock.currency,
                  preferences.currencyMode,
                  2,
                  fxUsdToInr
                )}
              </span>
            </div>
            <div>
              <span className="text-[#91A197] block">52W Low</span>
              <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
                {formatCurrency(
                  f?.low52W,
                  stock.currency,
                  preferences.currencyMode,
                  2,
                  fxUsdToInr
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Snapshot */}
        <div className="lg:col-span-3 rounded-xl border border-white/8 bg-[#18211C] p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
                Indicators
              </h2>
              <span
                className={`text-xs font-semibold ${
                  indicatorBars.length < 15
                    ? 'text-[#91A197]'
                    : techSummary.overallSignal === 'Bullish'
                    ? 'text-[#36C982]'
                    : techSummary.overallSignal === 'Bearish'
                    ? 'text-[#E06C65]'
                    : 'text-[#D4A857]'
                }`}
              >
                {indicatorBars.length < 15
                  ? 'Insufficient History'
                  : techSummary.overallSignal}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono-num">
              <div className="flex justify-between py-1.5 border-b border-white/6">
                <span className="text-[#91A197]">RSI (14)</span>
                <span className="text-[#E8F0EA]">
                  {techSummary.rsi14?.toFixed(2) ?? '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/6">
                <span className="text-[#91A197]">SMA (20)</span>
                <span className="text-[#E8F0EA]">
                  {techSummary.sma20
                    ? formatCurrency(
                        techSummary.sma20,
                        stock.currency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/6">
                <span className="text-[#91A197]">SMA (50)</span>
                <span className="text-[#E8F0EA]">
                  {techSummary.sma50
                    ? formatCurrency(
                        techSummary.sma50,
                        stock.currency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#91A197]">MACD</span>
                <span className="text-[#E8F0EA]">
                  {techSummary.macd ? techSummary.macd.macd.toFixed(2) : '—'}
                </span>
              </div>
            </div>
          </div>

          <Link
            to={`/app/technical?ticker=${stock.ticker}`}
            className="text-xs font-medium text-[#A5EBC3] hover:text-[#36C982]"
          >
            Open synchronized oscillator charts →
          </Link>
        </div>
      </div>

      {/* Historical Prices Table */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-[#E8F0EA]">
            Recent Historical Sessions ({range})
          </h2>
          <span className="text-xs font-mono-num text-[#91A197]">
            {stock.provider} OHLCV Ledger
          </span>
        </div>
        {recentHistoricalRows.length === 0 ? (
          <div className="p-6 text-xs text-[#91A197] text-center">
            {historyLoading
              ? 'Loading historical sessions...'
              : historyMeta?.unavailableReason ??
                'No historical rows returned for this range.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left border-collapse text-xs font-mono-num">
              <thead>
                <tr className="border-b border-white/8 bg-[#141C17] text-[#91A197]">
                  <th className="px-4 py-2.5 font-medium">Date / Time</th>
                  <th className="px-4 py-2.5 font-medium text-right">Open</th>
                  <th className="px-4 py-2.5 font-medium text-right">High</th>
                  <th className="px-4 py-2.5 font-medium text-right">Low</th>
                  <th className="px-4 py-2.5 font-medium text-right">Close</th>
                  <th className="px-4 py-2.5 font-medium text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {recentHistoricalRows.map((bar) => (
                  <tr key={bar.timestamp} className="hover:bg-[#202B24]/50">
                    <td className="px-4 py-2.5 text-[#E8F0EA]">
                      {bar.time.replace('T', ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#91A197]">
                      {formatCurrency(
                        bar.open,
                        stock.currency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#36C982]">
                      {formatCurrency(
                        bar.high,
                        stock.currency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#E06C65]">
                      {formatCurrency(
                        bar.low,
                        stock.currency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#E8F0EA] font-medium">
                      {formatCurrency(
                        bar.close,
                        stock.currency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#91A197]">
                      {formatVolume(bar.volume)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Related News */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
          Company &amp; Sector News
        </h2>
        {!relatedNewsState.connected ? (
          <div className="rounded-xl border border-white/8 bg-[#18211C] p-5 flex items-center gap-3 text-xs text-[#91A197]">
            <Newspaper className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{relatedNewsState.message ?? 'News feed not connected.'}</span>
          </div>
        ) : relatedNewsState.articles.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-[#18211C] p-5 text-xs text-[#91A197]">
            No recent articles matched {stock.normalizedSymbol}.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedNewsState.articles.map((article) => (
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

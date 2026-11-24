import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { AlertCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { ChartContainer, ChartMode } from '../components/ChartContainer';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useAppContext } from '../context/AppContext';
import { ApiError, apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import {
  ChartRange,
  FeedStatus,
  OhlcvBar,
  ProviderName,
  StockRecord,
} from '../types/market';
import { formatCurrency, formatProviderTimestamp } from '../utils/formatters';
import {
  MacdPoint,
  TimeValuePoint,
  calculateMACD,
  calculateRSI,
  summarizeIndicators,
} from '../utils/indicators';

function RsiChart({ data }: { data: TimeValuePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || data.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 170,
      layout: {
        background: { type: ColorType.Solid, color: '#141C17' },
        textColor: '#91A197',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)' },
    });

    const series = chart.addSeries(LineSeries, {
      color: '#36C982',
      lineWidth: 2,
    });
    series.setData(
      data.map((d) => ({ time: d.timestamp as UTCTimestamp, value: d.value }))
    );

    series.createPriceLine({
      price: 70,
      color: 'rgba(224, 108, 101, 0.55)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'OB 70',
    });
    series.createPriceLine({
      price: 30,
      color: 'rgba(54, 201, 130, 0.55)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'OS 30',
    });

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) chart.applyOptions({ width: w });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data]);

  return <div ref={ref} data-cursor="chart" className="w-full h-[170px]" />;
}

function MacdChart({ data }: { data: MacdPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || data.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 180,
      layout: {
        background: { type: ColorType.Solid, color: '#141C17' },
        textColor: '#91A197',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)' },
    });

    const hist = chart.addSeries(HistogramSeries, {});
    hist.setData(
      data.map((d) => ({
        time: d.timestamp as UTCTimestamp,
        value: d.histogram,
        color:
          d.histogram >= 0
            ? 'rgba(54, 201, 130, 0.45)'
            : 'rgba(224, 108, 101, 0.45)',
      }))
    );

    const macdLine = chart.addSeries(LineSeries, {
      color: '#A5EBC3',
      lineWidth: 2,
    });
    macdLine.setData(
      data.map((d) => ({ time: d.timestamp as UTCTimestamp, value: d.macd }))
    );

    const sigLine = chart.addSeries(LineSeries, {
      color: '#D4A857',
      lineWidth: 1,
    });
    sigLine.setData(
      data.map((d) => ({ time: d.timestamp as UTCTimestamp, value: d.signal }))
    );

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) chart.applyOptions({ width: w });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data]);

  return <div ref={ref} data-cursor="chart" className="w-full h-[180px]" />;
}

export const TechnicalAnalysisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, fxUsdToInr, dataMode, bhavcopyVersion, watchlist } =
    useAppContext();

  const initialTicker = searchParams.get('ticker')?.toUpperCase() || 'RELIANCE';
  const [selectedTicker, setSelectedTicker] = useState<string>(initialTicker);
  const [range, setRange] = useState<ChartRange>('6M');
  const [chartType, setChartType] = useState<ChartMode>('candlestick');
  const [overlays, setOverlays] = useState({
    sma20: true,
    sma50: true,
    ema12: false,
    ema26: false,
    bollinger: true,
  });

  const [allStocks, setAllStocks] = useState<StockRecord[]>([]);
  const [stock, setStock] = useState<StockRecord | null>(null);
  const [bars, setBars] = useState<OhlcvBar[]>([]);
  const [historyMeta, setHistoryMeta] = useState<{
    feedStatus: FeedStatus;
    stale: boolean;
    provider: ProviderName;
    providerTimestamp: string | null;
    unavailableReason?: string;
  }>({
    feedStatus: 'Unavailable',
    stale: false,
    provider: 'None',
    providerTimestamp: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const listReqIdRef = useRef(0);
  const seriesReqIdRef = useRef(0);

  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  // Load universe for stock selector
  useEffect(() => {
    const reqId = ++listReqIdRef.current;
    const controller = new AbortController();

    (async () => {
      try {
        await bhavcopyStore.hydrate();
        const res = await apiClient.getStocks(
          { market: 'All', mode: dataMode, symbols: watchlist },
          controller.signal
        );
        if (reqId !== listReqIdRef.current) return;

        let stocks =
          dataMode === 'real'
            ? bhavcopyStore.overlayStocks(res.stocks)
            : res.stocks;

        const cleanSelected = selectedTicker.replace(/^NSE:/, '');
        let exists = stocks.some(
          (s) =>
            s.ticker === selectedTicker ||
            s.ticker === cleanSelected ||
            s.normalizedSymbol === selectedTicker
        );

        if (!exists && dataMode === 'real') {
          const standalone = bhavcopyStore.getStandaloneStockRecord(selectedTicker);
          if (standalone) {
            stocks = [standalone, ...stocks];
            exists = true;
          }
        }

        setAllStocks(stocks);
        if (!exists && stocks.length > 0) {
          setSelectedTicker('RELIANCE');
        }
      } catch (err) {
        if (isAbortError(err) || reqId !== listReqIdRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Unable to fetch stock universe.'
        );
      }
    })();

    return () => controller.abort();
  }, [dataMode, bhavcopyVersion, watchlist, retryToken]);

  // Load selected stock details and history bars with race protection
  useEffect(() => {
    const reqId = ++seriesReqIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await bhavcopyStore.hydrate();
        const [detailRes, histRes] = await Promise.all([
          apiClient.getStock(selectedTicker, dataMode, controller.signal),
          apiClient.getStockHistory(
            selectedTicker,
            range,
            dataMode,
            controller.signal
          ),
        ]);
        if (reqId !== seriesReqIdRef.current) return;

        const nextStock =
          dataMode === 'real'
            ? bhavcopyStore.overlayStockRecord(detailRes.stock)
            : detailRes.stock;
        setStock(nextStock);

        if (
          dataMode === 'real' &&
          histRes.bars.length === 0 &&
          nextStock.exchange === 'NSE'
        ) {
          const eod = bhavcopyStore.getHistoryBars(nextStock.ticker, range);
          if (eod.bars.length > 0) {
            setBars(eod.bars);
            setHistoryMeta({
              feedStatus: 'End of day',
              stale: false,
              provider: 'Bhavcopy CSV',
              providerTimestamp: eod.providerTimestamp,
              unavailableReason: eod.insufficientReason,
            });
            setLoading(false);
            return;
          }
        }

        setBars(histRes.bars);
        setHistoryMeta({
          feedStatus: histRes.feedStatus,
          stale: histRes.stale,
          provider: histRes.provider,
          providerTimestamp: histRes.providerTimestamp,
          unavailableReason: histRes.unavailableReason,
        });
        setLoading(false);
      } catch (err) {
        if (isAbortError(err) || reqId !== seriesReqIdRef.current) return;
        if (err instanceof ApiError && err.status === 404 && dataMode === 'real') {
          const standalone = bhavcopyStore.getStandaloneStockRecord(selectedTicker);
          if (standalone) {
            const eod = bhavcopyStore.getHistoryBars(standalone.ticker, range);
            setStock(standalone);
            setBars(eod.bars);
            setHistoryMeta({
              feedStatus: eod.bars.length > 0 ? 'End of day' : 'Unavailable',
              stale: false,
              provider: 'Bhavcopy CSV',
              providerTimestamp: eod.providerTimestamp,
              unavailableReason: eod.insufficientReason,
            });
            setLoading(false);
            return;
          }
        }
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load technical analysis series.'
        );
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedTicker, range, dataMode, bhavcopyVersion, retryToken]);

  const rsiData = useMemo(() => calculateRSI(bars, 14), [bars]);
  const macdData = useMemo(() => calculateMACD(bars, 12, 26, 9), [bars]);
  const summary = useMemo(() => summarizeIndicators(bars), [bars]);

  const totalSignals =
    summary.bullishCount + summary.neutralCount + summary.bearishCount;

  const handleSelectTicker = (t: string) => {
    setSelectedTicker(t);
    setSearchParams({ ticker: t });
  };

  const toggleOverlay = (key: keyof typeof overlays) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCurrency = stock?.currency ?? 'INR';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#91A197]">
            {dataMode === 'demo' && <DemoDataBadge compact />}
            <span>{stock?.normalizedSymbol ?? selectedTicker}</span>
            <span aria-hidden="true">·</span>
            <span>
              Computed from {bars.length} OHLCV bars ({range})
            </span>
            <span aria-hidden="true">·</span>
            <FeedStatusBadge
              status={historyMeta.feedStatus}
              stale={historyMeta.stale}
              provider={historyMeta.provider}
            />
            {historyMeta.providerTimestamp && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">
                  {formatProviderTimestamp(historyMeta.providerTimestamp)}
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            Technical Analysis
          </h1>
        </div>

        <div>
          <label htmlFor="tech-stock" className="sr-only">
            Select equity
          </label>
          <select
            id="tech-stock"
            value={stock?.ticker ?? selectedTicker}
            onChange={(e) => handleSelectTicker(e.target.value)}
            disabled={allStocks.length === 0}
            className="h-9 px-3 rounded-lg border border-white/12 bg-[#18211C] text-sm text-[#E8F0EA] focus:border-[#36C982] focus:outline-none disabled:opacity-60"
          >
            {allStocks.length === 0 ? (
              <option value={selectedTicker}>{selectedTicker}</option>
            ) : (
              allStocks.map((s) => (
                <option key={s.normalizedSymbol} value={s.ticker}>
                  {s.normalizedSymbol} — {s.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {error ? (
        <ApiErrorBanner
          title="Technical series unavailable"
          message={error}
          onRetry={retry}
        />
      ) : loading && bars.length === 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
          <LoadingSkeleton variant="chart" />
        </div>
      ) : (
        <>
          {historyMeta.unavailableReason && (
            <div className="rounded-xl border border-white/10 bg-[#18211C] p-4 flex items-start gap-3 text-xs text-[#91A197]">
              <AlertCircle
                className="w-4 h-4 text-[#D4A857] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <span className="font-medium text-[#E8F0EA]">
                  {bars.length === 0 &&
                  stock?.provider === 'GFDL' &&
                  historyMeta.unavailableReason.includes('not connected')
                    ? 'Indian market feed not connected'
                    : `Insufficient historical bars for ${stock?.normalizedSymbol ?? selectedTicker}`}
                  :{' '}
                </span>
                {historyMeta.unavailableReason}
              </div>
            </div>
          )}

          {/* Trend Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
              <span className="text-xs text-[#91A197] block">
                Trend Summary ({range})
              </span>
              {totalSignals === 0 ? (
                <>
                  <div className="text-lg font-bold mt-1 text-[#91A197]">
                    Insufficient history
                  </div>
                  <p className="text-xs text-[#91A197] mt-1">
                    {bars.length === 0
                      ? 'No candles available from provider.'
                      : `Loaded ${bars.length} bar${bars.length === 1 ? '' : 's'}; import more Bhavcopy dates or choose a longer range for moving average signals.`}
                  </p>
                </>
              ) : (
                <>
                  <div
                    className={`text-xl font-bold mt-1 ${
                      summary.overallSignal === 'Bullish'
                        ? 'text-[#36C982]'
                        : summary.overallSignal === 'Bearish'
                        ? 'text-[#E06C65]'
                        : 'text-[#D4A857]'
                    }`}
                  >
                    {summary.overallSignal}
                  </div>
                  <p className="text-xs text-[#91A197] mt-1 font-mono-num">
                    {summary.bullishCount} Bullish · {summary.neutralCount} Neutral ·{' '}
                    {summary.bearishCount} Bearish
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
              <span className="text-xs text-[#91A197] block">
                SMA (20) / SMA (50)
              </span>
              <div className="text-sm font-bold font-mono-num text-[#E8F0EA] mt-1.5">
                {summary.sma20 !== null
                  ? formatCurrency(
                      summary.sma20,
                      activeCurrency,
                      preferences.currencyMode,
                      2,
                      fxUsdToInr
                    )
                  : 'Unavailable'}{' '}
                /{' '}
                {summary.sma50 !== null
                  ? formatCurrency(
                      summary.sma50,
                      activeCurrency,
                      preferences.currencyMode,
                      2,
                      fxUsdToInr
                    )
                  : 'Unavailable'}
              </div>
              <p className="text-xs text-[#91A197] mt-1">
                {summary.sma50 === null
                  ? 'Requires at least 50 bars in range.'
                  : 'Moving average trend overlays'}
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
              <span className="text-xs text-[#91A197] block">RSI (14)</span>
              <div className="text-xl font-bold font-mono-num text-[#E8F0EA] mt-1">
                {summary.rsi14 !== null ? summary.rsi14.toFixed(2) : 'Unavailable'}
              </div>
              <p className="text-xs text-[#91A197] mt-1">
                {summary.rsi14 === null
                  ? 'Requires at least 15 bars in range.'
                  : summary.rsi14 > 70
                  ? 'Overbought region (>70)'
                  : summary.rsi14 < 30
                  ? 'Oversold region (<30)'
                  : 'Neutral momentum zone (30–70)'}
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
              <span className="text-xs text-[#91A197] block">
                MACD (12, 26, 9)
              </span>
              <div className="text-xl font-bold font-mono-num text-[#E8F0EA] mt-1">
                {summary.macd ? summary.macd.macd.toFixed(2) : 'Unavailable'}
              </div>
              <p className="text-xs text-[#91A197] mt-1 font-mono-num">
                {summary.macd
                  ? `Signal ${summary.macd.signal.toFixed(2)} · Hist ${summary.macd.histogram.toFixed(2)}`
                  : 'Requires at least 35 bars in range.'}
              </p>
            </div>
          </div>

          {/* Overlay Toggle Bar */}
          <div className="rounded-xl border border-white/8 bg-[#18211C] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#91A197]">
              Price Chart Overlays
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'sma20', label: 'SMA 20' },
                  { key: 'sma50', label: 'SMA 50' },
                  { key: 'ema12', label: 'EMA 12' },
                  { key: 'ema26', label: 'EMA 26' },
                  { key: 'bollinger', label: 'Bollinger (20,2)' },
                ] as const
              ).map((item) => {
                const active = overlays[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleOverlay(item.key)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-[#214B37] border-[#36C982]/50 text-[#A5EBC3]'
                        : 'bg-[#141C17] border-white/8 text-[#91A197] hover:text-[#E8F0EA]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Synchronized Price + Overlays + Volume */}
          <ChartContainer
            bars={bars}
            currency={activeCurrency}
            currencyMode={preferences.currencyMode}
            fxUsdToInr={fxUsdToInr}
            range={range}
            onRangeChange={setRange}
            chartType={chartType}
            onChartTypeChange={setChartType}
            showVolume
            overlays={overlays}
            height={360}
            title={`${stock?.normalizedSymbol ?? selectedTicker} Price, Overlays & Volume`}
            subtitle={`Bollinger, SMA & EMA overlays derived from ${historyMeta.provider} ${range} OHLCV${
              loading ? ' (Updating...)' : ''
            }`}
          />

          {/* Synchronized RSI & MACD Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RSI Panel */}
            <div className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#E8F0EA]">
                    Relative Strength Index · RSI (14)
                  </h2>
                  <p className="text-xs text-[#91A197]">
                    70 Overbought / 30 Oversold reference levels
                  </p>
                </div>
                <span className="font-mono-num text-xs text-[#A5EBC3]">
                  {summary.rsi14 !== null ? summary.rsi14.toFixed(2) : '—'}
                </span>
              </div>

              {rsiData.length > 0 ? (
                <RsiChart data={rsiData} />
              ) : (
                <div className="h-[170px] flex flex-col items-center justify-center p-6 text-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#D4A857]" aria-hidden="true" />
                  <div className="text-sm font-medium text-[#E8F0EA]">
                    {bars.length === 0
                      ? 'Insufficient history — No candles loaded'
                      : `RSI (14) Unavailable for ${range}`}
                  </div>
                  <p className="text-xs text-[#91A197] max-w-xs">
                    {bars.length === 0
                      ? historyMeta.unavailableReason ||
                        'Connect the market data provider to compute RSI(14).'
                      : `Current range contains ${bars.length} bars; RSI(14) requires at least 15 bars. Switch to 1M or higher.`}
                  </p>
                </div>
              )}
            </div>

            {/* MACD Panel */}
            <div className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#E8F0EA]">
                    MACD (12, 26, 9)
                  </h2>
                  <p className="text-xs text-[#91A197]">
                    Mint: MACD · Gold: Signal · Bars: Histogram
                  </p>
                </div>
                <span className="font-mono-num text-xs text-[#A5EBC3]">
                  {summary.macd ? summary.macd.macd.toFixed(2) : '—'}
                </span>
              </div>

              {macdData.length > 0 ? (
                <MacdChart data={macdData} />
              ) : (
                <div className="h-[180px] flex flex-col items-center justify-center p-6 text-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#D4A857]" aria-hidden="true" />
                  <div className="text-sm font-medium text-[#E8F0EA]">
                    {bars.length === 0
                      ? 'Insufficient history — No candles loaded'
                      : `MACD (12, 26, 9) Unavailable for ${range}`}
                  </div>
                  <p className="text-xs text-[#91A197] max-w-xs">
                    {bars.length === 0
                      ? historyMeta.unavailableReason ||
                        'Connect the market data provider to compute MACD(12, 26, 9).'
                      : `Current range contains ${bars.length} bars; MACD requires at least 34 bars. Switch to 3M or higher.`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { NeuralGraphic } from '../components/NeuralGraphic';
import { useAppContext } from '../context/AppContext';
import { apiClient, isAbortError } from '../services/apiClient';
import {
  HorizonType,
  PredictionPoint,
  StockPrediction,
  StockRecord,
} from '../types/market';
import {
  formatCurrency,
  formatProviderTimestamp,
  formatSignedPercent,
} from '../utils/formatters';

const HORIZONS: HorizonType[] = ['7D', '14D', '30D', '90D'];

function ForecastChart({
  series,
  mode,
}: {
  series: PredictionPoint[];
  mode: 'forecast' | 'backtest';
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 310,
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
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(165, 235, 195, 0.35)',
          labelBackgroundColor: '#214B37',
        },
        horzLine: {
          color: 'rgba(165, 235, 195, 0.35)',
          labelBackgroundColor: '#214B37',
        },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)' },
    });

    const historicalPts = series.filter((p) => p.actual !== undefined);
    const futurePts = series.filter((p) => p.actual === undefined);
    const bridgePt = historicalPts[historicalPts.length - 1];

    if (mode === 'forecast') {
      const histSeries = chart.addSeries(LineSeries, {
        color: '#E8F0EA',
        lineWidth: 2,
        title: 'Historical',
      });
      histSeries.setData(
        historicalPts.map((p) => ({
          time: p.timestamp as UTCTimestamp,
          value: p.actual as number,
        }))
      );

      const forecastData = [
        ...(bridgePt
          ? [{ time: bridgePt.timestamp as UTCTimestamp, value: bridgePt.actual as number }]
          : []),
        ...futurePts.map((p) => ({
          time: p.timestamp as UTCTimestamp,
          value: p.predicted,
        })),
      ];
      const predSeries = chart.addSeries(LineSeries, {
        color: '#36C982',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'Model Forecast',
      });
      predSeries.setData(forecastData);

      const upperSeries = chart.addSeries(LineSeries, {
        color: 'rgba(165, 235, 195, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
      });
      const lowerSeries = chart.addSeries(LineSeries, {
        color: 'rgba(165, 235, 195, 0.45)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
      });
      upperSeries.setData(
        futurePts
          .filter((p) => p.upper !== undefined)
          .map((p) => ({
            time: p.timestamp as UTCTimestamp,
            value: p.upper as number,
          }))
      );
      lowerSeries.setData(
        futurePts
          .filter((p) => p.lower !== undefined)
          .map((p) => ({
            time: p.timestamp as UTCTimestamp,
            value: p.lower as number,
          }))
      );
    } else {
      const actualSeries = chart.addSeries(LineSeries, {
        color: '#E8F0EA',
        lineWidth: 2,
        title: 'Actual',
      });
      const fittedSeries = chart.addSeries(LineSeries, {
        color: '#36C982',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: 'Model Fit',
      });
      actualSeries.setData(
        historicalPts.map((p) => ({
          time: p.timestamp as UTCTimestamp,
          value: p.actual as number,
        }))
      );
      fittedSeries.setData(
        historicalPts.map((p) => ({
          time: p.timestamp as UTCTimestamp,
          value: p.predicted,
        }))
      );
    }

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
  }, [series, mode]);

  return <div ref={containerRef} data-cursor="chart" className="w-full h-[310px]" />;
}

export const PredictionsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, fxUsdToInr, dataMode, watchlist } = useAppContext();

  const initialTicker = searchParams.get('ticker')?.toUpperCase() || 'NVDA';
  const [selectedTicker, setSelectedTicker] = useState<string>(initialTicker);
  const [horizon, setHorizon] = useState<HorizonType>('14D');
  const [viewMode, setViewMode] = useState<'forecast' | 'backtest'>('forecast');

  const [allStocks, setAllStocks] = useState<StockRecord[]>([]);
  const [stock, setStock] = useState<StockRecord | null>(null);
  const [connected, setConnected] = useState(false);
  const [serviceMessage, setServiceMessage] = useState<string | undefined>(undefined);
  const [prediction, setPrediction] = useState<StockPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const listReqIdRef = useRef(0);
  const predReqIdRef = useRef(0);
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  useEffect(() => {
    const reqId = ++listReqIdRef.current;
    const controller = new AbortController();

    apiClient
      .getStocks(
        { market: 'All', mode: dataMode, symbols: watchlist },
        controller.signal
      )
      .then((res) => {
        if (reqId !== listReqIdRef.current) return;
        setAllStocks(res.stocks);
        const exists = res.stocks.some(
          (s) =>
            s.ticker === selectedTicker ||
            s.normalizedSymbol === selectedTicker
        );
        if (!exists && res.stocks.length > 0) {
          setSelectedTicker('NVDA');
        }
      })
      .catch((err) => {
        if (isAbortError(err) || reqId !== listReqIdRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch stock universe.'
        );
      });

    return () => controller.abort();
  }, [dataMode, watchlist, retryToken]);

  useEffect(() => {
    const reqId = ++predReqIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      apiClient.getStock(selectedTicker, dataMode, controller.signal),
      apiClient.getPrediction(selectedTicker, horizon, dataMode, controller.signal),
    ])
      .then(([detailRes, predRes]) => {
        if (reqId !== predReqIdRef.current) return;
        setStock(detailRes.stock);
        setConnected(predRes.connected);
        setServiceMessage(predRes.message);
        setPrediction(predRes.prediction);
        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err) || reqId !== predReqIdRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to query prediction service.'
        );
        setLoading(false);
      });

    return () => controller.abort();
  }, [selectedTicker, horizon, dataMode, retryToken]);

  const handleSelectTicker = (t: string) => {
    setSelectedTicker(t);
    setSearchParams({ ticker: t });
  };

  const activeCurrency = stock?.currency ?? prediction?.currency ?? 'USD';
  const bandKey = `${stock?.ticker ?? selectedTicker}-${horizon}`;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#91A197]">
            {dataMode === 'demo' && <DemoDataBadge compact />}
            <span>
              {connected && prediction
                ? `${prediction.modelName ?? 'Python Prediction Model'}${
                    dataMode === 'demo' ? ' · Illustrative Forecast' : ''
                  } · ${
                    prediction.evaluatedAt
                      ? formatProviderTimestamp(prediction.evaluatedAt)
                      : 'Model Output'
                  }`
                : 'External Python Forecast Service'}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            AI Prediction Centre
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="pred-stock" className="sr-only">
              Select stock
            </label>
            <select
              id="pred-stock"
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

          <div
            className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8"
            role="group"
            aria-label="Forecast horizon"
          >
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={`relative px-3 py-1.5 rounded-md text-xs font-mono-num font-medium transition-colors ${
                  horizon === h
                    ? 'text-[#101512] font-semibold'
                    : 'text-[#91A197] hover:text-[#E8F0EA]'
                }`}
              >
                {horizon === h && (
                  <motion.span
                    layoutId="prediction-horizon-pill"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 rounded-md bg-[#36C982]"
                    aria-hidden="true"
                  />
                )}
                <span className="relative z-10">{h}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <ApiErrorBanner
          title="Prediction endpoint error"
          message={error}
          onRetry={retry}
        />
      ) : loading && !prediction ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
          <LoadingSkeleton variant="chart" />
        </div>
      ) : !connected || !prediction ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
          <div className="xl:col-span-7 rounded-xl border border-white/8 bg-[#18211C] p-8 flex flex-col justify-center gap-4">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#A5EBC3]">
              <BrainCircuit className="w-4 h-4" aria-hidden="true" />
              <span>Model Service Status · {stock?.normalizedSymbol ?? selectedTicker}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#E8F0EA]">
              {serviceMessage || 'Prediction service not connected'}
            </h2>
            <p className="text-sm text-[#91A197] leading-relaxed max-w-xl">
              BULLSIGHT does not display fabricated targets, confidence scores, or
              error metrics when the forecast backend is offline. Configure{' '}
              <span className="font-mono-num text-[#E8F0EA]">
                PYTHON_PREDICTION_URL
              </span>{' '}
              on the Express server to retrieve real model outputs, confidence bands,
              MAE, RMSE, and historical checkpoints for {horizon}.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
              <Link
                to={`/app/technical?ticker=${stock?.ticker ?? selectedTicker}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#214B37] text-[#A5EBC3] font-medium hover:bg-[#36C982] hover:text-[#101512] transition-colors"
              >
                Inspect Technical Indicators
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
              <Link
                to={`/app/stock/${stock?.ticker ?? selectedTicker}`}
                className="text-[#91A197] hover:text-[#E8F0EA]"
              >
                Open Stock Detail →
              </Link>
            </div>
          </div>

          <div className="xl:col-span-5">
            <NeuralGraphic
              signal="Neutral"
              confidence={0}
              pulseKey={bandKey}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Top KPI Summary */}
          <AnimatePresence mode="wait">
            <motion.div
              key={bandKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.24 }}
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
            >
              <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
                <span className="text-xs text-[#91A197] block">
                  Model Signal ({horizon})
                </span>
                <div
                  className={`mt-1.5 flex items-center gap-1.5 text-xl font-bold ${
                    prediction.signal === 'Bullish'
                      ? 'text-[#36C982]'
                      : prediction.signal === 'Bearish'
                      ? 'text-[#E06C65]'
                      : 'text-[#D4A857]'
                  }`}
                >
                  {prediction.signal === 'Bullish' ? (
                    <ArrowUpRight className="w-5 h-5" aria-hidden="true" />
                  ) : prediction.signal === 'Bearish' ? (
                    <ArrowDownRight className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="w-5 h-5" aria-hidden="true" />
                  )}
                  <span>{prediction.signal}</span>
                </div>
                <p className="text-xs text-[#91A197] mt-1">
                  Reference close:{' '}
                  <span className="font-mono-num text-[#E8F0EA]">
                    {formatCurrency(
                      prediction.currentPrice,
                      activeCurrency,
                      preferences.currencyMode,
                      2,
                      fxUsdToInr
                    )}
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
                <span className="text-xs text-[#91A197] block">
                  Model Target &amp; Interval
                </span>
                <div className="mt-1.5 text-xl font-bold font-mono-num text-[#E8F0EA]">
                  {formatCurrency(
                    prediction.predictedPrice,
                    activeCurrency,
                    preferences.currencyMode,
                    2,
                    fxUsdToInr
                  )}
                  <span
                    className={`ml-2 text-sm font-medium ${
                      prediction.expectedMovePercent >= 0
                        ? 'text-[#36C982]'
                        : 'text-[#E06C65]'
                    }`}
                  >
                    {formatSignedPercent(prediction.expectedMovePercent)}
                  </span>
                </div>
                <p className="text-xs font-mono-num text-[#91A197] mt-1">
                  Band:{' '}
                  {formatCurrency(
                    prediction.predictedLow,
                    activeCurrency,
                    preferences.currencyMode,
                    2,
                    fxUsdToInr
                  )}{' '}
                  –{' '}
                  {formatCurrency(
                    prediction.predictedHigh,
                    activeCurrency,
                    preferences.currencyMode,
                    2,
                    fxUsdToInr
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
                <div className="flex items-center justify-between text-xs text-[#91A197]">
                  <span>Model Confidence</span>
                  <span className="font-mono-num text-[#E8F0EA] font-semibold">
                    {prediction.confidence}%
                  </span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-[#101512] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.confidence}%` }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="h-full rounded-full bg-[#36C982]"
                  />
                </div>
                <p className="text-xs text-[#91A197] mt-2 font-mono-num">
                  Directional match: {prediction.directionalMatchRate.toFixed(1)}%
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-[#18211C] p-4">
                <span className="text-xs text-[#91A197] block">
                  Evaluation Metrics
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-2 font-mono-num">
                  <div>
                    <span className="text-[11px] text-[#91A197] block">MAE</span>
                    <span className="text-base font-bold text-[#E8F0EA]">
                      {formatCurrency(
                        prediction.mae,
                        activeCurrency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#91A197] block">RMSE</span>
                    <span className="text-base font-bold text-[#E8F0EA]">
                      {formatCurrency(
                        prediction.rmse,
                        activeCurrency,
                        preferences.currencyMode,
                        2,
                        fxUsdToInr
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Main Forecast / Backtest Chart + Neural Graphic */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-8 rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm font-bold text-[#E8F0EA]">
                    {viewMode === 'forecast'
                      ? `${stock?.normalizedSymbol ?? selectedTicker} Historical & ${horizon} Forecast Path`
                      : `${stock?.normalizedSymbol ?? selectedTicker} Actual vs Predicted`}
                  </h2>
                  <p className="text-xs text-[#91A197]">
                    Solid white: actual close · Dashed emerald: model trajectory · Dotted mint: confidence interval
                  </p>
                </div>

                <div className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8">
                  {(
                    [
                      { id: 'forecast', label: 'Forecast View' },
                      { id: 'backtest', label: 'Actual vs Predicted' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setViewMode(tab.id)}
                      className={`relative px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        viewMode === tab.id
                          ? 'text-[#A5EBC3]'
                          : 'text-[#91A197] hover:text-[#E8F0EA]'
                      }`}
                    >
                      {viewMode === tab.id && (
                        <motion.span
                          layoutId="prediction-view-mode"
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

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${bandKey}-${viewMode}`}
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.35 }}
                  transition={{ duration: 0.24 }}
                >
                  <ForecastChart series={prediction.series} mode={viewMode} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="xl:col-span-4 space-y-4">
              <NeuralGraphic
                signal={prediction.signal}
                confidence={prediction.confidence}
                pulseKey={bandKey}
              />

              <div className="rounded-xl border border-white/8 bg-[#18211C] p-4 space-y-3">
                <h3 className="text-sm font-semibold font-display text-[#E8F0EA]">
                  Model Feature Drivers
                </h3>
                <div className="space-y-2.5">
                  {prediction.drivers.map((d) => (
                    <div key={d.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#E8F0EA]">{d.label}</span>
                        <span className="font-mono-num text-[#91A197]">
                          {d.weight}% · {d.direction}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#101512] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, d.weight * 2.2)}%` }}
                          transition={{ duration: 0.32 }}
                          className="h-full rounded-full bg-[#36C982]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-white/8 flex justify-between items-center text-xs">
                  <Link
                    to={`/app/stock/${stock?.ticker ?? selectedTicker}`}
                    className="text-[#A5EBC3] hover:underline"
                  >
                    View {stock?.ticker ?? selectedTicker} Stock Detail →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Prediction History Table */}
          {prediction.history.length > 0 && (
            <section className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#E8F0EA]">
                  Prediction Evaluation Log ({stock?.ticker ?? selectedTicker})
                </h2>
                <span className="text-xs text-[#91A197]">
                  Verified historical checkpoints
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left border-collapse text-xs font-mono-num">
                  <thead>
                    <tr className="border-b border-white/8 bg-[#141C17] text-[#91A197]">
                      <th className="px-4 py-2.5 font-medium">Run Date</th>
                      <th className="px-4 py-2.5 font-medium">Horizon</th>
                      <th className="px-4 py-2.5 font-medium">Signal</th>
                      <th className="px-4 py-2.5 font-medium text-right">Target</th>
                      <th className="px-4 py-2.5 font-medium text-right">Actual</th>
                      <th className="px-4 py-2.5 font-medium text-right">Abs Error %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {prediction.history.map((row) => (
                      <tr key={row.id} className="hover:bg-[#202B24]/50">
                        <td className="px-4 py-2.5 text-[#E8F0EA]">{row.date}</td>
                        <td className="px-4 py-2.5 text-[#91A197]">{row.horizon}</td>
                        <td
                          className={`px-4 py-2.5 font-semibold ${
                            row.signal === 'Bullish'
                              ? 'text-[#36C982]'
                              : row.signal === 'Bearish'
                              ? 'text-[#E06C65]'
                              : 'text-[#D4A857]'
                          }`}
                        >
                          {row.signal}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#E8F0EA]">
                          {formatCurrency(
                            row.targetPrice,
                            activeCurrency,
                            preferences.currencyMode,
                            2,
                            fxUsdToInr
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#E8F0EA]">
                          {formatCurrency(
                            row.actualPrice,
                            activeCurrency,
                            preferences.currencyMode,
                            2,
                            fxUsdToInr
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#A5EBC3]">
                          {row.errorPercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

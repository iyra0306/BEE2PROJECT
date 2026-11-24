import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  IChartApi,
  LineSeries,
  LineStyle,
  UTCTimestamp,
  createChart,
} from 'lightweight-charts';
import { motion } from 'motion/react';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';
import { ChartRange, CurrencyCode, OhlcvBar } from '../types/market';
import { formatCurrency, formatVolume } from '../utils/formatters';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateSMA,
} from '../utils/indicators';

export type ChartMode = 'candlestick' | 'line';

interface OverlayToggles {
  sma20?: boolean;
  sma50?: boolean;
  ema12?: boolean;
  ema26?: boolean;
  bollinger?: boolean;
}

interface ChartContainerProps {
  bars: OhlcvBar[];
  currency: CurrencyCode;
  currencyMode?: 'Native' | 'USD' | 'INR';
  range: ChartRange;
  onRangeChange?: (range: ChartRange) => void;
  chartType?: ChartMode;
  onChartTypeChange?: (type: ChartMode) => void;
  showVolume?: boolean;
  overlays?: OverlayToggles;
  height?: number;
  title?: string;
  subtitle?: string;
  ranges?: ChartRange[];
  showControls?: boolean;
  animatedPreviewCrosshair?: boolean;
  fxUsdToInr?: number | null;
}

const ALL_RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

export const ChartContainer: React.FC<ChartContainerProps> = ({
  bars,
  currency,
  currencyMode = 'Native',
  range,
  onRangeChange,
  chartType = 'candlestick',
  onChartTypeChange,
  showVolume = true,
  overlays,
  height = 340,
  title,
  subtitle,
  ranges = ALL_RANGES,
  showControls = true,
  animatedPreviewCrosshair = false,
  fxUsdToInr = null,
}) => {
  const uid = useId();
  const reducedMotion = useReducedMotionSafe();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [hoverBar, setHoverBar] = useState<OhlcvBar | null>(null);
  const [userInteracting, setUserInteracting] = useState(false);
  const [scanIndex, setScanIndex] = useState(0);

  const latestBar = useMemo(
    () => (bars.length > 0 ? bars[bars.length - 1] : null),
    [bars]
  );

  // Automated subtle preview crosshair sweep for landing page preview until user interacts
  useEffect(() => {
    if (!animatedPreviewCrosshair || reducedMotion || userInteracting || bars.length < 4) {
      return;
    }
    const id = window.setInterval(() => {
      setScanIndex((prev) => (prev + 1) % bars.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [animatedPreviewCrosshair, reducedMotion, userInteracting, bars.length]);

  const previewScannedBar =
    animatedPreviewCrosshair && !userInteracting && bars.length > 0
      ? bars[Math.min(scanIndex, bars.length - 1)]
      : null;

  const displayBar = hoverBar ?? previewScannedBar ?? latestBar;
  const seriesKey = `${bars[0]?.timestamp ?? 0}-${bars.length}-${range}-${chartType}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#141C17' },
        textColor: '#91A197',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.045)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.055)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(165, 235, 195, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#214B37',
        },
        horzLine: {
          color: 'rgba(165, 235, 195, 0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#214B37',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: {
          top: 0.08,
          bottom: showVolume ? 0.26 : 0.08,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: range === '1D',
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const barLookup = new Map<number, OhlcvBar>();
    bars.forEach((b) => barLookup.set(b.timestamp, b));

    if (chartType === 'candlestick') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#36C982',
        downColor: '#E06C65',
        borderUpColor: '#36C982',
        borderDownColor: '#E06C65',
        wickUpColor: '#36C982',
        wickDownColor: '#E06C65',
      });
      candleSeries.setData(
        bars.map((b) => ({
          time: b.timestamp as UTCTimestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#36C982',
        topColor: 'rgba(54, 201, 130, 0.28)',
        bottomColor: 'rgba(54, 201, 130, 0.01)',
        lineWidth: 2,
      });
      areaSeries.setData(
        bars.map((b) => ({
          time: b.timestamp as UTCTimestamp,
          value: b.close,
        }))
      );
    }

    if (showVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.78,
          bottom: 0,
        },
      });
      volSeries.setData(
        bars.map((b) => ({
          time: b.timestamp as UTCTimestamp,
          value: b.volume,
          color:
            b.close >= b.open
              ? 'rgba(54, 201, 130, 0.35)'
              : 'rgba(224, 108, 101, 0.35)',
        }))
      );
    }

    if (overlays?.sma20) {
      const sma20 = calculateSMA(bars, 20);
      if (sma20.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: '#A5EBC3',
          lineWidth: 1,
          priceLineVisible: false,
        });
        s.setData(
          sma20.map((p) => ({
            time: p.timestamp as UTCTimestamp,
            value: p.value,
          }))
        );
      }
    }

    if (overlays?.sma50) {
      const sma50 = calculateSMA(bars, 50);
      if (sma50.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: '#D4A857',
          lineWidth: 1,
          priceLineVisible: false,
        });
        s.setData(
          sma50.map((p) => ({
            time: p.timestamp as UTCTimestamp,
            value: p.value,
          }))
        );
      }
    }

    if (overlays?.ema12) {
      const ema12 = calculateEMA(bars, 12);
      if (ema12.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: '#60A5FA',
          lineWidth: 1,
          priceLineVisible: false,
        });
        s.setData(
          ema12.map((p) => ({
            time: p.timestamp as UTCTimestamp,
            value: p.value,
          }))
        );
      }
    }

    if (overlays?.ema26) {
      const ema26 = calculateEMA(bars, 26);
      if (ema26.length > 0) {
        const s = chart.addSeries(LineSeries, {
          color: '#F59E0B',
          lineWidth: 1,
          priceLineVisible: false,
        });
        s.setData(
          ema26.map((p) => ({
            time: p.timestamp as UTCTimestamp,
            value: p.value,
          }))
        );
      }
    }

    if (overlays?.bollinger) {
      const bb = calculateBollingerBands(bars, 20, 2);
      if (bb.length > 0) {
        const upper = chart.addSeries(LineSeries, {
          color: 'rgba(165, 235, 195, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
        });
        const lower = chart.addSeries(LineSeries, {
          color: 'rgba(165, 235, 195, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
        });
        upper.setData(
          bb.map((p) => ({ time: p.timestamp as UTCTimestamp, value: p.upper }))
        );
        lower.setData(
          bb.map((p) => ({ time: p.timestamp as UTCTimestamp, value: p.lower }))
        );
      }
    }

    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoverBar(null);
        return;
      }
      const ts = Number(param.time);
      const found = barLookup.get(ts);
      setHoverBar(found ?? null);
    });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          chart.applyOptions({ width: w });
        }
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, chartType, height, overlays, range, showVolume]);

  const scanPct =
    bars.length > 1 ? 12 + (scanIndex / (bars.length - 1)) * 74 : 50;

  return (
    <div className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
      {(title || showControls) && (
        <div className="px-4 py-3 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold font-display text-[#E8F0EA] truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[#91A197] truncate">{subtitle}</p>
            )}
          </div>

          {showControls && (
            <div className="flex flex-wrap items-center gap-2">
              {onChartTypeChange && (
                <div className="inline-flex rounded-lg bg-[#141C17] p-0.5 border border-white/8">
                  {(['candlestick', 'line'] as const).map((t) => {
                    const active = chartType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onChartTypeChange(t)}
                        className={`relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                          active
                            ? 'text-[#A5EBC3]'
                            : 'text-[#91A197] hover:text-[#E8F0EA]'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId={`chart-type-pill-${uid}`}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 rounded-md bg-[#214B37]"
                          />
                        )}
                        <span className="relative z-10">
                          {t === 'candlestick' ? 'Candles' : 'Line'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {onRangeChange && (
                <div
                  className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-[#141C17] p-0.5 border border-white/8"
                  role="group"
                  aria-label="Chart time range"
                >
                  {ranges.map((r) => {
                    const active = range === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onRangeChange(r)}
                        className={`relative px-2 py-1 text-xs font-mono-num rounded-md transition-colors duration-150 whitespace-nowrap ${
                          active
                            ? 'text-[#101512] font-semibold'
                            : 'text-[#91A197] hover:text-[#E8F0EA]'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId={`chart-range-pill-${uid}`}
                            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0 rounded-md bg-[#36C982]"
                          />
                        )}
                        <span className="relative z-10">{r}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Synchronized OHLCV Crosshair Readout Strip */}
      {displayBar && (
        <div className="px-4 py-2 bg-[#141C17] border-b border-white/6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono-num text-[#91A197]">
          <span className="text-[#E8F0EA]">{displayBar.time.replace('T', ' ')}</span>
          <span>
            O{' '}
            <strong className="text-[#E8F0EA] font-medium">
              {formatCurrency(displayBar.open, currency, currencyMode, 2, fxUsdToInr)}
            </strong>
          </span>
          <span>
            H{' '}
            <strong className="text-[#36C982] font-medium">
              {formatCurrency(displayBar.high, currency, currencyMode, 2, fxUsdToInr)}
            </strong>
          </span>
          <span>
            L{' '}
            <strong className="text-[#E06C65] font-medium">
              {formatCurrency(displayBar.low, currency, currencyMode, 2, fxUsdToInr)}
            </strong>
          </span>
          <span>
            C{' '}
            <strong className="text-[#E8F0EA] font-medium">
              {formatCurrency(displayBar.close, currency, currencyMode, 2, fxUsdToInr)}
            </strong>
          </span>
          <span>
            Vol{' '}
            <strong className="text-[#A5EBC3] font-medium">
              {formatVolume(displayBar.volume)}
            </strong>
          </span>
        </div>
      )}

      {bars.length === 0 ? (
        <div
          className="w-full bg-[#141C17] flex flex-col items-center justify-center p-8 text-center text-xs text-[#91A197]"
          style={{ height }}
        >
          <p className="text-sm font-medium text-[#E8F0EA]">
            Historical candles unavailable
          </p>
          <p className="mt-1 max-w-md">
            No OHLCV candles were returned for {range}. Verify provider credentials or plan coverage for this symbol.
          </p>
        </div>
      ) : (
        <div
          className="relative w-full bg-[#141C17]"
          onMouseEnter={() => setUserInteracting(true)}
          onMouseLeave={() => setUserInteracting(false)}
          onTouchStart={() => setUserInteracting(true)}
        >
          <motion.div
            key={seriesKey}
            initial={reducedMotion ? false : { opacity: 0.45 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            ref={containerRef}
            data-cursor="chart"
            className="w-full"
            style={{ height }}
          />

          {/* Animated preview crosshair + price tooltip overlay on landing preview */}
          {animatedPreviewCrosshair && !userInteracting && previewScannedBar && (
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden="true"
            >
              <motion.div
                animate={{ left: `${scanPct}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-0 bottom-6 w-[1px] bg-[#A5EBC3]/35 border-r border-dashed border-[#36C982]/40"
              >
                <div className="absolute top-4 left-2.5 rounded-lg border border-[#36C982]/35 bg-[#18211C]/95 px-2.5 py-1.5 text-[11px] font-mono-num whitespace-nowrap shadow-lg">
                  <div className="text-[#91A197]">{previewScannedBar.time}</div>
                  <div className="text-[#E8F0EA] font-semibold">
                    {formatCurrency(
                      previewScannedBar.close,
                      currency,
                      currencyMode,
                      2,
                      fxUsdToInr
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

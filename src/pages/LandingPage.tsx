import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CandlestickChart,
  Compass,
  ExternalLink,
  Globe2,
  Newspaper,
  ShieldCheck,
} from 'lucide-react';
import { motion, useInView } from 'motion/react';
import { Link } from 'react-router-dom';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { ArticleModal } from '../components/ArticleModal';
import { ChartContainer, ChartMode } from '../components/ChartContainer';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { HeroFallback } from '../components/HeroFallback';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { MarketIndexCard } from '../components/MarketIndexCard';
import { Navbar } from '../components/Navbar';
import { NeuralGraphic } from '../components/NeuralGraphic';
import { PredictionCard } from '../components/PredictionCard';
import { StockCard } from '../components/StockCard';
import { useAppContext } from '../context/AppContext';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';
import { apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore } from '../services/bhavcopyStore';
import {
  ChartRange,
  FeedStatus,
  MarketIndex,
  NewsArticle,
  OhlcvBar,
  ProviderName,
  StockPrediction,
  StockRecord,
} from '../types/market';
import { formatProviderTimestamp } from '../utils/formatters';
import {
  calculateBollingerBands,
  calculateSMA,
  summarizeIndicators,
} from '../utils/indicators';

const HeroScene3D = lazy(() => import('../components/HeroScene3D'));

function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function AnimatedMetric({
  target,
  suffix = '',
  label,
}: {
  target: number;
  suffix?: string;
  label: string;
}) {
  const [val, setVal] = useState(0);
  const reducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (reducedMotion) {
      setVal(target);
      return;
    }
    const obj = { current: 0 };
    const tween = gsap.to(obj, {
      current: target,
      duration: 0.95,
      delay: 0.45,
      ease: 'power2.out',
      onUpdate: () => setVal(Math.round(obj.current)),
    });
    return () => {
      tween.kill();
    };
  }, [target, reducedMotion]);

  return (
    <div>
      <div className="text-2xl sm:text-3xl font-bold font-mono-num text-[#E8F0EA]">
        {val.toLocaleString()}
        {suffix}
      </div>
      <div className="text-xs text-[#91A197] mt-1">{label}</div>
    </div>
  );
}

const TechnicalPreviewSvg: React.FC<{
  bars: OhlcvBar[];
  loading: boolean;
  unavailableReason?: string;
}> = ({ bars: fullBars, loading, unavailableReason }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.35 });
  const reducedMotion = useReducedMotionSafe();

  const paths = useMemo(() => {
    if (fullBars.length === 0) {
      return { priceD: '', smaD: '', upperD: '', lowerD: '' };
    }
    const period = 10;
    const smaAll = calculateSMA(fullBars, period);
    const bbAll = calculateBollingerBands(fullBars, period, 2);

    const bars = fullBars.slice(-34);
    const smaByTs = new Map(smaAll.map((p) => [p.timestamp, p.value]));
    const bbByTs = new Map(bbAll.map((p) => [p.timestamp, p]));

    const closes = bars.map((b) => b.close);
    const smaVals = bars.map((b) => smaByTs.get(b.timestamp) ?? null);
    const upperVals = bars.map((b) => bbByTs.get(b.timestamp)?.upper ?? null);
    const lowerVals = bars.map((b) => bbByTs.get(b.timestamp)?.lower ?? null);

    const allVals = [
      ...closes,
      ...upperVals.filter((v): v is number => v !== null),
      ...lowerVals.filter((v): v is number => v !== null),
    ];
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    const span = max - min || 1;
    const w = 520;
    const h = 190;
    const padX = 16;
    const padY = 18;

    const toXY = (idx: number, val: number) => {
      const x = padX + (idx / Math.max(1, bars.length - 1)) * (w - padX * 2);
      const y = h - padY - ((val - min) / span) * (h - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    const buildD = (series: (number | null)[]) => {
      let d = '';
      series.forEach((v, idx) => {
        if (v === null) return;
        d += `${d ? ' L ' : 'M '}${toXY(idx, v)}`;
      });
      return d;
    };

    return {
      priceD: buildD(closes),
      smaD: buildD(smaVals),
      upperD: buildD(upperVals),
      lowerD: buildD(lowerVals),
    };
  }, [fullBars]);

  const shouldDraw = reducedMotion || inView;

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-white/8 bg-[#141C17] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#91A197] mb-3">
        <span className="font-medium text-[#E8F0EA]">
          NSE:RELIANCE · Sequential Overlay Trace (6M)
        </span>
        <div className="flex items-center gap-3 font-mono-num">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#E8F0EA] inline-block" /> Close
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#36C982] inline-block" /> SMA
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#A5EBC3] inline-block" /> Bands
          </span>
        </div>
      </div>

      {fullBars.length === 0 ? (
        <div className="h-44 rounded-lg bg-[#18211C] flex flex-col items-center justify-center p-4 text-center text-xs text-[#91A197]">
          <span className="font-medium text-[#E8F0EA]">
            {loading
              ? 'Loading historical indicator trace...'
              : unavailableReason || 'Historical trace unavailable'}
          </span>
          {!loading && !unavailableReason && (
            <span className="mt-1 max-w-sm">
              Connect the India market feed to render RELIANCE technical overlays.
            </span>
          )}
        </div>
      ) : (
        <svg
          viewBox="0 0 520 190"
          className="w-full h-44"
          role="img"
          aria-label="Sequential technical indicator preview drawing price, SMA, and Bollinger bands"
        >
          {[40, 95, 150].map((y) => (
            <line
              key={y}
              x1="16"
              y1={y}
              x2="504"
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 4"
            />
          ))}

          <motion.path
            d={paths.upperD}
            fill="none"
            stroke="#A5EBC3"
            strokeWidth="1.2"
            strokeOpacity="0.55"
            strokeDasharray="4 3"
            initial={{ pathLength: reducedMotion ? 1 : 0, opacity: reducedMotion ? 0.65 : 0 }}
            animate={shouldDraw ? { pathLength: 1, opacity: 0.65 } : undefined}
            transition={{ duration: 0.45, delay: reducedMotion ? 0 : 0.42, ease: 'easeOut' }}
          />
          <motion.path
            d={paths.lowerD}
            fill="none"
            stroke="#A5EBC3"
            strokeWidth="1.2"
            strokeOpacity="0.55"
            strokeDasharray="4 3"
            initial={{ pathLength: reducedMotion ? 1 : 0, opacity: reducedMotion ? 0.65 : 0 }}
            animate={shouldDraw ? { pathLength: 1, opacity: 0.65 } : undefined}
            transition={{ duration: 0.45, delay: reducedMotion ? 0 : 0.42, ease: 'easeOut' }}
          />

          <motion.path
            d={paths.smaD}
            fill="none"
            stroke="#36C982"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: reducedMotion ? 1 : 0, opacity: reducedMotion ? 0.95 : 0 }}
            animate={shouldDraw ? { pathLength: 1, opacity: 0.95 } : undefined}
            transition={{ duration: 0.45, delay: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
          />

          <motion.path
            d={paths.priceD}
            fill="none"
            stroke="#E8F0EA"
            strokeWidth="2.1"
            strokeLinecap="round"
            initial={{ pathLength: reducedMotion ? 1 : 0, opacity: reducedMotion ? 1 : 0 }}
            animate={shouldDraw ? { pathLength: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.48, delay: 0, ease: 'easeOut' }}
          />
        </svg>
      )}
    </div>
  );
};

const CtaCandlestickBackdrop: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const reducedMotion = useReducedMotionSafe();

  const candles = [
    { x: 70, y: 120, h: 52, bull: true },
    { x: 145, y: 98, h: 66, bull: true },
    { x: 220, y: 126, h: 42, bull: false },
    { x: 295, y: 86, h: 74, bull: true },
    { x: 370, y: 74, h: 58, bull: true },
    { x: 830, y: 80, h: 62, bull: true },
    { x: 905, y: 102, h: 54, bull: false },
    { x: 980, y: 68, h: 78, bull: true },
    { x: 1055, y: 54, h: 64, bull: true },
    { x: 1130, y: 42, h: 72, bull: true },
  ];

  return (
    <div
      ref={ref}
      className="absolute inset-0 pointer-events-none overflow-hidden opacity-45"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 260"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {candles.map((c, i) => (
          <motion.g
            key={c.x}
            initial={false}
            animate={
              !reducedMotion && inView
                ? { y: [0, i % 2 === 0 ? -4 : 4, 0] }
                : { y: 0 }
            }
            transition={{
              duration: 5 + (i % 3),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.2,
            }}
          >
            <line
              x1={c.x}
              y1={c.y - 18}
              x2={c.x}
              y2={c.y + c.h + 18}
              stroke="#36C982"
              strokeOpacity="0.22"
              strokeWidth="1.2"
            />
            <rect
              x={c.x - 8}
              y={c.y}
              width="16"
              height={c.h}
              rx="2"
              fill={c.bull ? '#36C982' : '#214B37'}
              fillOpacity={c.bull ? '0.18' : '0.32'}
              stroke="#A5EBC3"
              strokeOpacity="0.16"
            />
          </motion.g>
        ))}
      </svg>
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { dataMode, watchlist, bhavcopyVersion, fxUsdToInr } = useAppContext();
  const reducedMotion = useReducedMotionSafe();
  const webglReady = useMemo(() => hasWebGLSupport(), []);
  const heroRef = useRef<HTMLDivElement>(null);

  const [previewSymbol, setPreviewSymbol] = useState<'RELIANCE' | 'NVDA' | 'TCS' | 'AAPL'>('NVDA');
  const [previewRange, setPreviewRange] = useState<ChartRange>('3M');
  const [previewChartType, setPreviewChartType] = useState<ChartMode>('candlestick');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [newsState, setNewsState] = useState<{
    connected: boolean;
    message?: string;
    articles: NewsArticle[];
  }>({ connected: false, articles: [] });
  const [predictionSamples, setPredictionSamples] = useState<{
    connected: boolean;
    message?: string;
    items: { stock: StockRecord; prediction: StockPrediction }[];
  }>({ connected: false, items: [] });
  const [reliance6mBars, setReliance6mBars] = useState<OhlcvBar[]>([]);
  const [relianceUnavailableReason, setRelianceUnavailableReason] = useState<string | undefined>();
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const [previewBars, setPreviewBars] = useState<OhlcvBar[]>([]);
  const [previewMeta, setPreviewMeta] = useState<{
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
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const bootstrapReqRef = useRef(0);
  const previewReqRef = useRef(0);
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  // Load landing indices, stocks, RELIANCE 6M bars, news, and predictions from /api/*
  useEffect(() => {
    const reqId = ++bootstrapReqRef.current;
    const controller = new AbortController();
    setBootstrapLoading(true);
    setBootstrapError(null);

    Promise.all([
      apiClient.getMarketOverview(
        { market: 'All', range: '3M', mode: dataMode, symbols: watchlist },
        controller.signal
      ),
      apiClient.getStocks(
        { market: 'All', mode: dataMode, symbols: watchlist },
        controller.signal
      ),
      apiClient.getStockHistory('RELIANCE', '6M', dataMode, controller.signal),
      apiClient.getNews({ mode: dataMode }, controller.signal),
      apiClient.getPrediction('NVDA', '14D', dataMode, controller.signal),
      apiClient.getPrediction('RELIANCE', '14D', dataMode, controller.signal),
      apiClient.getPrediction('INFY', '14D', dataMode, controller.signal),
    ])
      .then(
        ([
          overviewRes,
          stocksRes,
          relHistRes,
          newsRes,
          nvdaPred,
          relPred,
          infyPred,
        ]) => {
          if (reqId !== bootstrapReqRef.current) return;
          setIndices(overviewRes.indices);
          const resolvedStocks =
            dataMode === 'real'
              ? bhavcopyStore.overlayStocks(stocksRes.stocks)
              : stocksRes.stocks;
          setStocks(resolvedStocks);

          if (dataMode === 'real' && relHistRes.bars.length === 0) {
            const eod = bhavcopyStore.getHistoryBars('RELIANCE', '6M');
            setReliance6mBars(eod.bars);
            setRelianceUnavailableReason(
              eod.bars.length > 0 ? eod.insufficientReason : relHistRes.unavailableReason
            );
          } else {
            setReliance6mBars(relHistRes.bars);
            setRelianceUnavailableReason(relHistRes.unavailableReason);
          }

          setNewsState({
            connected: newsRes.connected,
            message: newsRes.message,
            articles: newsRes.articles.slice(0, 4),
          });

          const map = new Map(resolvedStocks.map((s) => [s.ticker, s]));
          const predItems: { stock: StockRecord; prediction: StockPrediction }[] = [];
          for (const res of [nvdaPred, relPred, infyPred]) {
            if (res.connected && res.prediction) {
              const s = map.get(res.symbol);
              if (s) predItems.push({ stock: s, prediction: res.prediction });
            }
          }
          setPredictionSamples({
            connected: nvdaPred.connected || relPred.connected || infyPred.connected,
            message: nvdaPred.message,
            items: predItems,
          });
          setBootstrapLoading(false);
        }
      )
      .catch((err) => {
        if (isAbortError(err) || reqId !== bootstrapReqRef.current) return;
        setBootstrapError(
          err instanceof Error
            ? err.message
            : 'Unable to load market data from API.'
        );
        setBootstrapLoading(false);
      });

    return () => controller.abort();
  }, [retryToken, dataMode, watchlist, bhavcopyVersion]);

  // Load interactive chart preview series with race-condition protection
  useEffect(() => {
    const reqId = ++previewReqRef.current;
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);

    apiClient
      .getStockHistory(previewSymbol, previewRange, dataMode, controller.signal)
      .then((res) => {
        if (reqId !== previewReqRef.current) return;
        if (dataMode === 'real' && res.bars.length === 0 && res.exchange === 'NSE') {
          const eod = bhavcopyStore.getHistoryBars(previewSymbol, previewRange);
          if (eod.bars.length > 0) {
            setPreviewBars(eod.bars);
            setPreviewMeta({
              feedStatus: 'End of day',
              stale: false,
              provider: 'Bhavcopy CSV',
              providerTimestamp: eod.providerTimestamp,
              unavailableReason: eod.insufficientReason,
            });
            setPreviewLoading(false);
            return;
          }
        }
        setPreviewBars(res.bars);
        setPreviewMeta({
          feedStatus: res.feedStatus,
          stale: res.stale,
          provider: res.provider,
          providerTimestamp: res.providerTimestamp,
          unavailableReason: res.unavailableReason,
        });
        setPreviewLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err) || reqId !== previewReqRef.current) return;
        setPreviewError(
          err instanceof Error
            ? err.message
            : 'Unable to load preview chart series.'
        );
        setPreviewLoading(false);
      });

    return () => controller.abort();
  }, [previewSymbol, previewRange, retryToken, dataMode, bhavcopyVersion]);

  const stockMap = useMemo(() => {
    const m = new Map<string, StockRecord>();
    for (const s of stocks) m.set(s.ticker, s);
    return m;
  }, [stocks]);

  const previewStock = stockMap.get(previewSymbol) ?? null;

  const previewTech = useMemo(
    () => summarizeIndicators(reliance6mBars),
    [reliance6mBars]
  );

  const featuredStocks = useMemo(
    () =>
      ['RELIANCE', 'TCS', 'INFY', 'NVDA', 'AAPL', 'MSFT']
        .map((t) => stockMap.get(t))
        .filter((s): s is StockRecord => Boolean(s)),
    [stockMap]
  );

  const leadArticle = newsState.articles[0];
  const secondaryArticles = newsState.articles.slice(1);

  // Choreographed first-load sequence: headline line-by-line -> subtitle -> CTAs -> metrics
  useEffect(() => {
    if (reducedMotion || !heroRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-eyebrow', { y: 12, opacity: 0, duration: 0.4, clearProps: 'transform,opacity' })
        .from(
          '.hero-headline-line',
          { y: 26, opacity: 0, duration: 0.45, stagger: 0.12, clearProps: 'transform,opacity' },
          '-=0.15'
        )
        .from('.hero-copy', { y: 14, opacity: 0, duration: 0.4, clearProps: 'transform,opacity' }, '-=0.2')
        .from('.hero-cta', { y: 12, opacity: 0, duration: 0.35, clearProps: 'transform,opacity' }, '-=0.15')
        .from('.hero-metrics', { y: 12, opacity: 0, duration: 0.4, clearProps: 'transform,opacity' }, '-=0.15');
    }, heroRef);
    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div className="min-h-screen bg-[#101512] text-[#E8F0EA]">
      <Navbar />

      {/* ASYMMETRIC SIGNATURE HERO WITH 3D BULL SILHOUETTE */}
      <section
        ref={heroRef}
        className="relative min-h-[600px] lg:min-h-[680px] flex items-center overflow-hidden border-b border-white/8"
      >
        {!reducedMotion && webglReady ? (
          <Suspense fallback={<HeroFallback />}>
            <HeroScene3D />
          </Suspense>
        ) : (
          <HeroFallback />
        )}

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(16,21,18,0.96) 0%, rgba(16,21,18,0.84) 44%, rgba(16,21,18,0.28) 72%, rgba(16,21,18,0.14) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 lg:hidden pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(16,21,18,0.65) 0%, rgba(16,21,18,0.86) 100%)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-xl lg:max-w-[540px]">
            <p className="hero-eyebrow text-xs font-medium tracking-wide text-[#A5EBC3] mb-4">
              BULLSIGHT · See the Bull. Predict the Move.
            </p>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#E8F0EA] leading-[1.06]">
              <span className="block overflow-hidden">
                <span className="hero-headline-line block">See Beyond</span>
              </span>
              <span className="block overflow-hidden">
                <span className="hero-headline-line block text-[#A5EBC3]">
                  the Market.
                </span>
              </span>
            </h1>

            <p className="hero-copy mt-5 text-base sm:text-lg text-[#91A197] leading-relaxed">
              Explore market movements. Discover hidden patterns. Make data-driven
              decisions with AI-powered market intelligence.
            </p>

            <div className="hero-cta mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/app/explore"
                data-cursor="magnetic"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#36C982] text-[#101512] text-sm font-semibold hover:bg-[#A5EBC3] transition-colors whitespace-nowrap"
              >
                Explore Markets
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>

              <Link
                to="/app/predictions"
                data-cursor="magnetic"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/14 bg-[#18211C]/90 text-[#E8F0EA] text-sm font-semibold hover:border-[#36C982]/60 hover:text-[#A5EBC3] transition-colors whitespace-nowrap"
              >
                Discover AI
              </Link>
            </div>

            <div className="hero-metrics mt-12 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <AnimatedMetric target={18} label="Tracked Equities" />
              <AnimatedMetric target={4} label="Benchmark Indices" />
              <AnimatedMetric target={2} label="Market Providers" />
              <AnimatedMetric target={7} label="OHLCV Indicators" />
            </div>
          </div>
        </div>
      </section>

      {/* MARKET INTELLIGENCE STRIP */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA]">
                Dual-Market Intelligence
              </h2>
              {dataMode === 'demo' && <DemoDataBadge />}
            </div>
            <p className="text-sm text-[#91A197] mt-1">
              {dataMode === 'demo'
                ? 'Populated simulated India (NSE/BSE) & US (NASDAQ/NYSE) indices and equities.'
                : 'GFDL / NSE Bhavcopy India feeds (NSE, BSE) and Twelve Data US feeds (NASDAQ, NYSE).'}
            </p>
          </div>
          <Link
            to="/app/overview"
            className="text-sm font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
          >
            Open Market Terminal
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {bootstrapError ? (
          <ApiErrorBanner
            title="Unable to reach market data API"
            message={bootstrapError}
            onRetry={retry}
          />
        ) : indices.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {indices.map((idx) => (
              <MarketIndexCard key={idx.id} index={idx} />
            ))}
          </div>
        )}
      </section>

      {/* FULL-WIDTH INTERACTIVE CHART PREVIEW WITH ANIMATED CROSSHAIR & TOOLTIP */}
      <section className="border-y border-white/8 bg-[#141C17] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#A5EBC3]">
                <CandlestickChart className="w-4 h-4" aria-hidden="true" />
                <span>Interactive Chart Workspace</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] text-balance">
                Precision OHLCV charting built for cross-market scanning.
              </h2>
              <p className="text-sm text-[#91A197] leading-relaxed">
                Switch seamlessly between Indian INR leaders and US NASDAQ benchmarks.
                Move across the canvas to inspect provider-backed candles.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['NVDA', 'RELIANCE', 'AAPL', 'TCS'] as const).map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => setPreviewSymbol(sym)}
                  className={`px-3.5 py-2 rounded-lg text-left border text-xs transition-colors ${
                    previewSymbol === sym
                      ? 'bg-[#214B37] border-[#36C982]/50 text-[#A5EBC3]'
                      : 'bg-[#18211C] border-white/8 text-[#E8F0EA] hover:border-white/20'
                  }`}
                >
                  <span className="font-semibold">{sym}</span>
                  <span className="ml-2 text-[11px] opacity-80">
                    {sym === 'RELIANCE' || sym === 'TCS' ? 'NSE' : 'NASDAQ'}
                  </span>
                </button>
              ))}
              <Link
                to={`/app/stock/${previewSymbol}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#36C982] hover:text-[#A5EBC3] whitespace-nowrap"
              >
                Open {previewSymbol} research
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {previewError ? (
            <ApiErrorBanner
              title="Preview chart unavailable"
              message={previewError}
              onRetry={retry}
            />
          ) : previewLoading && previewBars.length === 0 ? (
            <LoadingSkeleton variant="chart" />
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#91A197]">
                <div className="flex items-center gap-2">
                  <FeedStatusBadge
                    status={previewMeta.feedStatus}
                    stale={previewMeta.stale}
                    provider={previewMeta.provider}
                  />
                  {previewMeta.providerTimestamp && (
                    <span className="font-mono-num">
                      {formatProviderTimestamp(previewMeta.providerTimestamp)}
                    </span>
                  )}
                </div>
                {previewMeta.unavailableReason && (
                  <span>{previewMeta.unavailableReason}</span>
                )}
              </div>

              <ChartContainer
                bars={previewBars}
                currency={
                  previewStock?.currency ??
                  (previewSymbol === 'RELIANCE' || previewSymbol === 'TCS'
                    ? 'INR'
                    : 'USD')
                }
                fxUsdToInr={fxUsdToInr}
                range={previewRange}
                onRangeChange={setPreviewRange}
                chartType={previewChartType}
                onChartTypeChange={setPreviewChartType}
                showVolume
                height={380}
                animatedPreviewCrosshair
                title={
                  previewStock
                    ? `${previewStock.name} (${previewStock.normalizedSymbol})`
                    : previewSymbol
                }
                subtitle={`${previewMeta.provider} · OHLCV Series${
                  previewLoading ? ' (Updating...)' : ''
                }`}
              />
            </div>
          )}
        </div>
      </section>

      {/* GLOBAL STOCK DISCOVERY — OVERLAPPING CARDS THAT SETTLE INTO GRID ON SCROLL */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#A5EBC3] mb-2">
              <Compass className="w-4 h-4" aria-hidden="true" />
              <span>Global Stock Discovery</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA]">
              Screen India and US equities side by side
            </h2>
          </div>
          <Link
            to="/app/explore"
            className="text-sm font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
          >
            Open Screener
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {featuredStocks.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <LoadingSkeleton key={i} variant="card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredStocks.map((stock, idx) => {
              const col = idx % 3;
              const row = Math.floor(idx / 3);
              const initialX = col === 0 ? 18 : col === 2 ? -18 : 0;
              const initialY = row === 0 ? 18 : -10;
              const initialRotate = col === 0 ? -1.4 : col === 2 ? 1.4 : 0.4;

              return (
                <motion.div
                  key={stock.normalizedSymbol}
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, x: initialX, y: initialY, rotate: initialRotate }
                  }
                  whileInView={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.44,
                    delay: reducedMotion ? 0 : idx * 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <StockCard stock={stock} />
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* AI FORECASTS & NEURAL SIGNAL ARCHITECTURE — EDITORIAL SPLIT */}
      <section
        id="intelligence"
        className="border-y border-white/8 bg-[#141C17] py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4 }}
              className="lg:col-span-5 space-y-4"
            >
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#A5EBC3]">
                <BrainCircuit className="w-4 h-4" aria-hidden="true" />
                <span>AI Prediction Centre</span>
                {dataMode === 'demo' && <DemoDataBadge compact />}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] text-balance">
                Directional scenario bands and model evaluation metrics
              </h2>
              <p className="text-sm text-[#91A197] leading-relaxed">
                {dataMode === 'demo'
                  ? 'Illustrative Demo outputs displaying multi-horizon forecast bands, directional probabilities, MAE, and RMSE checkpoints.'
                  : 'Connect your external Python forecast service to stream multi-horizon projected intervals, directional probabilities, MAE, and RMSE evaluation checkpoints.'}
              </p>
              <Link
                to="/app/predictions"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#214B37] text-[#A5EBC3] text-sm font-semibold hover:bg-[#36C982] hover:text-[#101512] transition-colors whitespace-nowrap"
              >
                Open AI Prediction Centre
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </motion.div>

            <div className="lg:col-span-7">
              <NeuralGraphic signal="Neutral" confidence={0} />
            </div>
          </div>

          {predictionSamples.connected && predictionSamples.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {predictionSamples.items.map(({ stock, prediction }) => (
                <PredictionCard
                  key={prediction.ticker}
                  prediction={prediction}
                  stock={stock}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 bg-[#18211C] p-6 text-center space-y-1.5">
              <p className="text-sm font-medium text-[#E8F0EA]">
                {predictionSamples.message || 'Prediction service not connected'}
              </p>
              <p className="text-xs text-[#91A197]">
                Configure PYTHON_PREDICTION_URL on the server to display real forecast
                cards and evaluation metrics.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* TECHNICAL ANALYSIS & EDITORIAL NEWS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Technical Analysis Sequential Line Preview */}
        <div className="rounded-2xl border border-white/8 bg-[#18211C] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#A5EBC3]">
              <Activity className="w-4 h-4" aria-hidden="true" />
              <span>Technical Analysis Engine</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#E8F0EA]">
              Synchronized RSI, MACD, Bollinger Bands &amp; Moving Averages
            </h2>
            <p className="text-sm text-[#91A197] leading-relaxed">
              Every oscillator and moving average is computed directly from the same
              provider OHLCV bars used in Stock Detail—with explicit insufficient-history
              guards.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-1 font-mono-num">
              <div className="rounded-xl bg-[#141C17] border border-white/8 p-3">
                <span className="text-[11px] text-[#91A197] block">RSI (14)</span>
                <span className="text-base font-bold text-[#E8F0EA] mt-0.5 block">
                  {previewTech.rsi14 !== null ? previewTech.rsi14.toFixed(2) : '—'}
                </span>
              </div>
              <div className="rounded-xl bg-[#141C17] border border-white/8 p-3">
                <span className="text-[11px] text-[#91A197] block">SMA (20)</span>
                <span className="text-base font-bold text-[#A5EBC3] mt-0.5 block">
                  {previewTech.sma20 !== null ? `₹${previewTech.sma20.toFixed(0)}` : '—'}
                </span>
              </div>
              <div className="rounded-xl bg-[#141C17] border border-white/8 p-3">
                <span className="text-[11px] text-[#91A197] block">Trend</span>
                <span className="text-base font-bold text-[#36C982] mt-0.5 block">
                  {reliance6mBars.length > 0 ? previewTech.overallSignal : '—'}
                </span>
              </div>
            </div>

            <Link
              to="/app/technical"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#36C982] hover:text-[#A5EBC3]"
            >
              Launch Technical Analysis
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="lg:col-span-7">
            <TechnicalPreviewSvg
              bars={reliance6mBars}
              loading={bootstrapLoading}
              unavailableReason={relianceUnavailableReason}
            />
          </div>
        </div>

        {/* Financial News Preview — Featured Story + Compact Secondary List */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA]">
                Market News &amp; Briefings
              </h2>
              <p className="text-sm text-[#91A197] mt-1">
                Verified provider headlines tagged with India &amp; US symbols.
              </p>
            </div>
            <Link
              to="/app/news"
              className="text-sm font-medium text-[#A5EBC3] hover:text-[#36C982] inline-flex items-center gap-1 whitespace-nowrap"
            >
              View Market News
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {!newsState.connected ? (
            <div className="rounded-2xl border border-white/8 bg-[#18211C] p-8 text-center space-y-2">
              <Newspaper className="w-6 h-6 text-[#91A197] mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-[#E8F0EA]">
                {newsState.message || 'News feed not connected.'}
              </p>
              <p className="text-xs text-[#91A197]">
                Connect NEWS_API_URL on the Express server to stream market news.
              </p>
            </div>
          ) : newsState.articles.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-[#18211C] p-8 text-center text-xs text-[#91A197]">
              No headlines returned by news provider.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {leadArticle && (
                <div className="lg:col-span-7">
                  <button
                    type="button"
                    onClick={() => setActiveArticle(leadArticle)}
                    data-cursor="card"
                    className="w-full h-full text-left rounded-2xl border border-white/8 bg-[#18211C] hover:border-[#36C982]/40 transition-colors p-6 sm:p-7 flex flex-col justify-between gap-5 group"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#91A197]">
                        <span className="font-semibold text-[#A5EBC3]">
                          Featured Story
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{leadArticle.source}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatProviderTimestamp(leadArticle.publishedAt)}</span>
                      </div>
                      <h3 className="font-display text-xl sm:text-2xl font-bold text-[#E8F0EA] group-hover:text-[#A5EBC3] transition-colors leading-snug">
                        {leadArticle.title}
                      </h3>
                      <p className="text-sm text-[#91A197] leading-relaxed">
                        {leadArticle.summary}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-white/8 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        {leadArticle.sentiment && (
                          <>
                            <span
                              className={
                                leadArticle.sentiment === 'Bullish'
                                  ? 'text-[#36C982] font-medium'
                                  : leadArticle.sentiment === 'Bearish'
                                  ? 'text-[#E06C65] font-medium'
                                  : 'text-[#D4A857] font-medium'
                              }
                            >
                              {leadArticle.sentiment}
                            </span>
                            <span aria-hidden="true" className="text-[#91A197]">
                              ·
                            </span>
                          </>
                        )}
                        <span className="font-mono-num text-[#91A197]">
                          {leadArticle.tickers.join(' · ')}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#A5EBC3]">
                        Read Article
                        {leadArticle.url ? (
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </span>
                    </div>
                  </button>
                </div>
              )}

              <div className="lg:col-span-5 rounded-2xl border border-white/8 bg-[#18211C] divide-y divide-white/8 flex flex-col justify-between">
                {secondaryArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setActiveArticle(article)}
                    data-cursor="card"
                    className="w-full text-left p-5 hover:bg-[#202B24] transition-colors flex flex-col gap-2 group first:rounded-t-2xl last:rounded-b-2xl"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#91A197]">
                      <span>
                        {article.source} · {formatProviderTimestamp(article.publishedAt)}
                      </span>
                      {article.sentiment && (
                        <span
                          className={
                            article.sentiment === 'Bullish'
                              ? 'text-[#36C982] font-medium'
                              : article.sentiment === 'Bearish'
                              ? 'text-[#E06C65] font-medium'
                              : 'text-[#D4A857] font-medium'
                          }
                        >
                          {article.sentiment}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-semibold text-[#E8F0EA] group-hover:text-[#A5EBC3] transition-colors leading-snug">
                      {article.title}
                    </h3>
                    <div className="text-[11px] font-mono-num text-[#91A197]">
                      {article.category}
                      {article.tickers.length > 0
                        ? ` · ${article.tickers.join(', ')}`
                        : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FINAL CTA & ABOUT FRAMED BY ANIMATED CANDLESTICK BACKDROP */}
      <section
        id="about"
        className="relative border-t border-white/8 bg-[#141C17] py-16 overflow-hidden"
      >
        <CtaCandlestickBackdrop />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#E8F0EA] text-balance">
            Ready to inspect India and US equities in one calm workspace?
          </h2>
          <p className="text-sm sm:text-base text-[#91A197] max-w-2xl mx-auto">
            BULLSIGHT routes Global Datafeeds (India) and Twelve Data (US) through a
            server-side Express API with normalized exchange tickers, feed freshness
            badges, and zero simulated values.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/app/overview"
              data-cursor="magnetic"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#36C982] text-[#101512] text-sm font-semibold hover:bg-[#A5EBC3] transition-colors whitespace-nowrap"
            >
              Open Market Terminal
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/14 bg-[#18211C] text-[#E8F0EA] text-sm font-semibold hover:border-white/30 transition-colors whitespace-nowrap"
            >
              Preview Sign In
            </Link>
          </div>

          <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-xs text-[#91A197]">
            <motion.div
              whileHover={reducedMotion ? undefined : { y: -2 }}
              className="rounded-xl border border-white/8 bg-[#18211C]/90 p-4 space-y-1.5"
            >
              <Globe2 className="w-4 h-4 text-[#36C982]" aria-hidden="true" />
              <div className="font-semibold text-[#E8F0EA]">Dual-Market Coverage</div>
              <p>Normalized NSE, BSE, NASDAQ, and NYSE tickers in INR and USD.</p>
            </motion.div>
            <motion.div
              whileHover={reducedMotion ? undefined : { y: -2 }}
              className="rounded-xl border border-white/8 bg-[#18211C]/90 p-4 space-y-1.5"
            >
              <Activity className="w-4 h-4 text-[#36C982]" aria-hidden="true" />
              <div className="font-semibold text-[#E8F0EA]">Consistent Series</div>
              <p>Charts and technical indicators share cached provider OHLCV candles.</p>
            </motion.div>
            <motion.div
              whileHover={reducedMotion ? undefined : { y: -2 }}
              className="rounded-xl border border-white/8 bg-[#18211C]/90 p-4 space-y-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-[#36C982]" aria-hidden="true" />
              <div className="font-semibold text-[#E8F0EA]">Honest Feed Status</div>
              <p>Every quote displays Live, Delayed, End of day, or Unavailable status.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* PROFESSIONAL FOOTER */}
      <footer className="border-t border-white/8 bg-[#101512] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="font-display font-extrabold text-base text-[#E8F0EA]">
              BULLSIGHT
            </div>
            <p className="text-xs text-[#91A197] mt-1">
              See the Bull. Predict the Move. · India &amp; US Market Intelligence Platform
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-5 text-xs text-[#91A197]"
          >
            <Link to="/app/overview" className="hover:text-[#E8F0EA]">
              Overview
            </Link>
            <Link to="/app/explore" className="hover:text-[#E8F0EA]">
              Screener
            </Link>
            <Link to="/app/predictions" className="hover:text-[#E8F0EA]">
              AI Predictions
            </Link>
            <Link to="/app/technical" className="hover:text-[#E8F0EA]">
              Technical Analysis
            </Link>
            <Link to="/app/news" className="hover:text-[#E8F0EA]">
              News
            </Link>
            <Link to="/login" className="hover:text-[#E8F0EA]">
              Login
            </Link>
          </nav>
        </div>
      </footer>

      <ArticleModal
        article={activeArticle}
        onClose={() => setActiveArticle(null)}
      />
    </div>
  );
};

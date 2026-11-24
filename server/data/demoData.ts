import type {
  ChartRange,
  HorizonType,
  MarketIndex,
  MarketRegion,
  NewsArticle,
  OhlcvBar,
  PredictionHistoryItem,
  PredictionPoint,
  SignalType,
  StockFundamentals,
  StockPrediction,
  StockProfile,
  StockRecord,
} from '../../src/types/market.ts';
import {
  INDEX_DEFINITIONS,
  TRACKED_EQUITIES,
  type EquityDefinition,
  type IndexDefinition,
} from './universe.ts';

interface DemoSeedMeta {
  baseClose: number;
  dailyVol: number;
  annualDrift: number;
  avgVolume: number;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  roe: number;
  eps: number;
  dividendYield: number;
  debtToEquity: number;
  beta: number;
  headquarters: string;
  ceo: string;
  employees: string;
  industry: string;
  description: string;
}

const INDEX_DEMO_SEEDS: Record<
  string,
  { baseClose: number; dailyVol: number; annualDrift: number }
> = {
  NIFTY50: { baseClose: 24385.5, dailyVol: 0.0085, annualDrift: 0.14 },
  SENSEX: { baseClose: 80142.2, dailyVol: 0.0082, annualDrift: 0.13 },
  NASDAQ: { baseClose: 19048.8, dailyVol: 0.0115, annualDrift: 0.19 },
  SP500: { baseClose: 5974.4, dailyVol: 0.0078, annualDrift: 0.15 },
};

const EQUITY_DEMO_SEEDS: Record<string, DemoSeedMeta> = {
  RELIANCE: {
    baseClose: 1298.4,
    dailyVol: 0.0145,
    annualDrift: 0.16,
    avgVolume: 11_420_000,
    marketCap: 17_560_000_000_000,
    peRatio: 25.4,
    pbRatio: 2.18,
    roe: 9.8,
    eps: 51.12,
    dividendYield: 0.39,
    debtToEquity: 0.41,
    beta: 1.08,
    headquarters: 'Mumbai, Maharashtra, India',
    ceo: 'Mukesh D. Ambani',
    employees: '347,000',
    industry: 'Integrated Oil, Telecom & Retail',
    description:
      'Reliance Industries operates across digital services (Jio), organized retail, refining, petrochemicals, and new green-energy manufacturing.',
  },
  TCS: {
    baseClose: 4164.75,
    dailyVol: 0.012,
    annualDrift: 0.13,
    avgVolume: 2_380_000,
    marketCap: 15_070_000_000_000,
    peRatio: 31.2,
    pbRatio: 15.8,
    roe: 51.4,
    eps: 133.48,
    dividendYield: 1.42,
    debtToEquity: 0.08,
    beta: 0.78,
    headquarters: 'Mumbai, Maharashtra, India',
    ceo: 'K. Krithivasan',
    employees: '601,500',
    industry: 'IT Consulting & Enterprise Systems',
    description:
      'Tata Consultancy Services delivers enterprise digital transformation, cloud migration, AI engineering, and core banking platforms globally.',
  },
  HDFCBANK: {
    baseClose: 1758.2,
    dailyVol: 0.0118,
    annualDrift: 0.12,
    avgVolume: 15_640_000,
    marketCap: 13_380_000_000_000,
    peRatio: 19.6,
    pbRatio: 2.85,
    roe: 16.4,
    eps: 89.7,
    dividendYield: 1.11,
    debtToEquity: 1.12,
    beta: 0.92,
    headquarters: 'Mumbai, Maharashtra, India',
    ceo: 'Sashidhar Jagdishan',
    employees: '213,000',
    industry: 'Private Sector Banking',
    description:
      'HDFC Bank is India’s largest private sector lender by assets, spanning retail mortgages, wholesale treasury, and merchant payment infrastructure.',
  },
  INFY: {
    baseClose: 1892.6,
    dailyVol: 0.0138,
    annualDrift: 0.15,
    avgVolume: 6_840_000,
    marketCap: 7_850_000_000_000,
    peRatio: 28.4,
    pbRatio: 8.9,
    roe: 31.8,
    eps: 66.64,
    dividendYield: 2.08,
    debtToEquity: 0.09,
    beta: 0.89,
    headquarters: 'Bengaluru, Karnataka, India',
    ceo: 'Salil Parekh',
    employees: '317,000',
    industry: 'IT Services & Cloud Platforms',
    description:
      'Infosys builds next-generation digital consulting, Topaz AI automation suites, and managed enterprise cloud operations across North America and Europe.',
  },
  ICICIBANK: {
    baseClose: 1312.85,
    dailyVol: 0.0124,
    annualDrift: 0.17,
    avgVolume: 13_200_000,
    marketCap: 9_230_000_000_000,
    peRatio: 20.1,
    pbRatio: 3.45,
    roe: 18.7,
    eps: 65.31,
    dividendYield: 0.76,
    debtToEquity: 1.04,
    beta: 0.96,
    headquarters: 'Mumbai, Maharashtra, India',
    ceo: 'Sandeep Bakhshi',
    employees: '141,000',
    industry: 'Private & Commercial Banking',
    description:
      'ICICI Bank provides retail lending, corporate credit, wealth management, and digital banking platforms across India.',
  },
  TATAMOTORS: {
    baseClose: 842.5,
    dailyVol: 0.0192,
    annualDrift: 0.21,
    avgVolume: 14_850_000,
    marketCap: 3_100_000_000_000,
    peRatio: 10.4,
    pbRatio: 3.25,
    roe: 27.6,
    eps: 81.01,
    dividendYield: 0.71,
    debtToEquity: 0.94,
    beta: 1.38,
    headquarters: 'Mumbai, Maharashtra, India',
    ceo: 'P. B. Balaji (Group CFO) / Shailesh Chandra (EV)',
    employees: '91,000',
    industry: 'Passenger EVs & Luxury Vehicles',
    description:
      'Tata Motors manufactures passenger electric vehicles, commercial fleets, and Jaguar Land Rover luxury SUVs across global markets.',
  },
  BHARTIARTL: {
    baseClose: 1628.4,
    dailyVol: 0.0135,
    annualDrift: 0.22,
    avgVolume: 5_910_000,
    marketCap: 9_290_000_000_000,
    peRatio: 54.6,
    pbRatio: 9.8,
    roe: 17.5,
    eps: 29.82,
    dividendYield: 0.49,
    debtToEquity: 1.85,
    beta: 0.88,
    headquarters: 'New Delhi, India',
    ceo: 'Gopal Vittal',
    employees: '24,000',
    industry: '5G Wireless & Enterprise Fiber',
    description:
      'Bharti Airtel operates 5G mobile, broadband fiber, enterprise connectivity, and mobile payments networks across India and Africa.',
  },
  ITC: {
    baseClose: 478.9,
    dailyVol: 0.0108,
    annualDrift: 0.11,
    avgVolume: 12_900_000,
    marketCap: 5_980_000_000_000,
    peRatio: 28.9,
    pbRatio: 8.1,
    roe: 28.4,
    eps: 16.57,
    dividendYield: 2.88,
    debtToEquity: 0.01,
    beta: 0.64,
    headquarters: 'Kolkata, West Bengal, India',
    ceo: 'Sanjiv Puri',
    employees: '36,500',
    industry: 'FMCG, Paperboards & Agri-Business',
    description:
      'ITC Limited leads packaged consumer goods, specialty paperboards, hotels, and integrated agribusiness supply chains across India.',
  },
  SBIN: {
    baseClose: 824.15,
    dailyVol: 0.0155,
    annualDrift: 0.18,
    avgVolume: 16_400_000,
    marketCap: 7_350_000_000_000,
    peRatio: 10.8,
    pbRatio: 1.82,
    roe: 17.9,
    eps: 76.31,
    dividendYield: 1.66,
    debtToEquity: 1.38,
    beta: 1.15,
    headquarters: 'Mumbai, Maharashtra, India',
    ceo: 'Challa Sreenivasulu Setty',
    employees: '232,000',
    industry: 'Public Sector Banking',
    description:
      'State Bank of India is India’s largest public sector banking institution serving retail, MSME, sovereign infrastructure, and treasury clients.',
  },
  NVDA: {
    baseClose: 141.85,
    dailyVol: 0.0265,
    annualDrift: 0.42,
    avgVolume: 248_000_000,
    marketCap: 3_470_000_000_000,
    peRatio: 52.8,
    pbRatio: 44.2,
    roe: 115.0,
    eps: 2.69,
    dividendYield: 0.03,
    debtToEquity: 0.15,
    beta: 1.68,
    headquarters: 'Santa Clara, California, USA',
    ceo: 'Jensen Huang',
    employees: '29,600',
    industry: 'Accelerated Computing & AI GPUs',
    description:
      'NVIDIA designs data-center GPUs, CUDA software ecosystems, and high-speed networking interconnects powering generative AI and robotics.',
  },
  AAPL: {
    baseClose: 229.6,
    dailyVol: 0.0132,
    annualDrift: 0.18,
    avgVolume: 42_500_000,
    marketCap: 3_490_000_000_000,
    peRatio: 34.8,
    pbRatio: 51.4,
    roe: 147.2,
    eps: 6.6,
    dividendYield: 0.44,
    debtToEquity: 1.45,
    beta: 1.19,
    headquarters: 'Cupertino, California, USA',
    ceo: 'Tim Cook',
    employees: '164,000',
    industry: 'Consumer Devices & Services',
    description:
      'Apple builds iPhone, Mac, custom Apple Silicon, and high-margin Services ecosystems across App Store, iCloud, and Apple Pay.',
  },
  MSFT: {
    baseClose: 426.4,
    dailyVol: 0.0128,
    annualDrift: 0.19,
    avgVolume: 19_800_000,
    marketCap: 3_170_000_000_000,
    peRatio: 35.1,
    pbRatio: 11.4,
    roe: 36.2,
    eps: 12.15,
    dividendYield: 0.78,
    debtToEquity: 0.24,
    beta: 0.94,
    headquarters: 'Redmond, Washington, USA',
    ceo: 'Satya Nadella',
    employees: '228,000',
    industry: 'Enterprise Cloud & AI Software',
    description:
      'Microsoft operates Azure cloud infrastructure, Copilot enterprise productivity suites, GitHub developer tools, and intelligent business software.',
  },
  GOOGL: {
    baseClose: 176.3,
    dailyVol: 0.0158,
    annualDrift: 0.2,
    avgVolume: 23_400_000,
    marketCap: 2_160_000_000_000,
    peRatio: 23.4,
    pbRatio: 6.9,
    roe: 31.4,
    eps: 7.53,
    dividendYield: 0.45,
    debtToEquity: 0.09,
    beta: 1.05,
    headquarters: 'Mountain View, California, USA',
    ceo: 'Sundar Pichai',
    employees: '181,000',
    industry: 'Search, Cloud & DeepMind AI',
    description:
      'Alphabet combines Google Search, YouTube, Google Cloud infrastructure, and frontier Gemini AI research models.',
  },
  AMZN: {
    baseClose: 204.75,
    dailyVol: 0.0168,
    annualDrift: 0.23,
    avgVolume: 36_100_000,
    marketCap: 2_150_000_000_000,
    peRatio: 43.2,
    pbRatio: 8.6,
    roe: 22.8,
    eps: 4.74,
    dividendYield: 0.0,
    debtToEquity: 0.56,
    beta: 1.17,
    headquarters: 'Seattle, Washington, USA',
    ceo: 'Andy Jassy',
    employees: '1,525,000',
    industry: 'Cloud Infrastructure & E-Commerce',
    description:
      'Amazon leads global cloud infrastructure through AWS alongside fulfillment logistics, digital retail, and Prime advertising.',
  },
  TSLA: {
    baseClose: 328.4,
    dailyVol: 0.0315,
    annualDrift: 0.24,
    avgVolume: 74_200_000,
    marketCap: 1_050_000_000_000,
    peRatio: 88.4,
    pbRatio: 14.9,
    roe: 19.6,
    eps: 3.71,
    dividendYield: 0.0,
    debtToEquity: 0.18,
    beta: 2.04,
    headquarters: 'Austin, Texas, USA',
    ceo: 'Elon Musk',
    employees: '125,000',
    industry: 'Electric Vehicles & Energy Storage',
    description:
      'Tesla engineers battery-electric vehicles, utility-scale Megapack energy storage, and vision-based autonomous driving networks.',
  },
  AMD: {
    baseClose: 144.2,
    dailyVol: 0.0245,
    annualDrift: 0.22,
    avgVolume: 41_900_000,
    marketCap: 234_000_000_000,
    peRatio: 46.5,
    pbRatio: 4.1,
    roe: 7.4,
    eps: 3.1,
    dividendYield: 0.0,
    debtToEquity: 0.04,
    beta: 1.62,
    headquarters: 'Santa Clara, California, USA',
    ceo: 'Dr. Lisa Su',
    employees: '26,000',
    industry: 'Data-Center CPUs & Instinct AI',
    description:
      'Advanced Micro Devices develops EPYC server processors, Instinct MI-series AI accelerators, and adaptive SoCs.',
  },
  JPM: {
    baseClose: 243.9,
    dailyVol: 0.0118,
    annualDrift: 0.16,
    avgVolume: 8_950_000,
    marketCap: 688_000_000_000,
    peRatio: 13.5,
    pbRatio: 2.1,
    roe: 17.1,
    eps: 18.07,
    dividendYield: 2.05,
    debtToEquity: 1.21,
    beta: 1.07,
    headquarters: 'New York, New York, USA',
    ceo: 'Jamie Dimon',
    employees: '313,000',
    industry: 'Diversified Investment Banking',
    description:
      'JPMorgan Chase provides global investment banking, commercial treasury, asset management, and US consumer banking.',
  },
  META: {
    baseClose: 579.25,
    dailyVol: 0.0195,
    annualDrift: 0.28,
    avgVolume: 14_300_000,
    marketCap: 1_460_000_000_000,
    peRatio: 26.8,
    pbRatio: 8.9,
    roe: 35.8,
    eps: 21.61,
    dividendYield: 0.35,
    debtToEquity: 0.23,
    beta: 1.24,
    headquarters: 'Menlo Park, California, USA',
    ceo: 'Mark Zuckerberg',
    employees: '72,400',
    industry: 'Social Platforms & Open AI',
    description:
      'Meta Platforms connects billions across Instagram, WhatsApp, and Facebook while advancing open-weights Llama models and AI ad ranking.',
  },
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createPrng(seedStr: string) {
  let state = hashSeed(seedStr) || 123456789;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Reference deterministic anchor date so Demo Mode charts remain clean & stable across reloads
function getDemoAnchorTimestampSec(): number {
  const now = new Date();
  // Snap to UTC midnight of current day so 1D/1W/1M bars never collide on timestamps
  return Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 30, 0) /
      1000
  );
}

function formatDateIso(sec: number, intraday: boolean): string {
  const d = new Date(sec * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  if (!intraday) return `${yyyy}-${mm}-${dd}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function generateDailyMasterSeries(
  key: string,
  targetLatestClose: number,
  dailyVol: number,
  annualDrift: number,
  avgVolume: number,
  totalDays = 1350
): OhlcvBar[] {
  const rand = createPrng(`bullsight-demo-v1:${key}`);
  const anchorSec = getDemoAnchorTimestampSec();

  // Build trading days backwards (Mon-Fri)
  const timestamps: number[] = [];
  let cursor = anchorSec;
  while (timestamps.length < totalDays) {
    const day = new Date(cursor * 1000).getUTCDay();
    if (day !== 0 && day !== 6) {
      timestamps.push(cursor);
    }
    cursor -= 86400;
  }
  timestamps.reverse();

  // Generate unscaled random walk first, then scale smoothly so final close hits targetLatestClose
  const rawCloses: number[] = [100];
  const dailyDrift = annualDrift / 252;
  for (let i = 1; i < totalDays; i++) {
    const u1 = Math.max(1e-6, rand());
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const regimeWave = Math.sin(i / 28) * 0.0018 + Math.cos(i / 73) * 0.0012;
    const ret = dailyDrift + regimeWave + z * dailyVol;
    rawCloses.push(Math.max(10, rawCloses[i - 1] * Math.exp(ret)));
  }

  const scale = targetLatestClose / rawCloses[rawCloses.length - 1];
  const bars: OhlcvBar[] = [];

  for (let i = 0; i < totalDays; i++) {
    const close = Number((rawCloses[i] * scale).toFixed(2));
    const prevClose = i > 0 ? bars[i - 1].close : Number((close * 0.996).toFixed(2));
    const gap = (rand() - 0.5) * dailyVol * 0.55;
    const open = Number((prevClose * (1 + gap)).toFixed(2));
    const spreadUp = Math.abs(rand() * dailyVol * 0.85);
    const spreadDn = Math.abs(rand() * dailyVol * 0.85);
    const high = Number(
      (Math.max(open, close) * (1 + spreadUp)).toFixed(2)
    );
    const low = Number(
      (Math.min(open, close) * Math.max(0.5, 1 - spreadDn)).toFixed(2)
    );
    const volFactor = 0.65 + rand() * 0.85 + Math.abs(close - open) / close * 12;
    const volume = Math.round(avgVolume * volFactor);

    bars.push({
      time: formatDateIso(timestamps[i], false),
      timestamp: timestamps[i],
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return bars;
}

function generateIntradayBars(
  key: string,
  lastDailyBar: OhlcvBar,
  range: '1D' | '1W',
  dailyVol: number
): OhlcvBar[] {
  const rand = createPrng(`bullsight-intraday:${key}:${range}`);
  const count = range === '1D' ? 75 : 70;
  const stepSec = range === '1D' ? 300 : 1800;
  const startSec = lastDailyBar.timestamp - (count - 1) * stepSec;
  const startPrice = lastDailyBar.open;
  const endPrice = lastDailyBar.close;

  const bars: OhlcvBar[] = [];
  let prev = startPrice;
  const stepVol = dailyVol / (range === '1D' ? 8.5 : 4.2);

  for (let i = 0; i < count; i++) {
    const ts = startSec + i * stepSec;
    const progress = i / Math.max(1, count - 1);
    const targetDrift = startPrice + (endPrice - startPrice) * progress;
    const noise = (rand() - 0.5) * stepVol * prev;
    const close =
      i === count - 1
        ? endPrice
        : Number(Math.max(0.01, prev * 0.55 + targetDrift * 0.45 + noise).toFixed(2));
    const open = i === 0 ? startPrice : prev;
    const high = Number(
      (Math.max(open, close) * (1 + rand() * stepVol * 0.45)).toFixed(2)
    );
    const low = Number(
      (Math.min(open, close) * (1 - rand() * stepVol * 0.45)).toFixed(2)
    );
    const volume = Math.round((lastDailyBar.volume / count) * (0.6 + rand() * 0.9));

    bars.push({
      time: formatDateIso(ts, true),
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume,
    });
    prev = close;
  }

  return bars;
}

const masterSeriesCache = new Map<string, OhlcvBar[]>();

function getMasterDailyBars(key: string): OhlcvBar[] {
  const cached = masterSeriesCache.get(key);
  if (cached) return cached;

  const idxSeed = INDEX_DEMO_SEEDS[key];
  if (idxSeed) {
    const bars = generateDailyMasterSeries(
      key,
      idxSeed.baseClose,
      idxSeed.dailyVol,
      idxSeed.annualDrift,
      145_000_000
    );
    masterSeriesCache.set(key, bars);
    return bars;
  }

  const eqSeed = EQUITY_DEMO_SEEDS[key];
  if (eqSeed) {
    const bars = generateDailyMasterSeries(
      key,
      eqSeed.baseClose,
      eqSeed.dailyVol,
      eqSeed.annualDrift,
      eqSeed.avgVolume
    );
    masterSeriesCache.set(key, bars);
    return bars;
  }

  const fallback = generateDailyMasterSeries(key, 500, 0.015, 0.14, 2_000_000);
  masterSeriesCache.set(key, fallback);
  return fallback;
}

export function getDemoBars(key: string, range: ChartRange): OhlcvBar[] {
  const daily = getMasterDailyBars(key);
  const seed = INDEX_DEMO_SEEDS[key] ?? EQUITY_DEMO_SEEDS[key];
  const dailyVol = seed?.dailyVol ?? 0.015;

  if (range === '1D' || range === '1W') {
    return generateIntradayBars(key, daily[daily.length - 1], range, dailyVol);
  }
  switch (range) {
    case '1M':
      return daily.slice(-22);
    case '3M':
      return daily.slice(-66);
    case '6M':
      return daily.slice(-132);
    case '1Y':
      return daily.slice(-252);
    case '5Y':
      return daily.filter((_, idx) => idx % 5 === 0 || idx === daily.length - 1).slice(-260);
    case 'MAX':
      return daily.filter((_, idx) => idx % 10 === 0 || idx === daily.length - 1);
  }
}

export function getDemoTimestampIso(): string {
  return new Date(getDemoAnchorTimestampSec() * 1000).toISOString();
}

export function getDemoIndices(market: 'All' | MarketRegion = 'All'): MarketIndex[] {
  const defs =
    market === 'All'
      ? INDEX_DEFINITIONS
      : INDEX_DEFINITIONS.filter((i) => i.market === market);
  const tsIso = getDemoTimestampIso();

  return defs.map((def: IndexDefinition) => {
    const daily = getMasterDailyBars(def.id);
    const latest = daily[daily.length - 1];
    const prev = daily[daily.length - 2];
    const change = Number((latest.close - prev.close).toFixed(2));
    const changePercent = Number(((change / prev.close) * 100).toFixed(2));

    return {
      id: def.id,
      symbol: def.symbol,
      normalizedSymbol: def.normalizedSymbol,
      name: def.name,
      market: def.market,
      exchange: def.exchange,
      currency: def.currency,
      provider: 'Demo Fixture',
      feedStatus: 'Demo',
      stale: false,
      providerTimestamp: tsIso,
      fetchedAt: tsIso,
      value: latest.close,
      change,
      changePercent,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      previousClose: prev.close,
      sparkline: daily.slice(-16).map((b) => b.close),
    };
  });
}

export function getDemoEquityRecord(def: EquityDefinition): StockRecord {
  const daily = getMasterDailyBars(def.ticker);
  const seed = EQUITY_DEMO_SEEDS[def.ticker];
  const latest = daily[daily.length - 1];
  const prev = daily[daily.length - 2];
  const change = Number((latest.close - prev.close).toFixed(2));
  const changePercent = Number(((change / prev.close) * 100).toFixed(2));
  const tsIso = getDemoTimestampIso();

  return {
    ticker: def.ticker,
    normalizedSymbol: def.normalizedSymbol,
    name: def.name,
    market: def.market,
    exchange: def.exchange,
    currency: def.currency,
    sector: def.sector,
    provider: 'Demo Fixture',
    feedStatus: 'Demo',
    stale: false,
    providerTimestamp: tsIso,
    fetchedAt: tsIso,
    price: latest.close,
    previousClose: prev.close,
    change,
    changePercent,
    open: latest.open,
    high: latest.high,
    low: latest.low,
    volume: latest.volume,
    marketCap: seed?.marketCap ?? null,
    sparkline: daily.slice(-16).map((b) => b.close),
  };
}

export function getDemoEquityDetailMeta(def: EquityDefinition): {
  profile: StockProfile;
  fundamentals: StockFundamentals;
} {
  const daily = getMasterDailyBars(def.ticker);
  const yearBars = daily.slice(-252);
  const high52W = Math.max(...yearBars.map((b) => b.high));
  const low52W = Math.min(...yearBars.map((b) => b.low));
  const seed = EQUITY_DEMO_SEEDS[def.ticker];
  const dateIso = getDemoTimestampIso().slice(0, 10);

  const profile: StockProfile = {
    description:
      seed?.description ?? `${def.name} operates in the ${def.sector} industry.`,
    headquarters: seed?.headquarters ?? `${def.market} Operations`,
    ceo: seed?.ceo ?? 'Executive Leadership',
    employees: seed?.employees ?? '—',
    sector: def.sector,
    industry: seed?.industry ?? def.sector,
    asOfDate: dateIso,
    provider: 'Demo Fixture',
  };

  const fundamentals: StockFundamentals = {
    marketCap: seed?.marketCap ?? null,
    peRatio: seed?.peRatio ?? null,
    pbRatio: seed?.pbRatio ?? null,
    dividendYield: seed?.dividendYield ?? null,
    roe: seed?.roe ?? null,
    eps: seed?.eps ?? null,
    debtToEquity: seed?.debtToEquity ?? null,
    high52W: Number(high52W.toFixed(2)),
    low52W: Number(low52W.toFixed(2)),
    avgVolume: seed?.avgVolume ?? null,
    beta: seed?.beta ?? null,
    reportingDate: `${dateIso} (Demo Fixture)`,
    provider: 'Demo Fixture',
  };

  return { profile, fundamentals };
}

export const DEMO_NEWS_ARTICLES: NewsArticle[] = [
  {
    id: 'demo-news-1',
    title: 'NVIDIA Blackwell Data-Center Ramp Accelerates Hyperscaler AI Capex',
    summary:
      'Simulated market briefing: Cloud hyperscalers expand next-generation GPU clusters, lifting semiconductor order visibility across US tech.',
    body: [
      'Illustrative Demo Article — Demand for accelerated AI training and inference infrastructure continues to pace semiconductor capital expenditure plans.',
      'Major cloud providers reiterated multi-quarter commitments for liquid-cooled rack architectures, supporting supplier backlog expectations across GPU and high-bandwidth memory ecosystems.',
    ],
    source: 'BULLSIGHT Demo Wire',
    publishedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    category: 'AI & Tech',
    sentiment: 'Bullish',
    tickers: ['NVDA', 'AMD', 'MSFT'],
    readTime: '3 min read',
  },
  {
    id: 'demo-news-2',
    title: 'Reliance Jio & New Energy Milestones Anchor NIFTY Heavyweight Flows',
    summary:
      'Simulated market briefing: Domestic institutional inflows track telecom tariff stabilization and solar gigafactory commissioning timelines.',
    body: [
      'Illustrative Demo Article — Institutional desks highlighted steady average revenue per user progression in wireless services alongside retail margin resilience.',
      'Energy transition capex remains in focus as integrated refining spreads stay balanced across Asian benchmark cracks.',
    ],
    source: 'India Markets Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
    category: 'India Markets',
    sentiment: 'Bullish',
    tickers: ['RELIANCE', 'BHARTIARTL'],
    readTime: '4 min read',
  },
  {
    id: 'demo-news-3',
    title: 'Indian IT Exporters Highlight BFSI Cloud Modernization Pipeline',
    summary:
      'Simulated market briefing: TCS and Infosys report improving discretionary deal conversions across North American banking accounts.',
    body: [
      'Illustrative Demo Article — Enterprise modernization programs pairing legacy core banking migrations with generative AI workflows saw higher pilot-to-production conversion.',
      'Operating margin discipline and lower voluntary attrition continue to buffer near-term currency swings.',
    ],
    source: 'Dalal Street Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    category: 'Earnings',
    sentiment: 'Bullish',
    tickers: ['TCS', 'INFY'],
    readTime: '3 min read',
  },
  {
    id: 'demo-news-4',
    title: 'Private Lenders Hold Credit Quality Steady as Deposit Competition Intensifies',
    summary:
      'Simulated market briefing: HDFC Bank, ICICI Bank, and SBI balance retail deposit mobilization with disciplined net interest margins.',
    body: [
      'Illustrative Demo Article — Banking analysts note healthy corporate asset quality metrics while funding cost adjustments remain the primary variable for quarterly NIM trajectory.',
    ],
    source: 'Banking Brief Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 440).toISOString(),
    category: 'India Markets',
    sentiment: 'Neutral',
    tickers: ['HDFCBANK', 'ICICIBANK', 'SBIN'],
    readTime: '3 min read',
  },
  {
    id: 'demo-news-5',
    title: 'Apple Services Revenue Mix Offsets Hardware Replacement Volatility',
    summary:
      'Simulated market briefing: Installed device base monetization and on-device intelligence upgrades remain central to US mega-cap valuation support.',
    body: [
      'Illustrative Demo Article — Recurring subscription attach rates in cloud storage, payments, and media services continue lifting consolidated gross margin profiles.',
    ],
    source: 'US Equities Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 580).toISOString(),
    category: 'US Markets',
    sentiment: 'Bullish',
    tickers: ['AAPL', 'MSFT', 'GOOGL'],
    readTime: '3 min read',
  },
  {
    id: 'demo-news-6',
    title: 'Tesla Margin Sensitivity Under Scrutiny Amid Global EV Pricing Shifts',
    summary:
      'Simulated market briefing: Auto gross margins react to promotional financing while Megapack energy storage deliveries expand share.',
    body: [
      'Illustrative Demo Article — Market participants weigh stationary storage expansion and autonomous software milestones against near-term automotive pricing competition.',
    ],
    source: 'Auto & Energy Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 740).toISOString(),
    category: 'US Markets',
    sentiment: 'Bearish',
    tickers: ['TSLA', 'TATAMOTORS'],
    readTime: '4 min read',
  },
  {
    id: 'demo-news-7',
    title: 'Global Central Banks Signal Data-Dependent Rate Trajectory Ahead of Macro Prints',
    summary:
      'Simulated market briefing: Sovereign bond yields steady as equity investors parse inflation breadth and industrial PMI releases.',
    body: [
      'Illustrative Demo Article — Cross-asset desks remain watchful of core services inflation in the US and domestic liquidity operations by the RBI.',
    ],
    source: 'Macro Desk Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 960).toISOString(),
    category: 'Macro & Policy',
    sentiment: 'Neutral',
    tickers: ['JPM', 'HDFCBANK', 'ITC'],
    readTime: '3 min read',
  },
  {
    id: 'demo-news-8',
    title: 'Meta & Alphabet AI Ad-Ranking Upgrades Drive Digital Advertising Efficiency',
    summary:
      'Simulated market briefing: Automated campaign attribution lifts advertiser return on ad spend across short-form video and search.',
    body: [
      'Illustrative Demo Article — Higher conversion yields across retail and SMB advertisers continue supporting core digital ad pricing alongside elevated AI compute investment.',
    ],
    source: 'Tech Brief Demo',
    publishedAt: new Date(Date.now() - 1000 * 60 * 1120).toISOString(),
    category: 'AI & Tech',
    sentiment: 'Bullish',
    tickers: ['META', 'GOOGL', 'AMZN'],
    readTime: '3 min read',
  },
];

export function listDemoNews(filters?: {
  category?: string;
  q?: string;
  ticker?: string;
}): {
  articles: NewsArticle[];
  categories: string[];
} {
  const allCats = [
    'All',
    ...Array.from(new Set(DEMO_NEWS_ARTICLES.map((a) => a.category))),
  ];
  let list = [...DEMO_NEWS_ARTICLES];

  if (filters?.category && filters.category !== 'All') {
    list = list.filter((a) => a.category === filters.category);
  }
  if (filters?.ticker && filters.ticker.trim()) {
    const t = filters.ticker.trim().toUpperCase();
    list = list.filter((a) => a.tickers.includes(t));
  }
  if (filters?.q && filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tickers.some((t) => t.toLowerCase().includes(q))
    );
  }

  return { articles: list, categories: allCats };
}

export function getDemoPrediction(
  symbol: string,
  horizon: HorizonType
): StockPrediction {
  const upper = symbol.trim().toUpperCase();
  const def =
    TRACKED_EQUITIES.find((e) => e.ticker === upper) ?? TRACKED_EQUITIES[0];
  const daily = getMasterDailyBars(def.ticker);
  const recent = daily.slice(-45);
  const latest = recent[recent.length - 1];
  const sma20 =
    recent.slice(-20).reduce((sum, b) => sum + b.close, 0) /
    Math.min(20, recent.length);
  const sma5 =
    recent.slice(-5).reduce((sum, b) => sum + b.close, 0) /
    Math.min(5, recent.length);

  const horizonDays =
    horizon === '7D' ? 7 : horizon === '14D' ? 14 : horizon === '30D' ? 30 : 90;
  const rand = createPrng(`bullsight-pred:${def.ticker}:${horizon}`);

  const momentumPct = (sma5 - sma20) / sma20;
  const bias = momentumPct * 0.65 + (rand() - 0.42) * 0.035;
  const cappedMove = Math.max(-0.14, Math.min(0.18, bias * Math.sqrt(horizonDays / 14)));
  const predictedPrice = Number((latest.close * (1 + cappedMove)).toFixed(2));
  const bandSpread = latest.close * (0.025 + Math.sqrt(horizonDays) * 0.0085);
  const predictedLow = Number((predictedPrice - bandSpread).toFixed(2));
  const predictedHigh = Number((predictedPrice + bandSpread).toFixed(2));
  const expectedMovePercent = Number(
    (((predictedPrice - latest.close) / latest.close) * 100).toFixed(2)
  );

  const signal: SignalType =
    expectedMovePercent >= 1.2
      ? 'Bullish'
      : expectedMovePercent <= -1.2
      ? 'Bearish'
      : 'Neutral';

  const confidence = Math.round(
    Math.max(54, Math.min(86, 62 + Math.abs(expectedMovePercent) * 2.1 + rand() * 8))
  );

  // Build historical + forecast series
  const series: PredictionPoint[] = [];
  for (let i = 0; i < recent.length; i++) {
    const bar = recent[i];
    const fitNoise = (rand() - 0.5) * bar.close * 0.012;
    series.push({
      time: bar.time,
      timestamp: bar.timestamp,
      actual: bar.close,
      predicted: Number((bar.close + fitNoise).toFixed(2)),
    });
  }

  let futureTs = latest.timestamp;
  let stepPrice = latest.close;
  const stepCount = Math.min(horizonDays, 30);
  for (let i = 1; i <= stepCount; i++) {
    futureTs += 86400;
    const day = new Date(futureTs * 1000).getUTCDay();
    if (day === 0) futureTs += 86400;
    if (day === 6) futureTs += 2 * 86400;

    const t = i / stepCount;
    const baseProj = latest.close + (predictedPrice - latest.close) * t;
    const wave = Math.sin(i * 0.7) * bandSpread * 0.14;
    stepPrice = Number((baseProj + wave).toFixed(2));
    const width = bandSpread * Math.sqrt(t);

    series.push({
      time: formatDateIso(futureTs, false),
      timestamp: futureTs,
      predicted: stepPrice,
      upper: Number((stepPrice + width).toFixed(2)),
      lower: Number((stepPrice - width).toFixed(2)),
    });
  }

  const mae = Number((latest.close * (0.011 + rand() * 0.008)).toFixed(2));
  const rmse = Number((mae * 1.28).toFixed(2));
  const directionalMatchRate = Number((58 + rand() * 16).toFixed(1));

  const history: PredictionHistoryItem[] = [1, 2, 3, 4].map((idx) => {
    const sampleBar = daily[daily.length - 1 - idx * 14] ?? latest;
    const actualPrice = sampleBar.close;
    const err = (rand() - 0.48) * 0.032;
    const targetPrice = Number((actualPrice * (1 + err)).toFixed(2));
    return {
      id: `${def.ticker}-hist-${idx}`,
      date: sampleBar.time,
      horizon,
      signal: err >= 0 ? 'Bullish' : 'Bearish',
      targetPrice,
      actualPrice,
      errorPercent: Number((Math.abs(err) * 100).toFixed(2)),
    };
  });

  return {
    ticker: def.ticker,
    stockName: def.name,
    currency: def.currency,
    horizon,
    signal,
    confidence,
    currentPrice: latest.close,
    predictedPrice,
    predictedLow,
    predictedHigh,
    expectedMovePercent,
    mae,
    rmse,
    directionalMatchRate,
    modelName: 'BULLSIGHT Ensemble (Illustrative Demo)',
    evaluatedAt: getDemoTimestampIso(),
    isDemo: true,
    rationale: [
      'Illustrative demo output computed from local simulated OHLCV series.',
      `Short-term momentum (${sma5 >= sma20 ? 'above' : 'below'} 20-day moving average) shapes directional drift.`,
      `Confidence interval calibrated to simulated ${horizon} volatility envelope.`,
    ],
    drivers: [
      {
        label: '20D / 5D Moving Average Slope',
        weight: 34,
        direction: sma5 >= sma20 ? 'Bullish' : 'Bearish',
      },
      {
        label: 'Volatility Band Expansion',
        weight: 26,
        direction: signal,
      },
      {
        label: 'Volume Participation Trend',
        weight: 22,
        direction: latest.volume >= (EQUITY_DEMO_SEEDS[def.ticker]?.avgVolume ?? latest.volume) ? 'Bullish' : 'Neutral',
      },
      {
        label: 'Cross-Session Mean Reversion',
        weight: 18,
        direction: 'Neutral',
      },
    ],
    series,
    history,
  };
}

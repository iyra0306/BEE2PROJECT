export type MarketRegion = 'India' | 'US';
export type ExchangeCode = 'NSE' | 'BSE' | 'NASDAQ' | 'NYSE';
export type CurrencyCode = 'INR' | 'USD';
export type ChartRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';
export type SignalType = 'Bullish' | 'Bearish' | 'Neutral';
export type HorizonType = '7D' | '14D' | '30D' | '90D';

export type DataMode = 'demo' | 'real';
export type FeedStatus =
  | 'Live'
  | 'Delayed'
  | 'End of day'
  | 'Demo'
  | 'Unavailable';
export type ProviderName =
  | 'GFDL'
  | 'Twelve Data'
  | 'Bhavcopy CSV'
  | 'News Feed'
  | 'Python Model'
  | 'Demo Fixture'
  | 'None';

export interface BhavcopyBar {
  symbol: string;
  date: string; // YYYY-MM-DD
  timestamp: number; // unix seconds (15:30 IST close)
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number | null;
  volume: number;
  series: string;
  name?: string;
}

export interface BhavcopyImportStats {
  totalSymbols: number;
  totalRows: number;
  dates: string[]; // sorted ascending YYYY-MM-DD
  latestDate: string | null;
  earliestDate: string | null;
  lastImportedAt: string | null;
  sampleCloses: Array<{
    symbol: string;
    name?: string;
    date: string;
    close: number;
    changePercent: number | null;
  }>;
}

export interface OhlcvBar {
  time: string; // YYYY-MM-DD for daily/week/month, or YYYY-MM-DDTHH:MM for intraday
  timestamp: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketIndex {
  id: string;
  symbol: string;
  normalizedSymbol: string;
  name: string;
  market: MarketRegion;
  exchange: string;
  currency: CurrencyCode;
  provider: ProviderName;
  feedStatus: FeedStatus;
  stale: boolean;
  providerTimestamp: string | null;
  fetchedAt: string | null;
  unavailableReason?: string;
  value: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  sparkline: number[];
}

export interface StockFundamentals {
  marketCap?: number | null;
  peRatio?: number | null;
  pbRatio?: number | null;
  dividendYield?: number | null;
  roe?: number | null;
  eps?: number | null;
  debtToEquity?: number | null;
  high52W?: number | null;
  low52W?: number | null;
  avgVolume?: number | null;
  beta?: number | null;
  reportingDate?: string | null;
  provider?: string | null;
  unavailableReason?: string;
}

export interface StockProfile {
  description?: string | null;
  headquarters?: string | null;
  ceo?: string | null;
  employees?: string | null;
  sector?: string | null;
  industry?: string | null;
  website?: string | null;
  asOfDate?: string | null;
  provider?: string | null;
  unavailableReason?: string;
}

export interface StockRecord {
  ticker: string;
  normalizedSymbol: string;
  name: string;
  market: MarketRegion;
  exchange: ExchangeCode;
  currency: CurrencyCode;
  sector: string;
  provider: ProviderName;
  feedStatus: FeedStatus;
  stale: boolean;
  providerTimestamp: string | null;
  fetchedAt: string | null;
  unavailableReason?: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  marketCap: number | null;
  sparkline: number[];
  profile?: StockProfile;
  fundamentals?: StockFundamentals;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  body?: string[];
  source: string;
  publishedAt: string;
  url?: string;
  category: string;
  sentiment?: SignalType | null;
  tickers: string[];
  readTime?: string;
}

export interface PredictionPoint {
  time: string;
  timestamp: number;
  actual?: number;
  predicted: number;
  upper?: number;
  lower?: number;
}

export interface PredictionHistoryItem {
  id: string;
  date: string;
  horizon: HorizonType;
  signal: SignalType;
  targetPrice: number;
  actualPrice: number;
  errorPercent: number;
}

export interface StockPrediction {
  ticker: string;
  stockName?: string;
  currency?: CurrencyCode;
  horizon: HorizonType;
  signal: SignalType;
  confidence: number;
  currentPrice: number;
  predictedPrice: number;
  predictedLow: number;
  predictedHigh: number;
  expectedMovePercent: number;
  mae: number;
  rmse: number;
  directionalMatchRate: number;
  modelName?: string;
  evaluatedAt?: string;
  isDemo?: boolean;
  rationale: string[];
  drivers: { label: string; weight: number; direction: SignalType }[];
  series: PredictionPoint[];
  history: PredictionHistoryItem[];
}

export interface DisplayPreferences {
  theme: 'dark' | 'light';
  dataModePreference: 'auto' | DataMode;
  defaultMarket: 'All' | MarketRegion;
  currencyMode: 'Native' | 'USD' | 'INR';
  defaultChartType: 'candlestick' | 'line';
  defaultRange: ChartRange;
  showVolumeByDefault: boolean;
  compactTables: boolean;
  priceAlertsEnabled: boolean;
  aiSignalDigestEnabled: boolean;
}

export interface ProviderHealthStatus {
  id: 'gfdl' | 'twelveData' | 'news' | 'prediction';
  name: string;
  configured: boolean;
  connected: boolean;
  feedStatus: FeedStatus;
  streaming: boolean;
  recommendedPollMs: number;
  missingSettings: string[];
  notes: string;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface FxRateInfo {
  pair: 'USD/INR';
  rate: number | null;
  timestamp: string | null;
  provider: string | null;
  unavailableReason?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  watchlist: string[];
  createdAt?: string;
}

export interface AccountServiceStatus {
  configured: boolean;
  mongoConfigured: boolean;
  jwtConfigured: boolean;
  connected: boolean;
  ready: boolean;
  missingSettings: string[];
  message: string;
}

export interface ApiProviderMeta {
  mode: 'live' | 'partial' | 'unconfigured' | 'demo';
  dataMode: DataMode;
  hasRealSource: boolean;
  universeLabel: string;
  streamingActive: boolean;
  recommendedPollMs: number;
  fxUsdToInr: FxRateInfo;
  accountService?: AccountServiceStatus;
  providers: {
    gfdl: ProviderHealthStatus;
    twelveData: ProviderHealthStatus;
    news: ProviderHealthStatus;
    prediction: ProviderHealthStatus;
  };
  generatedAt: string;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  mode: 'live' | 'partial' | 'unconfigured' | 'demo';
  dataMode: DataMode;
  hasRealSource: boolean;
  accountService?: AccountServiceStatus;
  uptimeSeconds: number;
  timestamp: string;
  counts: {
    indices: number;
    trackedEquities: number;
  };
  meta: ApiProviderMeta;
}

export interface MarketOverviewResponse {
  dataMode: DataMode;
  indices: MarketIndex[];
  selectedIndex: MarketIndex;
  indexHistory: OhlcvBar[];
  historyStatus: {
    feedStatus: FeedStatus;
    stale: boolean;
    provider: ProviderName;
    providerTimestamp: string | null;
    unavailableReason?: string;
  };
  range: ChartRange;
  movers: {
    gainers: StockRecord[];
    losers: StockRecord[];
    mostActive: StockRecord[];
    trackedUniverseSize: number;
    pricedCount: number;
  };
  sectors: string[];
  meta: ApiProviderMeta;
}

export interface StocksListResponse {
  dataMode: DataMode;
  stocks: StockRecord[];
  total: number;
  pricedCount: number;
  trackedUniverseLabel: string;
  sectors: string[];
  exchanges: ExchangeCode[];
  meta: ApiProviderMeta;
}

export interface StockDetailResponse {
  dataMode: DataMode;
  stock: StockRecord;
  relatedNews: {
    connected: boolean;
    isDemo?: boolean;
    articles: NewsArticle[];
    message?: string;
  };
  meta: ApiProviderMeta;
}

export interface StockHistoryResponse {
  dataMode: DataMode;
  symbol: string;
  normalizedSymbol: string;
  currency: CurrencyCode;
  exchange: ExchangeCode;
  provider: ProviderName;
  feedStatus: FeedStatus;
  stale: boolean;
  providerTimestamp: string | null;
  unavailableReason?: string;
  range: ChartRange;
  count: number;
  bars: OhlcvBar[];
  meta: ApiProviderMeta;
}

export interface NewsListResponse {
  dataMode?: DataMode;
  connected: boolean;
  isDemo?: boolean;
  provider: string | null;
  message?: string;
  articles: NewsArticle[];
  total: number;
  categories: string[];
  meta: ApiProviderMeta;
}

export interface PredictionResponse {
  dataMode?: DataMode;
  connected: boolean;
  isDemo?: boolean;
  symbol: string;
  horizon: HorizonType;
  message?: string;
  prediction: StockPrediction | null;
  meta: ApiProviderMeta;
}

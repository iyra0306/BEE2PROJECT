import type {
  ApiProviderMeta,
  ChartRange,
  DataMode,
  ExchangeCode,
  MarketIndex,
  MarketOverviewResponse,
  MarketRegion,
  OhlcvBar,
  StockDetailResponse,
  StockHistoryResponse,
  StockRecord,
} from '../../src/types/market.ts';
import { getAccountServiceStatus } from '../db/mongo.ts';
import { getProviderConfig } from '../config/providers.ts';
import {
  getDemoBars,
  getDemoEquityDetailMeta,
  getDemoEquityRecord,
  getDemoIndices,
  getDemoTimestampIso,
} from '../data/demoData.ts';
import {
  INDEX_DEFINITIONS,
  TRACKED_EQUITIES,
  TRACKED_UNIVERSE_LABEL,
  type EquityDefinition,
  type IndexDefinition,
} from '../data/universe.ts';
import {
  gfdlProvider,
  startGfdlWebsocketIfConfigured,
  type NormalizedQuoteResult,
} from '../providers/gfdlProvider.ts';
import { newsProvider } from '../providers/newsProvider.ts';
import { predictionProvider } from '../providers/predictionProvider.ts';
import { twelveDataProvider } from '../providers/twelveDataProvider.ts';

export const ALLOWED_RANGES: readonly ChartRange[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  '6M',
  '1Y',
  '5Y',
  'MAX',
];

export const ALLOWED_MARKETS = ['All', 'India', 'US'] as const;
export const ALLOWED_EXCHANGES = ['All', 'NSE', 'BSE', 'NASDAQ', 'NYSE'] as const;
export const ALLOWED_PRICE_TIERS = ['All', 'under500', '500to2000', 'over2000'] as const;
export const ALLOWED_PERFORMANCE = ['All', 'Gainers', 'Losers'] as const;
export const ALLOWED_SORT_BY = [
  'ticker',
  'name',
  'price',
  'changePercent',
  'volume',
  'marketCap',
] as const;
export const ALLOWED_SORT_DIR = ['asc', 'desc'] as const;
export const ALLOWED_MODES: readonly DataMode[] = ['demo', 'real'];

export function normalizeRange(raw?: unknown): ChartRange | null {
  if (raw === undefined || raw === null || raw === '') return '1M';
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return (ALLOWED_RANGES as readonly string[]).includes(upper)
    ? (upper as ChartRange)
    : null;
}

export function resolveDataMode(rawMode?: unknown): DataMode | null {
  if (rawMode === undefined || rawMode === null || rawMode === '') {
    const cfg = getProviderConfig();
    const hasRealSource = cfg.gfdl.configured || cfg.twelveData.configured;
    return hasRealSource ? 'real' : 'demo';
  }
  if (typeof rawMode !== 'string') return null;
  const lower = rawMode.trim().toLowerCase();
  if (lower === 'demo' || lower === 'real') return lower;
  return null;
}

export function isValidSymbolFormat(symbol: string): boolean {
  // Supports bare tickers (RELIANCE, NVDA) and exchange-normalized symbols (NSE:RELIANCE, BSE:500325)
  return /^([A-Z]{2,8}:)?[A-Z0-9.-]{1,18}$/.test(symbol);
}

function parseSymbolInput(rawSymbol: string): {
  exchangePrefix: ExchangeCode | null;
  ticker: string;
} {
  const upper = rawSymbol.trim().toUpperCase();
  const colonIdx = upper.indexOf(':');
  if (colonIdx > 0) {
    const prefix = upper.slice(0, colonIdx);
    const ticker = upper.slice(colonIdx + 1);
    if (
      prefix === 'NSE' ||
      prefix === 'BSE' ||
      prefix === 'NASDAQ' ||
      prefix === 'NYSE'
    ) {
      return { exchangePrefix: prefix, ticker };
    }
    return { exchangePrefix: null, ticker };
  }
  return { exchangePrefix: null, ticker: upper };
}

function findTrackedEquity(rawSymbol: string): EquityDefinition | undefined {
  const { exchangePrefix, ticker } = parseSymbolInput(rawSymbol);
  if (exchangePrefix) {
    const exact = TRACKED_EQUITIES.find(
      (e) =>
        e.exchange === exchangePrefix &&
        (e.ticker === ticker || e.alternateGfdlSymbols?.includes(ticker))
    );
    if (exact) return exact;
  }
  return TRACKED_EQUITIES.find(
    (e) => e.ticker === ticker || e.alternateGfdlSymbols?.includes(ticker)
  );
}

function quoteToStockRecord(
  def: EquityDefinition,
  quote?: NormalizedQuoteResult
): StockRecord {
  const validPrice = quote && Number.isFinite(quote.price) ? quote.price : null;
  return {
    ticker: def.ticker,
    normalizedSymbol: def.normalizedSymbol,
    name: def.name,
    market: def.market,
    exchange: def.exchange,
    currency: def.currency,
    sector: def.sector,
    provider: def.provider,
    feedStatus: validPrice !== null && quote ? quote.feedStatus : 'Unavailable',
    stale: Boolean(quote?.stale),
    providerTimestamp: quote?.providerTimestamp ?? null,
    fetchedAt: quote?.fetchedAt ?? null,
    unavailableReason: quote?.unavailableReason,
    price: validPrice,
    previousClose: quote?.previousClose ?? null,
    change: quote?.change ?? null,
    changePercent: quote?.changePercent ?? null,
    open: quote?.open ?? null,
    high: quote?.high ?? null,
    low: quote?.low ?? null,
    volume: quote?.volume ?? null,
    marketCap: null,
    sparkline: [],
  };
}

function quoteToIndexRecord(
  def: IndexDefinition,
  quote?: NormalizedQuoteResult,
  sparkline: number[] = []
): MarketIndex {
  const validVal = quote && Number.isFinite(quote.price) ? quote.price : null;
  return {
    id: def.id,
    symbol: def.symbol,
    normalizedSymbol: def.normalizedSymbol,
    name: def.name,
    market: def.market,
    exchange: def.exchange,
    currency: def.currency,
    provider: def.provider,
    feedStatus: validVal !== null && quote ? quote.feedStatus : 'Unavailable',
    stale: Boolean(quote?.stale),
    providerTimestamp: quote?.providerTimestamp ?? null,
    fetchedAt: quote?.fetchedAt ?? null,
    unavailableReason: quote?.unavailableReason,
    value: validVal,
    previousClose: quote?.previousClose ?? null,
    change: quote?.change ?? null,
    changePercent: quote?.changePercent ?? null,
    open: quote?.open ?? null,
    high: quote?.high ?? null,
    low: quote?.low ?? null,
    sparkline,
  };
}

export async function buildProviderMeta(
  requestedMode?: DataMode
): Promise<ApiProviderMeta> {
  const gfdlHealth = gfdlProvider.getHealth();
  const tdHealth = twelveDataProvider.getHealth();
  const newsHealth = newsProvider.getHealth();
  const predHealth = predictionProvider.getHealth();

  const hasRealSource = gfdlHealth.configured || tdHealth.configured;
  const dataMode: DataMode = requestedMode ?? (hasRealSource ? 'real' : 'demo');

  const fxUsdToInr =
    dataMode === 'demo'
      ? {
          pair: 'USD/INR' as const,
          rate: 84.45,
          timestamp: getDemoTimestampIso(),
          provider: 'Demo Fixture',
        }
      : await twelveDataProvider.getUsdToInrRate();

  const bothConfigured = gfdlHealth.configured && tdHealth.configured;
  const eitherConfigured = gfdlHealth.configured || tdHealth.configured;
  const mode =
    dataMode === 'demo'
      ? 'demo'
      : bothConfigured
      ? 'live'
      : eitherConfigured
      ? 'partial'
      : 'unconfigured';

  const streamingActive = dataMode === 'real' && gfdlHealth.streaming;
  const pollCandidates =
    dataMode === 'demo'
      ? []
      : [gfdlHealth, tdHealth]
          .filter((p) => p.configured)
          .map((p) => p.recommendedPollMs);
  const recommendedPollMs =
    pollCandidates.length > 0 ? Math.max(...pollCandidates) : 0;

  return {
    mode,
    dataMode,
    hasRealSource,
    universeLabel: TRACKED_UNIVERSE_LABEL,
    streamingActive,
    recommendedPollMs,
    fxUsdToInr,
    accountService: getAccountServiceStatus(),
    providers: {
      gfdl: gfdlHealth,
      twelveData: tdHealth,
      news: newsHealth,
      prediction: predHealth,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function initProviderStreams(): void {
  const cfg = getProviderConfig().gfdl;
  if (!cfg.configured || !cfg.streamingEnabled || !cfg.wsUrl) return;
  const streamSymbols = [
    { exchange: cfg.niftyExchange, symbol: cfg.niftySymbol },
    { exchange: cfg.sensexExchange, symbol: cfg.sensexSymbol },
    ...TRACKED_EQUITIES.filter((e) => e.provider === 'GFDL').map((e) => ({
      exchange: e.exchange,
      symbol: e.providerSymbol,
    })),
  ];
  startGfdlWebsocketIfConfigured(streamSymbols);
}

export const marketService = {
  getCounts() {
    return {
      indices: INDEX_DEFINITIONS.length,
      trackedEquities: TRACKED_EQUITIES.length,
    };
  },

  getSectors(): string[] {
    return Array.from(new Set(TRACKED_EQUITIES.map((e) => e.sector))).sort();
  },

  getExchanges(): ExchangeCode[] {
    return ['NSE', 'BSE', 'NASDAQ', 'NYSE'];
  },

  getSuggestedSymbols(limit = 6): string[] {
    return TRACKED_EQUITIES.slice(0, limit).map((e) => e.ticker);
  },

  async getIndices(
    market: 'All' | MarketRegion = 'All',
    mode: DataMode = 'real'
  ): Promise<MarketIndex[]> {
    if (mode === 'demo') {
      return getDemoIndices(market);
    }

    const defs =
      market === 'All'
        ? INDEX_DEFINITIONS
        : INDEX_DEFINITIONS.filter((idx) => idx.market === market);

    const cfg = getProviderConfig().gfdl;

    // Fetch India indices independently (GFDL) and US indices separately (Twelve Data)
    const usDefs = defs.filter((d) => d.provider === 'Twelve Data');
    const usSymbols = usDefs.map((d) => d.providerSymbol);

    const [niftyQuote, sensexQuote, usQuotes] = await Promise.all([
      defs.some((d) => d.id === 'NIFTY50')
        ? gfdlProvider.getSingleQuote(cfg.niftyExchange, cfg.niftySymbol, ['NIFTY 50'])
        : Promise.resolve(undefined),
      defs.some((d) => d.id === 'SENSEX')
        ? gfdlProvider.getSingleQuote(cfg.sensexExchange, cfg.sensexSymbol, ['SENSEX'])
        : Promise.resolve(undefined),
      usSymbols.length > 0
        ? twelveDataProvider.getBatchQuotes(usSymbols)
        : Promise.resolve(new Map<string, NormalizedQuoteResult>()),
    ]);

    return defs.map((def) => {
      if (def.id === 'NIFTY50') return quoteToIndexRecord(def, niftyQuote);
      if (def.id === 'SENSEX') return quoteToIndexRecord(def, sensexQuote);
      return quoteToIndexRecord(def, usQuotes.get(def.providerSymbol.toUpperCase()));
    });
  },

  async getIndexHistory(
    indexId: string,
    range: ChartRange,
    mode: DataMode = 'real'
  ): Promise<{
    index: IndexDefinition;
    bars: OhlcvBar[];
    feedStatus: MarketIndex['feedStatus'];
    stale: boolean;
    provider: MarketIndex['provider'];
    providerTimestamp: string | null;
    unavailableReason?: string;
  }> {
    const def =
      INDEX_DEFINITIONS.find((i) => i.id === indexId) ?? INDEX_DEFINITIONS[0];

    if (mode === 'demo') {
      return {
        index: def,
        bars: getDemoBars(def.id, range),
        feedStatus: 'Demo',
        stale: false,
        provider: 'Demo Fixture',
        providerTimestamp: getDemoTimestampIso(),
      };
    }

    const cfg = getProviderConfig().gfdl;

    if (def.provider === 'GFDL') {
      const ex = def.id === 'NIFTY50' ? cfg.niftyExchange : cfg.sensexExchange;
      const sym = def.id === 'NIFTY50' ? cfg.niftySymbol : cfg.sensexSymbol;
      const hist = await gfdlProvider.getHistory(ex, sym, range);
      return {
        index: def,
        provider: 'GFDL',
        ...hist,
      };
    }

    const hist = await twelveDataProvider.getHistory(def.providerSymbol, range);
    return {
      index: def,
      provider: 'Twelve Data',
      ...hist,
    };
  },

  async listStocks(filters: {
    market?: 'All' | MarketRegion;
    q?: string;
    exchange?: string;
    sector?: string;
    priceTier?: string;
    performance?: string;
    sortBy?: (typeof ALLOWED_SORT_BY)[number];
    sortDir?: (typeof ALLOWED_SORT_DIR)[number];
    mode?: DataMode;
    symbols?: string[];
  }): Promise<StockRecord[]> {
    const mode = filters.mode ?? 'real';
    let defs =
      !filters.market || filters.market === 'All'
        ? [...TRACKED_EQUITIES]
        : TRACKED_EQUITIES.filter((e) => e.market === filters.market);

    if (filters.exchange && filters.exchange !== 'All') {
      defs = defs.filter((e) => e.exchange === filters.exchange);
    }

    if (filters.sector && filters.sector !== 'All') {
      defs = defs.filter((e) => e.sector === filters.sector);
    }

    if (filters.q && filters.q.trim()) {
      const q = filters.q.trim().toLowerCase().slice(0, 100);
      defs = defs.filter(
        (e) =>
          e.ticker.toLowerCase().includes(q) ||
          e.normalizedSymbol.toLowerCase().includes(q) ||
          e.name.toLowerCase().includes(q) ||
          e.sector.toLowerCase().includes(q) ||
          e.exchange.toLowerCase().includes(q)
      );
    }

    let items: StockRecord[];

    if (mode === 'demo') {
      items = defs.map((def) => getDemoEquityRecord(def));
    } else {
      const nseSymbols = defs
        .filter((e) => e.provider === 'GFDL' && e.exchange === 'NSE')
        .map((e) => e.providerSymbol);
      const bseSymbols = defs
        .filter((e) => e.provider === 'GFDL' && e.exchange === 'BSE')
        .map((e) => e.providerSymbol);

      const allUsSymbols = defs
        .filter((e) => e.provider === 'Twelve Data')
        .map((e) => e.providerSymbol);

      const tdCfg = getProviderConfig().twelveData;
      let usToPoll = allUsSymbols;
      if (tdCfg.configured && tdCfg.rateLimitRpm <= 8 && allUsSymbols.length > 0) {
        // Respect Twelve Data Basic 8 credits/min limit by prioritizing user's watchlist US symbols (capped at 6)
        const requestedSet = new Set(
          (filters.symbols ?? [])
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        );
        const prioritized =
          requestedSet.size > 0
            ? allUsSymbols.filter((s) => requestedSet.has(s.toUpperCase()))
            : allUsSymbols.filter((s) => ['NVDA', 'AAPL', 'MSFT'].includes(s));
        usToPoll = prioritized.slice(0, Math.max(1, Math.min(6, tdCfg.rateLimitRpm - 1)));
      }

      const [nseQuotes, bseQuotes, usQuotes] = await Promise.all([
        nseSymbols.length > 0
          ? gfdlProvider.getBatchQuotes('NSE', nseSymbols)
          : Promise.resolve(new Map<string, NormalizedQuoteResult>()),
        bseSymbols.length > 0
          ? gfdlProvider.getBatchQuotes('BSE', bseSymbols)
          : Promise.resolve(new Map<string, NormalizedQuoteResult>()),
        usToPoll.length > 0
          ? twelveDataProvider.getBatchQuotes(usToPoll)
          : Promise.resolve(new Map<string, NormalizedQuoteResult>()),
      ]);

      const usPolledSet = new Set(usToPoll.map((s) => s.toUpperCase()));

      items = defs.map((def) => {
        if (def.provider === 'GFDL') {
          const q =
            def.exchange === 'NSE'
              ? nseQuotes.get(def.providerSymbol.toUpperCase())
              : bseQuotes.get(def.providerSymbol.toUpperCase());
          return quoteToStockRecord(def, q);
        }

        const upperSym = def.providerSymbol.toUpperCase();
        if (tdCfg.configured && !usPolledSet.has(upperSym)) {
          return quoteToStockRecord(def, {
            price: Number.NaN,
            previousClose: null,
            change: null,
            changePercent: null,
            open: null,
            high: null,
            low: null,
            volume: null,
            providerTimestamp: null,
            fetchedAt: new Date().toISOString(),
            feedStatus: 'Unavailable',
            stale: false,
            unavailableReason:
              'Excluded from batch fetch to protect Twelve Data Basic 8 credits/min limit. Pin to watchlist or open stock detail.',
          });
        }

        return quoteToStockRecord(def, usQuotes.get(upperSym));
      });
    }

    if (filters.priceTier === 'under500') {
      items = items.filter((s) => s.price !== null && s.price < 500);
    } else if (filters.priceTier === '500to2000') {
      items = items.filter((s) => s.price !== null && s.price >= 500 && s.price <= 2000);
    } else if (filters.priceTier === 'over2000') {
      items = items.filter((s) => s.price !== null && s.price > 2000);
    }

    if (filters.performance === 'Gainers') {
      items = items.filter((s) => s.changePercent !== null && s.changePercent > 0);
    } else if (filters.performance === 'Losers') {
      items = items.filter((s) => s.changePercent !== null && s.changePercent < 0);
    }

    if (filters.sortBy) {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      const key = filters.sortBy;
      items.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (typeof av === 'string' && typeof bv === 'string') {
          return av.localeCompare(bv) * dir;
        }
        const an = typeof av === 'number' ? av : null;
        const bn = typeof bv === 'number' ? bv : null;
        if (an === null && bn === null) return a.ticker.localeCompare(b.ticker);
        if (an === null) return 1;
        if (bn === null) return -1;
        return (an - bn) * dir;
      });
    }

    return items;
  },

  async getOverview(params: {
    market: 'All' | MarketRegion;
    indexId?: string;
    range: ChartRange;
    mode?: DataMode;
    symbols?: string[];
  }): Promise<Omit<MarketOverviewResponse, 'meta'>> {
    const mode = params.mode ?? 'real';
    const [indices, stocks] = await Promise.all([
      this.getIndices(params.market, mode),
      this.listStocks({
        market: params.market,
        mode,
        symbols: params.symbols,
      }),
    ]);

    const matched = params.indexId
      ? indices.find((i) => i.id === params.indexId)
      : undefined;
    const selectedIndex = matched ?? indices[0];
    const indexHist = await this.getIndexHistory(
      selectedIndex.id,
      params.range,
      mode
    );

    const priced = stocks.filter(
      (s) => s.price !== null && s.changePercent !== null
    );
    const gainers = [...priced]
      .filter((s) => (s.changePercent ?? 0) > 0)
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
      .slice(0, 4);
    const losers = [...priced]
      .filter((s) => (s.changePercent ?? 0) < 0)
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
      .slice(0, 4);
    const mostActive = [...stocks]
      .filter((s) => s.volume !== null && s.volume > 0)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 4);

    return {
      dataMode: mode,
      indices,
      selectedIndex,
      indexHistory: indexHist.bars,
      historyStatus: {
        feedStatus: indexHist.feedStatus,
        stale: indexHist.stale,
        provider: indexHist.provider,
        providerTimestamp: indexHist.providerTimestamp,
        unavailableReason: indexHist.unavailableReason,
      },
      range: params.range,
      movers: {
        gainers,
        losers,
        mostActive,
        trackedUniverseSize: stocks.length,
        pricedCount: priced.length,
      },
      sectors: this.getSectors(),
    };
  },

  async resolveEquityDefinition(
    rawSymbol: string,
    mode: DataMode = 'real'
  ): Promise<EquityDefinition | null> {
    const tracked = findTrackedEquity(rawSymbol);
    if (tracked) return tracked;
    if (mode === 'demo') return null;

    const { exchangePrefix, ticker } = parseSymbolInput(rawSymbol);

    if (exchangePrefix === 'NSE' || exchangePrefix === 'BSE') {
      if (!gfdlProvider.isConfigured()) return null;
      const probe = await gfdlProvider.getSingleQuote(exchangePrefix, ticker);
      if (!Number.isFinite(probe.price)) return null;
      return {
        ticker,
        normalizedSymbol: `${exchangePrefix}:${ticker}`,
        name: ticker,
        market: 'India',
        exchange: exchangePrefix,
        currency: 'INR',
        sector: 'Indian Equity',
        provider: 'GFDL',
        providerSymbol: ticker,
      };
    }

    if (twelveDataProvider.isConfigured()) {
      const lookup = await twelveDataProvider.lookupEquity(ticker);
      if (lookup) {
        return {
          ticker: lookup.ticker,
          normalizedSymbol: `${lookup.exchange}:${lookup.ticker}`,
          name: lookup.name,
          market: 'US',
          exchange: lookup.exchange,
          currency: 'USD',
          sector: 'US Equity',
          provider: 'Twelve Data',
          providerSymbol: lookup.ticker,
        };
      }
    }

    return null;
  },

  async getStockDetail(
    rawSymbol: string,
    mode: DataMode = 'real'
  ): Promise<Omit<StockDetailResponse, 'meta'> | null> {
    const def = await this.resolveEquityDefinition(rawSymbol, mode);
    if (!def) return null;

    if (mode === 'demo') {
      const record = getDemoEquityRecord(def);
      const { profile, fundamentals } = getDemoEquityDetailMeta(def);
      record.profile = profile;
      record.fundamentals = fundamentals;
      const news = await newsProvider.listNews({ ticker: def.ticker }, 'demo');
      return {
        dataMode: 'demo',
        stock: record,
        relatedNews: {
          connected: news.connected,
          isDemo: true,
          articles: news.articles,
          message: news.message,
        },
      };
    }

    if (def.provider === 'GFDL') {
      const [quote, news] = await Promise.all([
        gfdlProvider.getSingleQuote(
          def.exchange,
          def.providerSymbol,
          def.alternateGfdlSymbols ?? []
        ),
        newsProvider.listNews({ ticker: def.ticker }, 'real'),
      ]);

      const record = quoteToStockRecord(def, quote);
      record.profile = {
        provider: 'GFDL',
        unavailableReason:
          'Company biography and officer metadata require a fundamentals/reference plan add-on.',
      };
      record.fundamentals = gfdlProvider.getFundamentalsUnavailableReason();

      return {
        dataMode: 'real',
        stock: record,
        relatedNews: {
          connected: news.connected,
          isDemo: false,
          articles: news.articles,
          message: news.message,
        },
      };
    }

    const [quote, metaDetails, news] = await Promise.all([
      twelveDataProvider.getSingleQuote(def.providerSymbol),
      twelveDataProvider.getFundamentalsAndProfile(def.providerSymbol),
      newsProvider.listNews({ ticker: def.ticker }, 'real'),
    ]);

    const record = quoteToStockRecord(def, quote);
    record.profile = metaDetails.profile;
    record.fundamentals = metaDetails.fundamentals;
    record.marketCap = metaDetails.fundamentals.marketCap ?? null;
    if (metaDetails.profile.sector) {
      record.sector = metaDetails.profile.sector;
    }

    return {
      dataMode: 'real',
      stock: record,
      relatedNews: {
        connected: news.connected,
        isDemo: false,
        articles: news.articles,
        message: news.message,
      },
    };
  },

  async getStockHistory(
    rawSymbol: string,
    range: ChartRange,
    mode: DataMode = 'real'
  ): Promise<Omit<StockHistoryResponse, 'meta'> | null> {
    const def = await this.resolveEquityDefinition(rawSymbol, mode);
    if (!def) return null;

    if (mode === 'demo') {
      const bars = getDemoBars(def.ticker, range);
      return {
        dataMode: 'demo',
        symbol: def.ticker,
        normalizedSymbol: def.normalizedSymbol,
        currency: def.currency,
        exchange: def.exchange,
        provider: 'Demo Fixture',
        feedStatus: 'Demo',
        stale: false,
        providerTimestamp: getDemoTimestampIso(),
        range,
        count: bars.length,
        bars,
      };
    }

    const hist =
      def.provider === 'GFDL'
        ? await gfdlProvider.getHistory(def.exchange, def.providerSymbol, range)
        : await twelveDataProvider.getHistory(def.providerSymbol, range);

    return {
      dataMode: 'real',
      symbol: def.ticker,
      normalizedSymbol: def.normalizedSymbol,
      currency: def.currency,
      exchange: def.exchange,
      provider: def.provider,
      feedStatus: hist.feedStatus,
      stale: hist.stale,
      providerTimestamp: hist.providerTimestamp,
      unavailableReason: hist.unavailableReason,
      range,
      count: hist.bars.length,
      bars: hist.bars,
    };
  },
};

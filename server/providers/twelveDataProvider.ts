import type {
  ChartRange,
  ExchangeCode,
  FeedStatus,
  FxRateInfo,
  OhlcvBar,
  ProviderHealthStatus,
  StockFundamentals,
  StockProfile,
} from '../../src/types/market.ts';
import { getProviderConfig, resolveVerifiedFreshness } from '../config/providers.ts';
import {
  canConsumeCredits,
  consumeCredits,
  dedupeInFlight,
  getFreshCache,
  getStaleCache,
  setCacheValue,
} from '../services/providerCache.ts';
import type {
  NormalizedHistoryResult,
  NormalizedQuoteResult,
} from './gfdlProvider.ts';

let lastSuccessAt: string | null = null;
let lastVerifiedFreshness: FeedStatus = 'Unavailable';
let lastError: string | null = null;

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseTwelveDatetimeToUnix(
  rawDatetime: unknown,
  rawTimestamp?: unknown
): { unixSec: number | null; iso: string | null } {
  const tsNum = toFiniteNumber(rawTimestamp);
  if (tsNum !== null && tsNum > 0) {
    const sec = tsNum > 1e12 ? Math.floor(tsNum / 1000) : Math.floor(tsNum);
    return { unixSec: sec, iso: new Date(sec * 1000).toISOString() };
  }
  if (typeof rawDatetime === 'string' && rawDatetime.trim()) {
    const clean = rawDatetime.trim();
    const isoCandidate = clean.includes(' ')
      ? `${clean.replace(' ', 'T')}Z`
      : clean.length === 10
      ? `${clean}T00:00:00Z`
      : clean;
    const ms = Date.parse(isoCandidate);
    if (!Number.isNaN(ms)) {
      return { unixSec: Math.floor(ms / 1000), iso: new Date(ms).toISOString() };
    }
  }
  return { unixSec: null, iso: null };
}

function classifyPlanOrError(message: string, code?: number): string {
  const lower = message.toLowerCase();
  if (
    code === 403 ||
    lower.includes('grow') ||
    lower.includes('pro') ||
    lower.includes('ultra') ||
    lower.includes('plan') ||
    lower.includes('available starting')
  ) {
    return `Twelve Data plan restriction: ${message}`;
  }
  if (code === 429 || lower.includes('credits') || lower.includes('limit')) {
    return `Twelve Data rate limit reached: ${message}`;
  }
  return message;
}

function parseQuoteItem(
  item: Record<string, unknown>,
  tierHint: FeedStatus
): NormalizedQuoteResult | { error: string; code?: number } {
  if (item.status === 'error') {
    const msg = String(item.message ?? 'Twelve Data returned an error.');
    const code = toFiniteNumber(item.code) ?? undefined;
    return { error: classifyPlanOrError(msg, code), code };
  }

  const price = toFiniteNumber(item.close ?? item.price);
  if (price === null) {
    return { error: 'Twelve Data response did not include a close price.' };
  }

  const previousClose = toFiniteNumber(item.previous_close);
  const open = toFiniteNumber(item.open);
  const high = toFiniteNumber(item.high);
  const low = toFiniteNumber(item.low);
  const volume = toFiniteNumber(item.volume);
  let change = toFiniteNumber(item.change);
  let changePercent = toFiniteNumber(item.percent_change);

  if (change === null && previousClose !== null) {
    change = Number((price - previousClose).toFixed(2));
  }
  if (changePercent === null && change !== null && previousClose && previousClose > 0) {
    changePercent = Number(((change / previousClose) * 100).toFixed(2));
  }

  const parsedTime = parseTwelveDatetimeToUnix(item.datetime, item.timestamp);
  const explicitOpen =
    typeof item.is_market_open === 'boolean' ? item.is_market_open : null;
  const verifiedStatus = resolveVerifiedFreshness({
    providerTimestampIso: parsedTime.iso,
    streamingActive: false,
    explicitMarketOpen: explicitOpen,
    tierHint,
  });
  lastVerifiedFreshness = verifiedStatus;

  return {
    price,
    previousClose,
    change,
    changePercent,
    open,
    high,
    low,
    volume,
    providerTimestamp: parsedTime.iso,
    fetchedAt: new Date().toISOString(),
    feedStatus: verifiedStatus,
    stale: false,
  };
}

async function tdFetchJson(
  endpoint: string,
  params: Record<string, string | number>,
  creditCost: number
): Promise<{ ok: boolean; data?: unknown; error?: string; code?: number }> {
  const cfg = getProviderConfig().twelveData;
  if (!cfg.configured) {
    return {
      ok: false,
      error: 'Twelve Data API key (TWELVE_DATA_API_KEY) is not configured.',
    };
  }

  if (!canConsumeCredits('twelvedata', creditCost, cfg.rateLimitRpm)) {
    return {
      ok: false,
      code: 429,
      error: `Twelve Data rate limit budget (${cfg.rateLimitRpm} credits/min) reached.`,
    };
  }
  consumeCredits('twelvedata', creditCost, cfg.rateLimitRpm);

  const url = new URL(`${cfg.baseUrl}/${endpoint.replace(/^\/+/, '')}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `apikey ${cfg.apiKey}`,
      },
      signal: controller.signal,
    });

    const payload = (await res.json()) as Record<string, unknown>;
    if (!res.ok || payload?.status === 'error') {
      const code = toFiniteNumber(payload?.code) ?? res.status;
      const msg = classifyPlanOrError(
        String(payload?.message ?? `Twelve Data HTTP ${res.status}`),
        code
      );
      lastError = msg;
      return { ok: false, data: payload, error: msg, code };
    }

    lastSuccessAt = new Date().toISOString();
    lastError = null;
    return { ok: true, data: payload };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'Twelve Data request timed out.'
        : 'Unable to reach Twelve Data API.';
    lastError = msg;
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export const twelveDataProvider = {
  isConfigured(): boolean {
    return getProviderConfig().twelveData.configured;
  },

  getHealth(): ProviderHealthStatus {
    const cfg = getProviderConfig().twelveData;
    const configured = cfg.configured;
    const verifiedConnected = configured && lastSuccessAt !== null;
    const verifiedStatus: FeedStatus = !configured
      ? 'Unavailable'
      : verifiedConnected
      ? lastVerifiedFreshness
      : 'Unavailable';
    // Standard Basic plan caches 90s to stay safely within 8 credits/min; paid tiers poll faster
    const recommendedPollMs = cfg.rateLimitRpm >= 55 ? 25_000 : 90_000;
    return {
      id: 'twelveData',
      name: 'Twelve Data',
      configured,
      connected: verifiedConnected,
      feedStatus: verifiedStatus,
      streaming: false,
      recommendedPollMs,
      missingSettings: configured ? [] : ['TWELVE_DATA_API_KEY'],
      notes: !configured
        ? 'US market feed not connected'
        : verifiedConnected
        ? `Rate budget: ${cfg.rateLimitRpm} credits/min · Verified freshness: ${verifiedStatus}`
        : `Configured (${cfg.rateLimitRpm} credits/min); awaiting verified quote coverage.`,
      lastSuccessAt,
      lastError: configured ? lastError : null,
    };
  },

  async getBatchQuotes(
    symbols: string[]
  ): Promise<Map<string, NormalizedQuoteResult>> {
    const out = new Map<string, NormalizedQuoteResult>();
    if (symbols.length === 0) return out;
    const cfg = getProviderConfig().twelveData;
    const quoteTtlMs = cfg.rateLimitRpm >= 55 ? 20_000 : 90_000;

    if (!cfg.configured) {
      for (const s of symbols) {
        out.set(s.toUpperCase(), {
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
          unavailableReason: 'TWELVE_DATA_API_KEY is not configured.',
        });
      }
      return out;
    }

    const toFetch: string[] = [];
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const fresh = getFreshCache<NormalizedQuoteResult>(`td:quote:${upper}`);
      if (fresh) {
        out.set(upper, fresh);
      } else {
        toFetch.push(upper);
      }
    }

    if (toFetch.length === 0) return out;

    // Fit batches inside the configured RPM cap
    const maxBatchSize = Math.max(1, Math.min(10, cfg.rateLimitRpm));
    const batches: string[][] = [];
    for (let i = 0; i < toFetch.length; i += maxBatchSize) {
      batches.push(toFetch.slice(i, i + maxBatchSize));
    }

    for (const batch of batches) {
      const batchKey = `td:batch:${batch.join(',')}`;
      await dedupeInFlight(batchKey, async () => {
        const res = await tdFetchJson(
          'quote',
          { symbol: batch.join(',') },
          batch.length
        );

        if (res.data && typeof res.data === 'object') {
          const obj = res.data as Record<string, unknown>;
          if (batch.length === 1) {
            const sym = batch[0];
            const parsed = parseQuoteItem(obj, cfg.feedTierHint);
            if ('error' in parsed) {
              const stale = getStaleCache<NormalizedQuoteResult>(`td:quote:${sym}`);
              if (stale && Number.isFinite(stale.price)) {
                out.set(sym, { ...stale, stale: true, unavailableReason: parsed.error });
              } else {
                const unavail: NormalizedQuoteResult = {
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
                  unavailableReason: parsed.error,
                };
                if (parsed.code === 403 || parsed.error.includes('plan restriction')) {
                  setCacheValue(`td:quote:${sym}`, unavail, 300_000);
                }
                out.set(sym, unavail);
              }
            } else {
              setCacheValue(`td:quote:${sym}`, parsed, quoteTtlMs);
              out.set(sym, parsed);
            }
          } else {
            for (const sym of batch) {
              const rawItem = obj[sym];
              if (rawItem && typeof rawItem === 'object') {
                const parsed = parseQuoteItem(
                  rawItem as Record<string, unknown>,
                  cfg.feedTierHint
                );
                if ('error' in parsed) {
                  const stale = getStaleCache<NormalizedQuoteResult>(`td:quote:${sym}`);
                  if (stale && Number.isFinite(stale.price)) {
                    out.set(sym, {
                      ...stale,
                      stale: true,
                      unavailableReason: parsed.error,
                    });
                  } else {
                    const unavail: NormalizedQuoteResult = {
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
                      unavailableReason: parsed.error,
                    };
                    if (parsed.code === 403 || parsed.error.includes('plan restriction')) {
                      setCacheValue(`td:quote:${sym}`, unavail, 300_000);
                    }
                    out.set(sym, unavail);
                  }
                } else {
                  setCacheValue(`td:quote:${sym}`, parsed, quoteTtlMs);
                  out.set(sym, parsed);
                }
              }
            }
          }
        }

        // Fill any remaining symbols in batch on HTTP/rate failure
        for (const sym of batch) {
          if (out.has(sym)) continue;
          const stale = getStaleCache<NormalizedQuoteResult>(`td:quote:${sym}`);
          if (stale && Number.isFinite(stale.price)) {
            out.set(sym, {
              ...stale,
              stale: true,
              unavailableReason: res.error ?? 'Serving last known cached quote.',
            });
          } else {
            out.set(sym, {
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
                res.error ?? `Unable to load quote for ${sym} from Twelve Data.`,
            });
          }
        }
      });
    }

    return out;
  },

  async getSingleQuote(symbol: string): Promise<NormalizedQuoteResult> {
    const upper = symbol.toUpperCase();
    const map = await this.getBatchQuotes([upper]);
    return (
      map.get(upper) ?? {
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
        unavailableReason: `Quote unavailable for ${upper}.`,
      }
    );
  },

  async getHistory(
    symbol: string,
    range: ChartRange
  ): Promise<NormalizedHistoryResult> {
    const cfg = getProviderConfig().twelveData;
    const upper = symbol.toUpperCase();
    const cacheKey = `td:hist:${upper}:${range}`;

    const fresh = getFreshCache<NormalizedHistoryResult>(cacheKey);
    if (fresh) return fresh;

    if (!cfg.configured) {
      return {
        bars: [],
        feedStatus: 'Unavailable',
        stale: false,
        providerTimestamp: null,
        unavailableReason: 'TWELVE_DATA_API_KEY is not configured.',
      };
    }

    return dedupeInFlight(cacheKey, async () => {
      let interval = '1day';
      let outputsize = 22;

      switch (range) {
        case '1D':
          interval = '5min';
          outputsize = 78;
          break;
        case '1W':
          interval = '30min';
          outputsize = 70;
          break;
        case '1M':
          interval = '1day';
          outputsize = 22;
          break;
        case '3M':
          interval = '1day';
          outputsize = 66;
          break;
        case '6M':
          interval = '1day';
          outputsize = 132;
          break;
        case '1Y':
          interval = '1day';
          outputsize = 252;
          break;
        case '5Y':
          interval = '1week';
          outputsize = 260;
          break;
        case 'MAX':
          interval = '1month';
          outputsize = 180;
          break;
      }

      const res = await tdFetchJson(
        'time_series',
        {
          symbol: upper,
          interval,
          outputsize,
          order: 'ASC',
        },
        1
      );

      if (res.ok && res.data && typeof res.data === 'object') {
        const values = (res.data as Record<string, unknown>).values;
        if (Array.isArray(values) && values.length > 0) {
          const intraday = range === '1D' || range === '1W';
          const byTs = new Map<number, OhlcvBar>();
          for (const raw of values) {
            if (!raw || typeof raw !== 'object') continue;
            const row = raw as Record<string, unknown>;
            const dtStr = typeof row.datetime === 'string' ? row.datetime.trim() : '';
            const parsedTime = parseTwelveDatetimeToUnix(dtStr);
            const open = toFiniteNumber(row.open);
            const high = toFiniteNumber(row.high);
            const low = toFiniteNumber(row.low);
            const close = toFiniteNumber(row.close);
            const volume = toFiniteNumber(row.volume) ?? 0;

            if (
              parsedTime.unixSec !== null &&
              open !== null &&
              high !== null &&
              low !== null &&
              close !== null
            ) {
              const displayTime = intraday
                ? dtStr.slice(0, 16).replace(' ', 'T')
                : dtStr.slice(0, 10);
              byTs.set(parsedTime.unixSec, {
                time: displayTime,
                timestamp: parsedTime.unixSec,
                open,
                high,
                low,
                close,
                volume,
              });
            }
          }

          const bars = Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
          if (bars.length > 0) {
            const latestIso = new Date(
              bars[bars.length - 1].timestamp * 1000
            ).toISOString();
            const histFreshness = resolveVerifiedFreshness({
              providerTimestampIso: latestIso,
              streamingActive: false,
              tierHint: intraday ? cfg.feedTierHint : 'End of day',
            });
            lastVerifiedFreshness = histFreshness;
            const result: NormalizedHistoryResult = {
              bars,
              feedStatus: histFreshness,
              stale: false,
              providerTimestamp: latestIso,
            };
            const ttl = intraday ? 60_000 : 300_000;
            setCacheValue(cacheKey, result, ttl);
            return result;
          }
        }
      }

      const stale = getStaleCache<NormalizedHistoryResult>(cacheKey);
      if (stale && stale.bars.length > 0) {
        return {
          ...stale,
          stale: true,
          unavailableReason: res.error ?? 'Serving cached bars during provider outage.',
        };
      }

      const emptyRes: NormalizedHistoryResult = {
        bars: [],
        feedStatus: 'Unavailable',
        stale: false,
        providerTimestamp: null,
        unavailableReason:
          res.error ?? `No historical candles returned by Twelve Data for ${upper}.`,
      };
      if (res.code === 403 || (res.error && res.error.includes('plan restriction'))) {
        setCacheValue(cacheKey, emptyRes, 300_000);
      }
      return emptyRes;
    });
  },

  async getFundamentalsAndProfile(
    symbol: string
  ): Promise<{ profile: StockProfile; fundamentals: StockFundamentals }> {
    const cfg = getProviderConfig().twelveData;
    const upper = symbol.toUpperCase();
    const cacheKey = `td:meta:${upper}`;

    const fresh = getFreshCache<{
      profile: StockProfile;
      fundamentals: StockFundamentals;
    }>(cacheKey);
    if (fresh) return fresh;

    if (!cfg.configured) {
      return {
        profile: { unavailableReason: 'TWELVE_DATA_API_KEY not configured.' },
        fundamentals: { unavailableReason: 'TWELVE_DATA_API_KEY not configured.' },
      };
    }

    return dedupeInFlight(cacheKey, async () => {
      const quoteKey = getFreshCache<Record<string, unknown>>(`td:rawquote:${upper}`);
      void quoteKey;

      const [profileRes, statsRes, quoteRes] = await Promise.all([
        tdFetchJson('profile', { symbol: upper }, 1),
        tdFetchJson('statistics', { symbol: upper }, 2),
        tdFetchJson('quote', { symbol: upper }, 1),
      ]);

      const pObj =
        profileRes.ok && profileRes.data && typeof profileRes.data === 'object'
          ? (profileRes.data as Record<string, unknown>)
          : null;

      const qObj =
        quoteRes.ok && quoteRes.data && typeof quoteRes.data === 'object'
          ? (quoteRes.data as Record<string, unknown>)
          : null;

      const sRoot =
        statsRes.ok && statsRes.data && typeof statsRes.data === 'object'
          ? ((statsRes.data as Record<string, unknown>).statistics as
              | Record<string, unknown>
              | undefined) ?? (statsRes.data as Record<string, unknown>)
          : null;

      const valuations =
        (sRoot?.valuations_metrics as Record<string, unknown> | undefined) ?? {};
      const financials =
        (sRoot?.financials as Record<string, unknown> | undefined) ?? {};
      const stockStats =
        (sRoot?.stock_statistics as Record<string, unknown> | undefined) ?? {};
      const dividends =
        (sRoot?.dividends_and_splits as Record<string, unknown> | undefined) ?? {};
      const income =
        (financials.income_statement as Record<string, unknown> | undefined) ?? {};
      const balanceSheet =
        (financials.balance_sheet as Record<string, unknown> | undefined) ?? {};
      const fiftyTwoWeek =
        (qObj?.fifty_two_week as Record<string, unknown> | undefined) ??
        (sRoot?.stock_price_summary as Record<string, unknown> | undefined) ??
        {};

      const hqParts = [pObj?.city, pObj?.state, pObj?.country]
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '');

      const profile: StockProfile = pObj
        ? {
            description: typeof pObj.description === 'string' ? pObj.description : null,
            headquarters: hqParts.length > 0 ? hqParts.join(', ') : null,
            ceo: typeof pObj.CEO === 'string' ? pObj.CEO : null,
            employees:
              pObj.employees !== undefined && pObj.employees !== null
                ? String(pObj.employees)
                : null,
            sector: typeof pObj.sector === 'string' ? pObj.sector : null,
            industry: typeof pObj.industry === 'string' ? pObj.industry : null,
            website: typeof pObj.website === 'string' ? pObj.website : null,
            asOfDate:
              typeof qObj?.datetime === 'string'
                ? qObj.datetime
                : new Date().toISOString().slice(0, 10),
            provider: 'Twelve Data',
          }
        : {
            provider: 'Twelve Data',
            unavailableReason:
              profileRes.error ?? 'Company profile unavailable on current plan.',
          };

      const reportingDate =
        (typeof financials.most_recent_quarter === 'string' &&
          financials.most_recent_quarter) ||
        (typeof financials.fiscal_year_ends === 'string' &&
          financials.fiscal_year_ends) ||
        (typeof qObj?.datetime === 'string' ? qObj.datetime : null);

      const fundamentals: StockFundamentals = {
        marketCap: toFiniteNumber(valuations.market_capitalization),
        peRatio: toFiniteNumber(valuations.trailing_pe ?? valuations.pe_ratio),
        pbRatio: toFiniteNumber(valuations.price_to_book_mrq),
        dividendYield:
          toFiniteNumber(dividends.trailing_annual_dividend_yield) !== null
            ? Number(
                (
                  (toFiniteNumber(dividends.trailing_annual_dividend_yield) ?? 0) * 100
                ).toFixed(2)
              )
            : null,
        roe:
          toFiniteNumber(financials.return_on_equity_ttm) !== null
            ? Number(
                ((toFiniteNumber(financials.return_on_equity_ttm) ?? 0) * 100).toFixed(2)
              )
            : null,
        eps: toFiniteNumber(income.diluted_eps_ttm),
        debtToEquity: toFiniteNumber(balanceSheet.total_debt_to_equity_mrq),
        high52W: toFiniteNumber(fiftyTwoWeek.high ?? fiftyTwoWeek['52_week_high']),
        low52W: toFiniteNumber(fiftyTwoWeek.low ?? fiftyTwoWeek['52_week_low']),
        avgVolume: toFiniteNumber(
          qObj?.average_volume ?? stockStats.avg_10_volume ?? stockStats.avg_90_volume
        ),
        beta: toFiniteNumber((sRoot?.stock_price_summary as Record<string, unknown> | undefined)?.beta),
        reportingDate,
        provider: 'Twelve Data',
        unavailableReason: !sRoot
          ? statsRes.error ?? 'Valuation statistics require Grow/Pro Twelve Data plan.'
          : undefined,
      };

      const out = { profile, fundamentals };
      setCacheValue(cacheKey, out, 3_600_000); // Cache 1h to protect credits
      return out;
    });
  },

  async lookupEquity(symbol: string): Promise<{
    ticker: string;
    name: string;
    exchange: ExchangeCode;
    currency: 'USD';
  } | null> {
    const cfg = getProviderConfig().twelveData;
    if (!cfg.configured) return null;
    const upper = symbol.trim().toUpperCase();
    const res = await tdFetchJson('quote', { symbol: upper }, 1);
    if (!res.ok || !res.data || typeof res.data !== 'object') return null;
    const obj = res.data as Record<string, unknown>;
    if (obj.status === 'error' || !obj.symbol) return null;
    const rawEx = String(obj.exchange ?? 'NASDAQ').toUpperCase();
    const exchange: ExchangeCode = rawEx.includes('NYSE') ? 'NYSE' : 'NASDAQ';
    return {
      ticker: String(obj.symbol).toUpperCase(),
      name: String(obj.name ?? obj.symbol),
      exchange,
      currency: 'USD',
    };
  },

  async getUsdToInrRate(): Promise<FxRateInfo> {
    const cfg = getProviderConfig().twelveData;
    if (!cfg.configured) {
      return {
        pair: 'USD/INR',
        rate: null,
        timestamp: null,
        provider: null,
        unavailableReason: 'TWELVE_DATA_API_KEY not configured for live FX conversion.',
      };
    }

    const cacheKey = 'td:fx:USD_INR';
    const fresh = getFreshCache<FxRateInfo>(cacheKey);
    if (fresh) return fresh;

    return dedupeInFlight(cacheKey, async () => {
      const res = await tdFetchJson('exchange_rate', { symbol: 'USD/INR' }, 1);
      if (res.ok && res.data && typeof res.data === 'object') {
        const obj = res.data as Record<string, unknown>;
        const rate = toFiniteNumber(obj.rate);
        if (rate !== null && rate > 0) {
          const tsSec = toFiniteNumber(obj.timestamp);
          const info: FxRateInfo = {
            pair: 'USD/INR',
            rate,
            timestamp: tsSec ? new Date(tsSec * 1000).toISOString() : new Date().toISOString(),
            provider: 'Twelve Data',
          };
          setCacheValue(cacheKey, info, 900_000); // 15 min cache
          return info;
        }
      }
      const stale = getStaleCache<FxRateInfo>(cacheKey);
      if (stale && stale.rate) return stale;
      return {
        pair: 'USD/INR',
        rate: null,
        timestamp: null,
        provider: 'Twelve Data',
        unavailableReason: res.error ?? 'FX conversion rate unavailable.',
      };
    });
  },
};

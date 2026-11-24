import { EventEmitter } from 'node:events';
import type {
  ChartRange,
  FeedStatus,
  OhlcvBar,
  ProviderHealthStatus,
  StockFundamentals,
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

export interface NormalizedQuoteResult {
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  providerTimestamp: string | null;
  fetchedAt: string;
  feedStatus: FeedStatus;
  stale: boolean;
  unavailableReason?: string;
}

export interface NormalizedHistoryResult {
  bars: OhlcvBar[];
  feedStatus: FeedStatus;
  stale: boolean;
  providerTimestamp: string | null;
  unavailableReason?: string;
}

export const gfdlStreamBus = new EventEmitter();

let lastSuccessAt: string | null = null;
let lastVerifiedFreshness: FeedStatus = 'Unavailable';
let lastError: string | null = null;
let wsConnected = false;
let wsInstance: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function epochToUnixSec(val: unknown): number | null {
  const n = toFiniteNumber(val);
  if (n !== null && n > 0) {
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return null;
}

function unixSecToIso(sec: number | null): string | null {
  if (!sec || !Number.isFinite(sec)) return null;
  return new Date(sec * 1000).toISOString();
}

function formatBarTime(unixSec: number, intraday: boolean): string {
  // Format in IST (UTC+05:30) for Indian market session alignment
  const istMs = (unixSec + 5.5 * 3600) * 1000;
  const d = new Date(istMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  if (!intraday) return `${y}-${m}-${day}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function pickField(obj: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(obj);
  for (const cand of candidates) {
    if (obj[cand] !== undefined) return obj[cand];
    const lower = cand.toLowerCase();
    const matched = keys.find((k) => k.toLowerCase() === lower);
    if (matched && obj[matched] !== undefined) return obj[matched];
  }
  return undefined;
}

function parseGfdlQuoteObject(
  raw: Record<string, unknown>,
  tierHint: FeedStatus,
  fromStream: boolean
): { symbol: string; quote: NormalizedQuoteResult } | null {
  const symbolRaw = pickField(raw, [
    'InstrumentIdentifier',
    'INSTRUMENTIDENTIFIER',
    'Symbol',
  ]);
  const symbol = typeof symbolRaw === 'string' ? symbolRaw.trim().toUpperCase() : '';
  const price = toFiniteNumber(
    pickField(raw, ['LastTradePrice', 'CLOSE', 'Close', 'LTP'])
  );
  if (!symbol || price === null) return null;

  const prevClose = toFiniteNumber(
    pickField(raw, ['Close', 'PreviousClose', 'PREVCLOSE'])
  );
  const open = toFiniteNumber(pickField(raw, ['Open', 'OPEN']));
  const high = toFiniteNumber(pickField(raw, ['High', 'HIGH']));
  const low = toFiniteNumber(pickField(raw, ['Low', 'LOW']));
  const volume = toFiniteNumber(
    pickField(raw, ['TotalQtyTraded', 'TradedQty', 'TRADEDQTY', 'Volume'])
  );
  let change = toFiniteNumber(pickField(raw, ['PriceChange', 'NetChange']));
  let changePercent = toFiniteNumber(
    pickField(raw, ['PriceChangePercentage', 'PercentChange'])
  );

  if (change === null && prevClose !== null && prevClose > 0) {
    change = Number((price - prevClose).toFixed(2));
  }
  if (changePercent === null && change !== null && prevClose !== null && prevClose > 0) {
    changePercent = Number(((change / prevClose) * 100).toFixed(2));
  }

  const tsSec =
    epochToUnixSec(pickField(raw, ['LastTradeTime', 'LASTTRADETIME'])) ??
    epochToUnixSec(pickField(raw, ['ServerTime', 'SERVERTIME']));
  const providerTimestamp = unixSecToIso(tsSec);
  const verifiedFreshness = resolveVerifiedFreshness({
    providerTimestampIso: providerTimestamp,
    streamingActive: fromStream || wsConnected,
    tierHint,
  });
  lastVerifiedFreshness = verifiedFreshness;

  return {
    symbol,
    quote: {
      price,
      previousClose: prevClose,
      change,
      changePercent,
      open,
      high,
      low,
      volume,
      providerTimestamp,
      fetchedAt: new Date().toISOString(),
      feedStatus: verifiedFreshness,
      stale: false,
    },
  };
}

function getMissingSettings(): string[] {
  const cfg = getProviderConfig().gfdl;
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push('GFDL_API_KEY');
  if (!cfg.restUrl) {
    missing.push(
      cfg.restUrlError ? `GFDL_REST_URL (${cfg.restUrlError})` : 'GFDL_REST_URL'
    );
  }
  if (cfg.streamingEnabled && !cfg.wsUrl) {
    missing.push(
      cfg.wsUrlError ? `GFDL_WS_URL (${cfg.wsUrlError})` : 'GFDL_WS_URL'
    );
  }
  return missing;
}

async function gfdlFetchJson(
  pathSegment: string,
  params: Record<string, string | number | boolean>
): Promise<{ ok: boolean; data?: unknown; error?: string; status?: number }> {
  const cfg = getProviderConfig().gfdl;
  if (!cfg.configured || !cfg.restUrl) {
    return {
      ok: false,
      error: 'Indian market feed not connected',
    };
  }

  // Respect gentle server-side burst cap (max 45 requests/min for GFDL REST)
  if (!canConsumeCredits('gfdl', 1, 45)) {
    return {
      ok: false,
      status: 429,
      error: 'GFDL REST request budget throttled to protect rate limits.',
    };
  }
  consumeCredits('gfdl', 1, 45);

  const url = new URL(`${cfg.restUrl}/${pathSegment.replace(/^\/+/, '')}/`);
  url.searchParams.set('accessKey', cfg.apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    if (!res.ok) {
      const msg = `GFDL HTTP ${res.status}${typeof parsed === 'object' && parsed && 'Message' in parsed ? `: ${String((parsed as Record<string, unknown>).Message)}` : ''}`;
      lastError = msg;
      return { ok: false, status: res.status, error: msg };
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as Record<string, unknown>).Message === 'string' &&
      !(parsed as Record<string, unknown>).LastTradePrice &&
      !(parsed as Record<string, unknown>).Data
    ) {
      const msg = String((parsed as Record<string, unknown>).Message);
      lastError = msg;
      return { ok: false, error: msg };
    }

    lastSuccessAt = new Date().toISOString();
    lastError = null;
    return { ok: true, data: parsed };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'AbortError'
        ? 'GFDL API request timed out.'
        : 'Unable to reach Global Datafeeds endpoint.';
    lastError = msg;
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export function startGfdlWebsocketIfConfigured(symbols: { exchange: string; symbol: string }[]) {
  const cfg = getProviderConfig().gfdl;
  // Require WebSocket URL only if streaming is explicitly enabled
  if (!cfg.configured || !cfg.streamingEnabled || !cfg.wsUrl || wsInstance) return;

  try {
    const ws = new WebSocket(cfg.wsUrl);
    wsInstance = ws;

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          MessageType: 'Authenticate',
          Password: cfg.apiKey,
        })
      );
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        const msgType = String(msg.MessageType ?? '');
        if (msgType === 'AuthenticateResult') {
          if (msg.Complete === true) {
            wsConnected = true;
            lastSuccessAt = new Date().toISOString();
            lastError = null;
            for (const item of symbols) {
              if (!cfg.allowedExchanges.has(item.exchange.toUpperCase())) continue;
              ws.send(
                JSON.stringify({
                  MessageType: 'SubscribeRealtime',
                  Exchange: item.exchange,
                  InstrumentIdentifier: item.symbol,
                })
              );
            }
          } else {
            lastError = String(msg.Message ?? 'GFDL WebSocket authentication failed.');
          }
          return;
        }

        if (
          msgType === 'RealtimeResult' ||
          msgType === 'LastQuoteResult' ||
          typeof msg.LastTradePrice === 'number'
        ) {
          const parsed = parseGfdlQuoteObject(msg, cfg.feedTierHint, true);
          if (parsed) {
            const ex = String(msg.Exchange ?? 'NSE').trim().toUpperCase();
            const cacheKey = `gfdl:quote:${ex}:${parsed.symbol}`;
            setCacheValue(cacheKey, parsed.quote, 15_000);
            gfdlStreamBus.emit('quote', {
              exchange: ex,
              symbol: parsed.symbol,
              quote: parsed.quote,
            });
          }
        }
      } catch {
        // Ignore malformed frame safely
      }
    });

    ws.addEventListener('close', () => {
      wsConnected = false;
      wsInstance = null;
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(() => {
        startGfdlWebsocketIfConfigured(symbols);
      }, 30_000);
    });

    ws.addEventListener('error', () => {
      wsConnected = false;
    });
  } catch {
    wsConnected = false;
    wsInstance = null;
  }
}

export const gfdlProvider = {
  isConfigured(): boolean {
    return getProviderConfig().gfdl.configured;
  },

  getHealth(): ProviderHealthStatus {
    const cfg = getProviderConfig().gfdl;
    const missing = getMissingSettings();
    const configured = cfg.configured;
    const verifiedConnected = configured && (lastSuccessAt !== null || wsConnected);
    const verifiedStatus: FeedStatus = !configured
      ? 'Unavailable'
      : verifiedConnected
      ? lastVerifiedFreshness
      : 'Unavailable';

    return {
      id: 'gfdl',
      name: 'Global Datafeeds (GFDL)',
      configured,
      connected: verifiedConnected,
      feedStatus: verifiedStatus,
      streaming: configured && cfg.streamingEnabled && Boolean(cfg.wsUrl) && wsConnected,
      recommendedPollMs: wsConnected ? 60_000 : 20_000,
      missingSettings: missing,
      notes: !configured
        ? 'Indian market feed not connected'
        : verifiedConnected
        ? `Subscribed exchanges: ${Array.from(cfg.allowedExchanges).join(', ')}${cfg.streamingEnabled && cfg.wsUrl ? ' · WebSocket streaming' : ' · REST polling'}`
        : `Configured for ${Array.from(cfg.allowedExchanges).join(', ')}; awaiting verified quote coverage.`,
      lastSuccessAt,
      lastError: configured ? lastError : null,
    };
  },

  isExchangeAllowed(exchange: string): boolean {
    const cfg = getProviderConfig().gfdl;
    return cfg.allowedExchanges.has(exchange.toUpperCase());
  },

  async getBatchQuotes(
    exchange: string,
    symbols: string[]
  ): Promise<Map<string, NormalizedQuoteResult>> {
    const out = new Map<string, NormalizedQuoteResult>();
    if (symbols.length === 0) return out;
    const cfg = getProviderConfig().gfdl;
    const exUpper = exchange.toUpperCase();

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
          unavailableReason: 'Indian market feed not connected',
        });
      }
      return out;
    }

    if (!cfg.allowedExchanges.has(exUpper)) {
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
          unavailableReason: `Exchange "${exUpper}" is not enabled in GFDL_ALLOWED_EXCHANGES.`,
        });
      }
      return out;
    }

    const toFetch: string[] = [];
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const cacheKey = `gfdl:quote:${exUpper}:${upper}`;
      const cached = getFreshCache<NormalizedQuoteResult>(cacheKey);
      if (cached) {
        out.set(upper, cached);
      } else {
        toFetch.push(upper);
      }
    }

    if (toFetch.length === 0) return out;

    const chunks: string[][] = [];
    for (let i = 0; i < toFetch.length; i += 25) {
      chunks.push(toFetch.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      const batchKey = `gfdl:batch:${exUpper}:${chunk.join(',')}`;
      await dedupeInFlight(batchKey, async () => {
        const res = await gfdlFetchJson('GetSnapshot', {
          exchange: exUpper,
          periodicity: 'MINUTE',
          period: 1,
          instrumentIdentifiers: chunk.join('+'),
        });

        if (res.ok && res.data) {
          const rows: unknown[] = Array.isArray(res.data)
            ? res.data
            : typeof res.data === 'object' &&
              Array.isArray((res.data as Record<string, unknown>).Data)
            ? ((res.data as Record<string, unknown>).Data as unknown[])
            : typeof res.data === 'object' &&
              Array.isArray((res.data as Record<string, unknown>).Result)
            ? ((res.data as Record<string, unknown>).Result as unknown[])
            : [res.data];

          for (const item of rows) {
            if (!item || typeof item !== 'object') continue;
            const parsed = parseGfdlQuoteObject(
              item as Record<string, unknown>,
              cfg.feedTierHint,
              false
            );
            if (parsed) {
              setCacheValue(`gfdl:quote:${exUpper}:${parsed.symbol}`, parsed.quote, 15_000);
              out.set(parsed.symbol, parsed.quote);
            }
          }
        }

        for (const sym of chunk) {
          if (out.has(sym)) continue;
          const stale = getStaleCache<NormalizedQuoteResult>(`gfdl:quote:${exUpper}:${sym}`);
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
                res.error ?? `No quote returned by GFDL for ${exUpper}:${sym}.`,
            });
          }
        }
      });
    }

    return out;
  },

  async getSingleQuote(
    exchange: string,
    symbol: string,
    alternateSymbols: string[] = []
  ): Promise<NormalizedQuoteResult> {
    const cfg = getProviderConfig().gfdl;
    const exUpper = exchange.toUpperCase();
    const symUpper = symbol.toUpperCase();
    const cacheKey = `gfdl:quote:${exUpper}:${symUpper}`;

    const fresh = getFreshCache<NormalizedQuoteResult>(cacheKey);
    if (fresh) return fresh;

    if (!cfg.configured) {
      return {
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
        unavailableReason: 'Indian market feed not connected',
      };
    }

    if (!cfg.allowedExchanges.has(exUpper)) {
      return {
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
        unavailableReason: `Exchange "${exUpper}" is not enabled in GFDL_ALLOWED_EXCHANGES.`,
      };
    }

    return dedupeInFlight(`gfdl:single:${exUpper}:${symUpper}`, async () => {
      const candidates = [symUpper, ...alternateSymbols];
      let lastFailure: string | undefined;

      for (const candidate of candidates) {
        const res = await gfdlFetchJson('GetLastQuote', {
          exchange: exUpper,
          instrumentIdentifier: candidate,
        });
        if (res.ok && res.data && typeof res.data === 'object') {
          const parsed = parseGfdlQuoteObject(
            res.data as Record<string, unknown>,
            cfg.feedTierHint,
            false
          );
          if (parsed) {
            setCacheValue(cacheKey, parsed.quote, 15_000);
            return parsed.quote;
          }
        }
        lastFailure = res.error;
      }

      const stale = getStaleCache<NormalizedQuoteResult>(cacheKey);
      if (stale && Number.isFinite(stale.price)) {
        return {
          ...stale,
          stale: true,
          unavailableReason: lastFailure ?? 'Upstream outage; showing last known quote.',
        };
      }

      return {
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
          lastFailure ?? `GFDL returned no quote for ${exUpper}:${symUpper}.`,
      };
    });
  },

  async getHistory(
    exchange: string,
    symbol: string,
    range: ChartRange
  ): Promise<NormalizedHistoryResult> {
    const cfg = getProviderConfig().gfdl;
    const exUpper = exchange.toUpperCase();
    const symUpper = symbol.toUpperCase();
    const cacheKey = `gfdl:hist:${exUpper}:${symUpper}:${range}`;

    const fresh = getFreshCache<NormalizedHistoryResult>(cacheKey);
    if (fresh) return fresh;

    if (!cfg.configured) {
      return {
        bars: [],
        feedStatus: 'Unavailable',
        stale: false,
        providerTimestamp: null,
        unavailableReason: 'Indian market feed not connected',
      };
    }

    if (!cfg.allowedExchanges.has(exUpper)) {
      return {
        bars: [],
        feedStatus: 'Unavailable',
        stale: false,
        providerTimestamp: null,
        unavailableReason: `Exchange "${exUpper}" is not enabled in GFDL_ALLOWED_EXCHANGES.`,
      };
    }

    return dedupeInFlight(cacheKey, async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      let periodicity: 'MINUTE' | 'DAY' | 'WEEK' | 'MONTH' = 'DAY';
      let period = 1;
      let fromSec = nowSec - 35 * 86400;
      let max = 0;

      switch (range) {
        case '1D':
          periodicity = 'MINUTE';
          period = 5;
          fromSec = nowSec - 3 * 86400;
          max = 120;
          break;
        case '1W':
          periodicity = 'MINUTE';
          period = 30;
          fromSec = nowSec - 10 * 86400;
          max = 140;
          break;
        case '1M':
          periodicity = 'DAY';
          fromSec = nowSec - 36 * 86400;
          break;
        case '3M':
          periodicity = 'DAY';
          fromSec = nowSec - 105 * 86400;
          break;
        case '6M':
          periodicity = 'DAY';
          fromSec = nowSec - 195 * 86400;
          break;
        case '1Y':
          periodicity = 'DAY';
          fromSec = nowSec - 380 * 86400;
          break;
        case '5Y':
          periodicity = 'WEEK';
          fromSec = nowSec - 5 * 366 * 86400;
          break;
        case 'MAX':
          periodicity = 'MONTH';
          fromSec = nowSec - 20 * 366 * 86400;
          max = 240;
          break;
      }

      const res = await gfdlFetchJson('GetHistory', {
        exchange: exUpper,
        instrumentIdentifier: symUpper,
        periodicity,
        period,
        From: fromSec,
        To: nowSec,
        Max: max,
      });

      const rawList =
        res.ok && res.data && typeof res.data === 'object'
          ? (pickField(res.data as Record<string, unknown>, ['Data', 'Result']) as unknown[])
          : null;

      if (Array.isArray(rawList) && rawList.length > 0) {
        const intraday = range === '1D' || range === '1W';
        const byTs = new Map<number, OhlcvBar>();
        for (const item of rawList) {
          if (!item || typeof item !== 'object') continue;
          const row = item as Record<string, unknown>;
          const ts = epochToUnixSec(
            pickField(row, ['LastTradeTime', 'LASTTRADETIME', 'Timestamp'])
          );
          const open = toFiniteNumber(pickField(row, ['Open', 'OPEN']));
          const high = toFiniteNumber(pickField(row, ['High', 'HIGH']));
          const low = toFiniteNumber(pickField(row, ['Low', 'LOW']));
          const close = toFiniteNumber(pickField(row, ['Close', 'CLOSE']));
          const volume =
            toFiniteNumber(pickField(row, ['TradedQty', 'TRADEDQTY', 'Volume'])) ?? 0;

          if (
            ts !== null &&
            open !== null &&
            high !== null &&
            low !== null &&
            close !== null
          ) {
            byTs.set(ts, {
              time: formatBarTime(ts, intraday),
              timestamp: ts,
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
          const latestTs = unixSecToIso(bars[bars.length - 1].timestamp);
          const histFreshness = resolveVerifiedFreshness({
            providerTimestampIso: latestTs,
            streamingActive: false,
            tierHint: intraday ? cfg.feedTierHint : 'End of day',
          });
          lastVerifiedFreshness = histFreshness;
          const result: NormalizedHistoryResult = {
            bars,
            feedStatus: histFreshness,
            stale: false,
            providerTimestamp: latestTs,
          };
          const ttl = intraday ? 60_000 : 300_000;
          setCacheValue(cacheKey, result, ttl);
          return result;
        }
      }

      const stale = getStaleCache<NormalizedHistoryResult>(cacheKey);
      if (stale && stale.bars.length > 0) {
        return {
          ...stale,
          stale: true,
          unavailableReason: res.error ?? 'Serving cached historical candles during outage.',
        };
      }

      return {
        bars: [],
        feedStatus: 'Unavailable',
        stale: false,
        providerTimestamp: null,
        unavailableReason:
          res.error ?? `No historical candles returned by GFDL for ${exUpper}:${symUpper}.`,
      };
    });
  },

  getFundamentalsUnavailableReason(): StockFundamentals {
    const cfg = getProviderConfig().gfdl;
    if (!cfg.configured) {
      return {
        unavailableReason: 'Indian market feed not connected',
      };
    }
    return {
      unavailableReason: cfg.fundamentalsEnabled
        ? 'Company fundamentals endpoint details must be confirmed against your GFDL contract.'
        : 'Global Datafeeds plan provides price/OHLCV feeds; fundamentals not enabled.',
    };
  },
};

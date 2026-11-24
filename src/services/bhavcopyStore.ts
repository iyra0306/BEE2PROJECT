import type {
  BhavcopyBar,
  BhavcopyImportStats,
  ChartRange,
  OhlcvBar,
  StockRecord,
} from '../types/market';

const DB_NAME = 'bullsight_bhavcopy_db';
const DB_VERSION = 1;
const STORE_NAME = 'equity_history';
const META_KEY = 'bullsight_bhavcopy_meta_v1';
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB safety cap
const MAX_ROWS_PER_FILE = 30_000;

const MONTH_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

const PRIORITY_NSE_SYMBOLS = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'TATAMOTORS',
  'BHARTIARTL',
  'ITC',
  'SBIN',
];

const PREFERRED_SERIES = new Set(['EQ', 'BE', 'BZ', 'SM', 'ST']);

const memoryStore = new Map<string, BhavcopyBar[]>();
const listeners = new Set<() => void>();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let lastImportedAtCache: string | null = null;

function notifyListeners() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // Ignore listener errors
    }
  }
}

function readMetaFromLocalStorage(): { lastImportedAt: string | null } {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return { lastImportedAt: null };
    const parsed = JSON.parse(raw) as { lastImportedAt?: string | null };
    return { lastImportedAt: parsed.lastImportedAt ?? null };
  } catch {
    return { lastImportedAt: null };
  }
}

function writeMetaToLocalStorage(lastImportedAt: string | null) {
  lastImportedAtCache = lastImportedAt;
  try {
    if (lastImportedAt) {
      window.localStorage.setItem(META_KEY, JSON.stringify({ lastImportedAt }));
    } else {
      window.localStorage.removeItem(META_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open Bhavcopy DB'));
  });
}

async function persistSymbolsToDb(symbols: string[]): Promise<void> {
  if (symbols.length === 0 || typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const sym of symbols) {
        const list = memoryStore.get(sym);
        if (list && list.length > 0) {
          store.put(list, sym);
        } else {
          store.delete(sym);
        }
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Failed to persist Bhavcopy rows'));
      };
    });
  } catch {
    // Memory store remains active even if IndexedDB is restricted
  }
}

async function clearDb(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore
  }
}

export function normalizeTradeDate(raw: string): {
  date: string;
  timestamp: number;
} | null {
  const clean = raw.trim().replace(/^"|"$/g, '');
  if (!clean) return null;

  let yyyy = '';
  let mm = '';
  let dd = '';

  // YYYY-MM-DD or YYYYMMDD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
  const compactMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(clean);
  // DD-MMM-YYYY (legacy NSE format, e.g. 22-NOV-2026)
  const monMatch = /^(\d{1,2})[-\s/]([A-Za-z]{3})[-\s/](\d{4})$/.exec(clean);
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(clean);

  if (isoMatch) {
    [, yyyy, mm, dd] = isoMatch;
  } else if (compactMatch) {
    [, yyyy, mm, dd] = compactMatch;
  } else if (monMatch) {
    dd = monMatch[1].padStart(2, '0');
    mm = MONTH_MAP[monMatch[2].toUpperCase()] ?? '';
    yyyy = monMatch[3];
  } else if (dmyMatch) {
    dd = dmyMatch[1].padStart(2, '0');
    mm = dmyMatch[2].padStart(2, '0');
    yyyy = dmyMatch[3];
  }

  if (!yyyy || !mm || !dd) return null;
  const yNum = Number(yyyy);
  const mNum = Number(mm);
  const dNum = Number(dd);
  if (
    !Number.isInteger(yNum) ||
    !Number.isInteger(mNum) ||
    !Number.isInteger(dNum) ||
    mNum < 1 ||
    mNum > 12 ||
    dNum < 1 ||
    dNum > 31
  ) {
    return null;
  }

  // 15:30 IST = 10:00 UTC
  const ms = Date.UTC(yNum, mNum - 1, dNum, 10, 0, 0);
  if (Number.isNaN(ms)) return null;
  const check = new Date(ms);
  if (check.getUTCMonth() !== mNum - 1 || check.getUTCDate() !== dNum) {
    return null;
  }

  return {
    date: `${yyyy}-${mm}-${dd}`,
    timestamp: Math.floor(ms / 1000),
  };
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function toPosNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNonNegNum(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export interface CsvParseSummary {
  rowsImported: number;
  datesAdded: string[];
  symbolsUpdated: number;
  skippedRows: number;
  formatDetected: 'CM-UDiFF' | 'Legacy NSE';
  warnings: string[];
}

export function parseBhavcopyCsvText(csvText: string): {
  bars: BhavcopyBar[];
  summary: CsvParseSummary;
} {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/);

  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].trim() !== '') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error('CSV file appears empty.');
  }

  const rawHeaders = splitCsvLine(lines[headerIdx]);
  const headerIndex = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerIndex.set(h.trim().toLowerCase(), idx);
  });

  const col = (...names: string[]): number => {
    for (const n of names) {
      const idx = headerIndex.get(n.toLowerCase());
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  // Official NSE CM-UDiFF columns vs legacy NSE Bhavcopy columns
  const symIdx = col('tckrsymb', 'symbol');
  const dateIdx = col('traddt', 'timestamp');
  const seriesIdx = col('sctysrs', 'series');
  const instrTypeIdx = col('fininstrmtp');
  const nameIdx = col('fininstrmnm');
  const openIdx = col('opnpric', 'open');
  const highIdx = col('hghpric', 'high');
  const lowIdx = col('lwpric', 'low');
  const closeIdx = col('clspric', 'close', 'lastpric', 'last');
  const prevCloseIdx = col('prvsclsgpric', 'prevclose');
  const volIdx = col('ttltradgvol', 'tottrdqty');

  if (symIdx === -1 || dateIdx === -1 || closeIdx === -1) {
    throw new Error(
      'Unrecognized Bhavcopy CSV format. Expected NSE CM-UDiFF headers (TradDt, TckrSymb, SctySrs, OpnPric, HghPric, LwPric, ClsPric, PrvsClsgPric, TtlTradgVol).'
    );
  }

  const formatDetected: 'CM-UDiFF' | 'Legacy NSE' = headerIndex.has('tckrsymb')
    ? 'CM-UDiFF'
    : 'Legacy NSE';

  const bars: BhavcopyBar[] = [];
  const datesSet = new Set<string>();
  const symbolsSet = new Set<string>();
  let skippedRows = 0;
  const warnings: string[] = [];

  const maxLine = Math.min(lines.length, headerIdx + 1 + MAX_ROWS_PER_FILE);
  if (lines.length - (headerIdx + 1) > MAX_ROWS_PER_FILE) {
    warnings.push(
      `File exceeded ${MAX_ROWS_PER_FILE.toLocaleString()} rows; extra trailing rows were truncated.`
    );
  }

  for (let i = headerIdx + 1; i < maxLine; i++) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;
    const cols = splitCsvLine(rawLine);

    const rawSymbol = (cols[symIdx] ?? '').trim().toUpperCase();
    if (!rawSymbol || !/^[A-Z0-9&-]{1,24}$/.test(rawSymbol)) {
      skippedRows++;
      continue;
    }

    const instrType =
      instrTypeIdx >= 0 ? (cols[instrTypeIdx] ?? '').trim().toUpperCase() : '';
    if (instrType && instrType !== 'STK' && instrType !== 'EQ') {
      skippedRows++;
      continue;
    }

    const series =
      seriesIdx >= 0 ? (cols[seriesIdx] ?? '').trim().toUpperCase() : 'EQ';
    if (series && !PREFERRED_SERIES.has(series)) {
      skippedRows++;
      continue;
    }

    const parsedDate = normalizeTradeDate(cols[dateIdx] ?? '');
    if (!parsedDate) {
      skippedRows++;
      continue;
    }

    const close = toPosNum(cols[closeIdx]);
    if (close === null) {
      skippedRows++;
      continue;
    }

    const open = toPosNum(cols[openIdx]) ?? close;
    const high = toPosNum(cols[highIdx]) ?? Math.max(open, close);
    const low = toPosNum(cols[lowIdx]) ?? Math.min(open, close);
    const prevClose = prevCloseIdx >= 0 ? toPosNum(cols[prevCloseIdx]) : null;
    const volume = volIdx >= 0 ? toNonNegNum(cols[volIdx]) : 0;
    const rawName = nameIdx >= 0 ? (cols[nameIdx] ?? '').trim() : '';

    bars.push({
      symbol: rawSymbol,
      date: parsedDate.date,
      timestamp: parsedDate.timestamp,
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close,
      prevClose,
      volume,
      series: series || 'EQ',
      name: rawName || undefined,
    });

    datesSet.add(parsedDate.date);
    symbolsSet.add(rawSymbol);
  }

  if (bars.length === 0) {
    throw new Error(
      'No valid NSE equity rows (EQ/STK) with closing prices were found in the CSV.'
    );
  }

  return {
    bars,
    summary: {
      rowsImported: bars.length,
      datesAdded: Array.from(datesSet).sort(),
      symbolsUpdated: symbolsSet.size,
      skippedRows,
      formatDetected,
      warnings,
    },
  };
}

function mergeSymbolBars(existing: BhavcopyBar[], incoming: BhavcopyBar[]): BhavcopyBar[] {
  const byDate = new Map<string, BhavcopyBar>();
  for (const b of existing) byDate.set(b.date, b);
  for (const b of incoming) {
    const prev = byDate.get(b.date);
    // Keep EQ ahead of BE/SM if duplicate symbol+date exists inside one file
    if (!prev || b.series === 'EQ') {
      byDate.set(b.date, b);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function sliceBarsByRange(
  bars: BhavcopyBar[],
  range: ChartRange
): { bars: OhlcvBar[]; insufficientReason?: string } {
  if (bars.length === 0) {
    return {
      bars: [],
      insufficientReason: 'No NSE CM-UDiFF Bhavcopy dates imported for this symbol.',
    };
  }

  const latestTs = bars[bars.length - 1].timestamp;
  let lookbackDays = 0;

  switch (range) {
    case '1D':
      // Show latest imported EOD bar(s); Bhavcopy only holds daily end-of-day closes
      return {
        bars: bars.slice(-1).map(toOhlcvBar),
        insufficientReason:
          bars.length === 1
            ? 'Showing single End of day CM-UDiFF Bhavcopy close. Import additional trading dates in Settings for multi-session candles.'
            : undefined,
      };
    case '1W':
      lookbackDays = 10;
      break;
    case '1M':
      lookbackDays = 35;
      break;
    case '3M':
      lookbackDays = 95;
      break;
    case '6M':
      lookbackDays = 185;
      break;
    case '1Y':
      lookbackDays = 370;
      break;
    case '5Y':
      lookbackDays = 365 * 5;
      break;
    case 'MAX':
      lookbackDays = 365 * 20;
      break;
  }

  const cutoff = latestTs - lookbackDays * 86400;
  const sliced = bars.filter((b) => b.timestamp >= cutoff).map(toOhlcvBar);

  let insufficientReason: string | undefined;
  if (sliced.length < 2) {
    insufficientReason = `Only ${bars.length} imported Bhavcopy trading date(s) available (${bars[bars.length - 1].date}). Import more CM-UDiFF Bhavcopy CSV dates in Settings to render trend history and indicators.`;
  } else if (range !== '1W' && sliced.length < 15) {
    insufficientReason = `End of day history contains ${sliced.length} imported Bhavcopy trading date(s). RSI(14) requires 15 sessions, MACD requires 35, and SMA(50) requires 50.`;
  }

  return { bars: sliced, insufficientReason };
}

function toOhlcvBar(b: BhavcopyBar): OhlcvBar {
  return {
    time: b.date,
    timestamp: b.timestamp,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  };
}

export const bhavcopyStore = {
  async hydrate(): Promise<void> {
    if (hydrated) return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      lastImportedAtCache = readMetaFromLocalStorage().lastImportedAt;
      if (typeof indexedDB === 'undefined') {
        hydrated = true;
        return;
      }
      try {
        const db = await openDb();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
              const key = String(cursor.key);
              const val = cursor.value as BhavcopyBar[];
              if (Array.isArray(val) && val.length > 0) {
                memoryStore.set(key, val);
              }
              cursor.continue();
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        });
      } catch {
        // Safe fallback
      } finally {
        hydrated = true;
        notifyListeners();
      }
    })();

    return hydrationPromise;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  hasData(): boolean {
    return memoryStore.size > 0;
  },

  async importCsvTexts(
    entries: Array<{ name: string; text: string }>
  ): Promise<CsvParseSummary & { filesProcessed: number }> {
    const touchedSymbols = new Set<string>();
    const allDates = new Set<string>();
    const warnings: string[] = [];
    let rowsImported = 0;
    let skippedRows = 0;
    let formatDetected: 'CM-UDiFF' | 'Legacy NSE' = 'CM-UDiFF';

    for (const entry of entries) {
      const parsed = parseBhavcopyCsvText(entry.text);
      formatDetected = parsed.summary.formatDetected;
      rowsImported += parsed.summary.rowsImported;
      skippedRows += parsed.summary.skippedRows;
      parsed.summary.datesAdded.forEach((d) => allDates.add(d));
      parsed.summary.warnings.forEach((w) => warnings.push(`${entry.name}: ${w}`));

      const grouped = new Map<string, BhavcopyBar[]>();
      for (const bar of parsed.bars) {
        const arr = grouped.get(bar.symbol);
        if (arr) arr.push(bar);
        else grouped.set(bar.symbol, [bar]);
      }

      for (const [sym, newBars] of grouped.entries()) {
        const existing = memoryStore.get(sym) ?? [];
        memoryStore.set(sym, mergeSymbolBars(existing, newBars));
        touchedSymbols.add(sym);
      }
    }

    const nowIso = new Date().toISOString();
    writeMetaToLocalStorage(nowIso);
    await persistSymbolsToDb(Array.from(touchedSymbols));
    hydrated = true;
    notifyListeners();

    return {
      filesProcessed: entries.length,
      rowsImported,
      datesAdded: Array.from(allDates).sort(),
      symbolsUpdated: touchedSymbols.size,
      skippedRows,
      formatDetected,
      warnings,
    };
  },

  async importFiles(fileList: FileList | File[]): Promise<CsvParseSummary & { filesProcessed: number }> {
    const files = Array.from(fileList);
    if (files.length === 0) {
      throw new Error('Select at least one NSE CM-UDiFF Bhavcopy CSV file.');
    }

    const entries: Array<{ name: string; text: string }> = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && !file.type.includes('text')) {
        throw new Error(`Unsupported file "${file.name}". Please upload official .csv Bhavcopy files.`);
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`File "${file.name}" exceeds the 25 MB upload limit.`);
      }
      const text = await file.text();
      entries.push({ name: file.name, text });
    }

    return this.importCsvTexts(entries);
  },

  async clearAll(): Promise<void> {
    memoryStore.clear();
    writeMetaToLocalStorage(null);
    await clearDb();
    notifyListeners();
  },

  getStats(): BhavcopyImportStats {
    const datesSet = new Set<string>();
    let totalRows = 0;

    for (const bars of memoryStore.values()) {
      totalRows += bars.length;
      for (const b of bars) datesSet.add(b.date);
    }

    const dates = Array.from(datesSet).sort();
    const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;
    const earliestDate = dates.length > 0 ? dates[0] : null;

    const sampleSymbols: string[] = [];
    for (const sym of PRIORITY_NSE_SYMBOLS) {
      if (memoryStore.has(sym)) sampleSymbols.push(sym);
    }
    if (sampleSymbols.length < 8) {
      for (const sym of memoryStore.keys()) {
        if (!sampleSymbols.includes(sym)) {
          sampleSymbols.push(sym);
          if (sampleSymbols.length >= 8) break;
        }
      }
    }

    const sampleCloses = sampleSymbols
      .map((sym) => {
        const quote = this.getLatestQuote(sym);
        if (!quote) return null;
        return {
          symbol: sym,
          name: quote.name,
          date: quote.date,
          close: quote.close,
          changePercent: quote.changePercent,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    return {
      totalSymbols: memoryStore.size,
      totalRows,
      dates,
      latestDate,
      earliestDate,
      lastImportedAt: lastImportedAtCache,
      sampleCloses,
    };
  },

  getLatestQuote(symbol: string): {
    symbol: string;
    name?: string;
    date: string;
    timestampIso: string;
    close: number;
    previousClose: number | null;
    change: number | null;
    changePercent: number | null;
    open: number;
    high: number;
    low: number;
    volume: number;
    sparkline: number[];
    totalDates: number;
  } | null {
    const clean = symbol.trim().toUpperCase().replace(/^NSE:/, '');
    const bars = memoryStore.get(clean);
    if (!bars || bars.length === 0) return null;

    const latest = bars[bars.length - 1];
    const priorBar = bars.length >= 2 ? bars[bars.length - 2] : null;
    const previousClose = latest.prevClose ?? priorBar?.close ?? null;
    const change =
      previousClose !== null
        ? Number((latest.close - previousClose).toFixed(2))
        : null;
    const changePercent =
      change !== null && previousClose && previousClose > 0
        ? Number(((change / previousClose) * 100).toFixed(2))
        : null;

    return {
      symbol: clean,
      name: latest.name,
      date: latest.date,
      timestampIso: new Date(latest.timestamp * 1000).toISOString(),
      close: latest.close,
      previousClose,
      change,
      changePercent,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      volume: latest.volume,
      sparkline: bars.slice(-16).map((b) => b.close),
      totalDates: bars.length,
    };
  },

  getHistoryBars(
    symbol: string,
    range: ChartRange
  ): {
    bars: OhlcvBar[];
    totalImportedDates: number;
    latestDate: string | null;
    providerTimestamp: string | null;
    insufficientReason?: string;
  } {
    const clean = symbol.trim().toUpperCase().replace(/^NSE:/, '');
    const rawBars = memoryStore.get(clean) ?? [];
    if (rawBars.length === 0) {
      return {
        bars: [],
        totalImportedDates: 0,
        latestDate: null,
        providerTimestamp: null,
      };
    }

    const latest = rawBars[rawBars.length - 1];
    const { bars, insufficientReason } = sliceBarsByRange(rawBars, range);
    return {
      bars,
      totalImportedDates: rawBars.length,
      latestDate: latest.date,
      providerTimestamp: new Date(latest.timestamp * 1000).toISOString(),
      insufficientReason,
    };
  },

  overlayStockRecord(stock: StockRecord): StockRecord {
    // Only fill NSE stocks in Real mode when live GFDL price is unavailable
    if (
      stock.exchange !== 'NSE' ||
      (stock.price !== null && Number.isFinite(stock.price) && stock.feedStatus === 'Live')
    ) {
      return stock;
    }

    const eod = this.getLatestQuote(stock.ticker);
    if (!eod) return stock;

    return {
      ...stock,
      provider: 'Bhavcopy CSV',
      feedStatus: 'End of day',
      stale: false,
      providerTimestamp: eod.timestampIso,
      fetchedAt: lastImportedAtCache ?? eod.timestampIso,
      unavailableReason: undefined,
      price: eod.close,
      previousClose: eod.previousClose,
      change: eod.change,
      changePercent: eod.changePercent,
      open: eod.open,
      high: eod.high,
      low: eod.low,
      volume: eod.volume,
      sparkline: eod.sparkline,
    };
  },

  overlayStocks(stocks: StockRecord[]): StockRecord[] {
    if (memoryStore.size === 0) return stocks;
    return stocks.map((s) => this.overlayStockRecord(s));
  },

  getStandaloneStockRecord(rawSymbol: string): StockRecord | null {
    const clean = rawSymbol.trim().toUpperCase().replace(/^NSE:/, '');
    const eod = this.getLatestQuote(clean);
    if (!eod) return null;

    return {
      ticker: clean,
      normalizedSymbol: `NSE:${clean}`,
      name: eod.name || clean,
      market: 'India',
      exchange: 'NSE',
      currency: 'INR',
      sector: 'NSE Cash Market (Imported)',
      provider: 'Bhavcopy CSV',
      feedStatus: 'End of day',
      stale: false,
      providerTimestamp: eod.timestampIso,
      fetchedAt: lastImportedAtCache ?? eod.timestampIso,
      price: eod.close,
      previousClose: eod.previousClose,
      change: eod.change,
      changePercent: eod.changePercent,
      open: eod.open,
      high: eod.high,
      low: eod.low,
      volume: eod.volume,
      marketCap: null,
      sparkline: eod.sparkline,
      profile: {
        provider: 'Bhavcopy CSV',
        asOfDate: eod.date,
        unavailableReason:
          'Imported locally from official NSE CM-UDiFF Bhavcopy CSV (End of day OHLCV).',
      },
      fundamentals: {
        provider: 'Bhavcopy CSV',
        reportingDate: eod.date,
        unavailableReason:
          'Valuation ratios are not included in NSE daily CM-UDiFF Bhavcopy files.',
      },
    };
  },
};

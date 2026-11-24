import type {
  AccountServiceStatus,
  ChartRange,
  DataMode,
  HealthResponse,
  HorizonType,
  MarketOverviewResponse,
  MarketRegion,
  NewsListResponse,
  PredictionResponse,
  StockDetailResponse,
  StockHistoryResponse,
  StocksListResponse,
  UserAccount,
} from '../types/market';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))
  );
}

async function apiFetch<T>(
  path: string,
  signal?: AbortSignal,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'BULLSIGHT',
  };
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    response = await fetch(path, {
      method: init?.method ?? 'GET',
      credentials: 'include',
      ...init,
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
      signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new ApiError(
      'Unable to reach the BULLSIGHT API server. Verify the server is running and try again.',
      0,
      'NETWORK_ERROR'
    );
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Request failed with status ${response.status}.`;
    const code =
      (payload && typeof payload.code === 'string' && payload.code) ||
      `HTTP_${response.status}`;
    throw new ApiError(message, response.status, code, payload ?? undefined);
  }

  return payload as unknown as T;
}

function toQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      sp.set(k, v);
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const apiClient = {
  getHealth(mode?: DataMode, signal?: AbortSignal): Promise<HealthResponse> {
    const qs = toQuery({ mode });
    return apiFetch<HealthResponse>(`/api/health${qs}`, signal);
  },

  getMarketOverview(
    params: {
      market?: 'All' | MarketRegion;
      indexId?: string;
      range?: ChartRange;
      mode?: DataMode;
      symbols?: string[];
    } = {},
    signal?: AbortSignal
  ): Promise<MarketOverviewResponse> {
    const qs = toQuery({
      market: params.market,
      indexId: params.indexId,
      range: params.range,
      mode: params.mode,
      symbols:
        params.symbols && params.symbols.length > 0
          ? params.symbols.join(',')
          : undefined,
    });
    return apiFetch<MarketOverviewResponse>(`/api/market/overview${qs}`, signal);
  },

  getStocks(
    params: {
      market?: 'All' | MarketRegion;
      q?: string;
      exchange?: string;
      sector?: string;
      priceTier?: string;
      performance?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      mode?: DataMode;
      symbols?: string[];
    } = {},
    signal?: AbortSignal
  ): Promise<StocksListResponse> {
    const qs = toQuery({
      market: params.market,
      q: params.q,
      exchange: params.exchange,
      sector: params.sector,
      priceTier: params.priceTier,
      performance: params.performance,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      mode: params.mode,
      symbols:
        params.symbols && params.symbols.length > 0
          ? params.symbols.join(',')
          : undefined,
    });
    return apiFetch<StocksListResponse>(`/api/stocks${qs}`, signal);
  },

  getStock(
    symbol: string,
    mode?: DataMode,
    signal?: AbortSignal
  ): Promise<StockDetailResponse> {
    const safeSymbol = encodeURIComponent(symbol.trim().toUpperCase());
    const qs = toQuery({ mode });
    return apiFetch<StockDetailResponse>(`/api/stocks/${safeSymbol}${qs}`, signal);
  },

  getStockHistory(
    symbol: string,
    range: ChartRange = '1M',
    mode?: DataMode,
    signal?: AbortSignal
  ): Promise<StockHistoryResponse> {
    const safeSymbol = encodeURIComponent(symbol.trim().toUpperCase());
    const qs = toQuery({ range, mode });
    return apiFetch<StockHistoryResponse>(
      `/api/stocks/${safeSymbol}/history${qs}`,
      signal
    );
  },

  getNews(
    params: {
      category?: string;
      q?: string;
      ticker?: string;
      mode?: DataMode;
    } = {},
    signal?: AbortSignal
  ): Promise<NewsListResponse> {
    const qs = toQuery({
      category: params.category,
      q: params.q,
      ticker: params.ticker,
      mode: params.mode,
    });
    return apiFetch<NewsListResponse>(`/api/news${qs}`, signal);
  },

  getPrediction(
    symbol: string,
    horizon: HorizonType = '14D',
    mode?: DataMode,
    signal?: AbortSignal
  ): Promise<PredictionResponse> {
    const safeSymbol = encodeURIComponent(symbol.trim().toUpperCase());
    const qs = toQuery({ horizon, mode });
    return apiFetch<PredictionResponse>(
      `/api/predictions/${safeSymbol}${qs}`,
      signal
    );
  },

  getAuthStatus(signal?: AbortSignal): Promise<AccountServiceStatus> {
    return apiFetch<AccountServiceStatus>('/api/auth/status', signal);
  },

  getMe(signal?: AbortSignal): Promise<{
    authenticated: boolean;
    user: UserAccount | null;
    accountService: AccountServiceStatus;
  }> {
    return apiFetch('/api/auth/me', signal);
  },

  register(payload: {
    name: string;
    email: string;
    password: string;
    watchlist?: string[];
  }): Promise<{ authenticated: boolean; user: UserAccount }> {
    return apiFetch('/api/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: {
    email: string;
    password: string;
  }): Promise<{ authenticated: boolean; user: UserAccount }> {
    return apiFetch('/api/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout(): Promise<{ ok: boolean; authenticated: boolean }> {
    return apiFetch('/api/auth/logout', undefined, {
      method: 'POST',
    });
  },

  addWatchlistTicker(ticker: string): Promise<{ watchlist: string[] }> {
    return apiFetch('/api/user/watchlist', undefined, {
      method: 'POST',
      body: JSON.stringify({ ticker }),
    });
  },

  removeWatchlistTicker(ticker: string): Promise<{ watchlist: string[] }> {
    const safeTicker = encodeURIComponent(ticker.trim().toUpperCase());
    return apiFetch(`/api/user/watchlist/${safeTicker}`, undefined, {
      method: 'DELETE',
    });
  },
};

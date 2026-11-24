import { DisplayPreferences } from '../types/market';

const WATCHLIST_KEY = 'bullsight_watchlist_v1';
const PREFS_KEY = 'bullsight_preferences_v1';

const DEFAULT_WATCHLIST = ['RELIANCE', 'TCS', 'INFY', 'NVDA', 'AAPL', 'MSFT'];

export const DEFAULT_PREFERENCES: DisplayPreferences = {
  theme: 'dark',
  dataModePreference: 'auto',
  defaultMarket: 'All',
  currencyMode: 'Native',
  defaultChartType: 'candlestick',
  defaultRange: '3M',
  showVolumeByDefault: true,
  compactTables: false,
  priceAlertsEnabled: true,
  aiSignalDigestEnabled: true,
};

export const preferencesService = {
  getWatchlist(): string[] {
    try {
      const raw = window.localStorage.getItem(WATCHLIST_KEY);
      if (!raw) {
        window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(DEFAULT_WATCHLIST));
        return DEFAULT_WATCHLIST;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  },

  saveWatchlist(tickers: string[]): string[] {
    const unique = Array.from(new Set(tickers.map((t) => t.toUpperCase())));
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(unique));
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
    return unique;
  },

  getPreferences(): DisplayPreferences {
    try {
      const raw = window.localStorage.getItem(PREFS_KEY);
      if (!raw) return DEFAULT_PREFERENCES;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  savePreferences(prefs: DisplayPreferences): DisplayPreferences {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
    return prefs;
  },
};

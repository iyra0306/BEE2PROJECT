import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiClient, isAbortError } from '../services/apiClient';
import { bhavcopyStore, type CsvParseSummary } from '../services/bhavcopyStore';
import {
  DEFAULT_PREFERENCES,
  preferencesService,
} from '../services/preferencesService';
import type {
  AccountServiceStatus,
  ApiProviderMeta,
  BhavcopyImportStats,
  DataMode,
  DisplayPreferences,
  MarketRegion,
  UserAccount,
} from '../types/market';

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  ticker?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: 'emerald' | 'neutral';
}

interface AppContextValue {
  user: UserAccount | null;
  authLoading: boolean;
  accountService: AccountServiceStatus | null;
  loginUser: (email: string, password: string) => Promise<UserAccount>;
  registerUser: (
    name: string,
    email: string,
    password: string
  ) => Promise<UserAccount>;
  logoutUser: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  watchlist: string[];
  isInWatchlist: (ticker: string) => boolean;
  toggleWatchlist: (ticker: string) => void;
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
  preferences: DisplayPreferences;
  updatePreferences: (patch: Partial<DisplayPreferences>) => void;
  resetPreferences: () => void;
  activeMarket: 'All' | MarketRegion;
  setActiveMarket: (market: 'All' | MarketRegion) => void;
  dataMode: DataMode;
  setDataMode: (mode: 'auto' | DataMode) => void;
  hasRealSource: boolean;
  bhavcopyStats: BhavcopyImportStats;
  bhavcopyVersion: number;
  importBhavcopyFiles: (
    files: FileList | File[]
  ) => Promise<CsvParseSummary & { filesProcessed: number }>;
  clearBhavcopyData: () => Promise<void>;
  providerMeta: ApiProviderMeta | null;
  fxUsdToInr: number | null;
  notifications: NotificationItem[];
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function buildProviderNotifications(
  meta: ApiProviderMeta,
  dataMode: DataMode,
  bhavcopyStats: BhavcopyImportStats
): NotificationItem[] {
  const items: NotificationItem[] = [];
  const { gfdl, twelveData } = meta.providers;

  if (dataMode === 'demo') {
    items.push({
      id: 'status-demo',
      title: 'Demo Mode Active',
      detail:
        'Using simulated demo market fixtures across charts, quotes, news, and illustrative predictions. Switch to Real Data Mode anytime in the top bar or Settings.',
      time: 'Demo data',
      read: true,
    });
  }

  items.push({
    id: 'status-gfdl',
    title: gfdl.configured
      ? `GFDL Feed: ${gfdl.feedStatus}`
      : bhavcopyStats.totalRows > 0
      ? `NSE Bhavcopy EOD: ${bhavcopyStats.latestDate}`
      : 'Indian market feed not connected',
    detail: gfdl.configured
      ? gfdl.notes
      : bhavcopyStats.totalRows > 0
      ? `${bhavcopyStats.totalSymbols.toLocaleString()} NSE symbols imported across ${bhavcopyStats.dates.length} trading date(s) (End of day).`
      : 'Optional GFDL settings are unset. Use Demo mode or import NSE CM-UDiFF Bhavcopy CSV files in Settings.',
    time: bhavcopyStats.totalRows > 0 && !gfdl.configured ? 'End of day' : 'Feed Status',
    read: gfdl.configured || bhavcopyStats.totalRows > 0 || dataMode === 'demo',
  });

  items.push({
    id: 'status-td',
    title: twelveData.configured
      ? `Twelve Data: ${twelveData.feedStatus}`
      : 'US market feed not connected',
    detail: twelveData.configured
      ? twelveData.notes
      : 'Optional TWELVE_DATA_API_KEY is unset. US equities use Demo data in Demo mode or show unavailable in Real mode.',
    time: 'Feed Status',
    read: twelveData.configured || dataMode === 'demo',
  });

  return items;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountService, setAccountService] = useState<AccountServiceStatus | null>(
    null
  );
  const [guestWatchlist, setGuestWatchlist] = useState<string[]>(() =>
    preferencesService.getWatchlist()
  );
  const [preferences, setPreferences] = useState<DisplayPreferences>(() =>
    preferencesService.getPreferences()
  );
  const [activeMarket, setActiveMarket] = useState<'All' | MarketRegion>(
    () => preferencesService.getPreferences().defaultMarket
  );
  const [providerMeta, setProviderMeta] = useState<ApiProviderMeta | null>(null);
  const [bhavcopyStats, setBhavcopyStats] = useState<BhavcopyImportStats>(() =>
    bhavcopyStore.getStats()
  );
  const [bhavcopyVersion, setBhavcopyVersion] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const watchlist = user ? user.watchlist : guestWatchlist;

  const hasRealSource = useMemo(() => {
    return Boolean(providerMeta?.hasRealSource || bhavcopyStats.totalRows > 0);
  }, [providerMeta?.hasRealSource, bhavcopyStats.totalRows]);

  const dataMode: DataMode = useMemo(() => {
    if (preferences.dataModePreference === 'demo') return 'demo';
    if (preferences.dataModePreference === 'real') return 'real';
    return hasRealSource ? 'real' : 'demo';
  }, [preferences.dataModePreference, hasRealSource]);

  const refreshAuth = useCallback(async () => {
    try {
      const me = await apiClient.getMe();
      setAccountService(me.accountService);
      setUser(me.authenticated && me.user ? me.user : null);
    } catch {
      // Keep non-blocking guest experience if auth check fails
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void bhavcopyStore.hydrate();
    const unsub = bhavcopyStore.subscribe(() => {
      setBhavcopyStats(bhavcopyStore.getStats());
      setBhavcopyVersion((v) => v + 1);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .getMe(controller.signal)
      .then((me) => {
        setAccountService(me.accountService);
        setUser(me.authenticated && me.user ? me.user : null);
        setAuthLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setAuthLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestedMode =
      preferences.dataModePreference === 'auto'
        ? undefined
        : preferences.dataModePreference;
    apiClient
      .getHealth(requestedMode, controller.signal)
      .then((res) => {
        setProviderMeta(res.meta);
        if (res.accountService) {
          setAccountService(res.accountService);
        }
      })
      .catch((err) => {
        if (isAbortError(err)) return;
      });
    return () => controller.abort();
  }, [preferences.dataModePreference]);

  useEffect(() => {
    if (!providerMeta) return;
    setNotifications(
      buildProviderNotifications(providerMeta, dataMode, bhavcopyStats)
    );
  }, [providerMeta, dataMode, bhavcopyStats]);

  const pushToast = useCallback(
    (message: string, tone: 'emerald' | 'neutral' = 'emerald') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2800);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bullsight_watchlist_v1') {
        setGuestWatchlist(preferencesService.getWatchlist());
      } else if (e.key === 'bullsight_preferences_v1') {
        setPreferences(preferencesService.getPreferences());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const loginUser = useCallback(
    async (email: string, password: string): Promise<UserAccount> => {
      const res = await apiClient.login({ email, password });
      setUser(res.user);
      pushToast(`Signed in as ${res.user.name}`, 'emerald');
      return res.user;
    },
    [pushToast]
  );

  const registerUser = useCallback(
    async (
      name: string,
      email: string,
      password: string
    ): Promise<UserAccount> => {
      const res = await apiClient.register({
        name,
        email,
        password,
        watchlist: guestWatchlist,
      });
      setUser(res.user);
      pushToast(`Welcome, ${res.user.name}. Account created.`, 'emerald');
      return res.user;
    },
    [guestWatchlist, pushToast]
  );

  const logoutUser = useCallback(async () => {
    try {
      await apiClient.logout();
    } catch {
      // Clear local client state cleanly even if network fails
    }
    setUser(null);
    pushToast('Signed out. Switched back to local guest watchlist.', 'neutral');
  }, [pushToast]);

  const isInWatchlist = (ticker: string) =>
    watchlist.includes(ticker.trim().toUpperCase());

  const toggleWatchlist = (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    const currentlySaved = watchlist.includes(normalized);
    if (currentlySaved) {
      removeFromWatchlist(normalized);
    } else {
      addToWatchlist(normalized);
    }
  };

  const addToWatchlist = (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || watchlist.includes(normalized)) return;

    if (user) {
      const previous = user.watchlist;
      setUser((prev) =>
        prev ? { ...prev, watchlist: [normalized, ...prev.watchlist] } : prev
      );
      pushToast(`Added ${normalized} to your account watchlist`, 'emerald');
      apiClient
        .addWatchlistTicker(normalized)
        .then((res) => {
          setUser((prev) => (prev ? { ...prev, watchlist: res.watchlist } : prev));
        })
        .catch((err) => {
          setUser((prev) => (prev ? { ...prev, watchlist: previous } : prev));
          pushToast(
            err instanceof Error
              ? err.message
              : 'Unable to save watchlist change to MongoDB.',
            'neutral'
          );
        });
      return;
    }

    setGuestWatchlist((prev) => {
      if (prev.includes(normalized)) return prev;
      return preferencesService.saveWatchlist([normalized, ...prev]);
    });
    pushToast(`Added ${normalized} to Watchlist`, 'emerald');
  };

  const removeFromWatchlist = (ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    if (!normalized) return;

    if (user) {
      const previous = user.watchlist;
      setUser((prev) =>
        prev
          ? { ...prev, watchlist: prev.watchlist.filter((t) => t !== normalized) }
          : prev
      );
      pushToast(`Removed ${normalized} from your account watchlist`, 'neutral');
      apiClient
        .removeWatchlistTicker(normalized)
        .then((res) => {
          setUser((prev) => (prev ? { ...prev, watchlist: res.watchlist } : prev));
        })
        .catch((err) => {
          setUser((prev) => (prev ? { ...prev, watchlist: previous } : prev));
          pushToast(
            err instanceof Error
              ? err.message
              : 'Unable to update watchlist in MongoDB.',
            'neutral'
          );
        });
      return;
    }

    setGuestWatchlist((prev) =>
      preferencesService.saveWatchlist(prev.filter((t) => t !== normalized))
    );
    pushToast(`Removed ${normalized} from Watchlist`, 'neutral');
  };

  const updatePreferences = useCallback((patch: Partial<DisplayPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      if (patch.defaultMarket) {
        setActiveMarket(patch.defaultMarket);
      }
      return preferencesService.savePreferences(next);
    });
  }, []);

  const setDataMode = useCallback(
    (mode: 'auto' | DataMode) => {
      updatePreferences({ dataModePreference: mode });
      const label =
        mode === 'demo'
          ? 'Switched to Demo data mode'
          : mode === 'real'
          ? 'Switched to Real data mode'
          : 'Data mode set to Automatic';
      pushToast(label, 'emerald');
    },
    [updatePreferences, pushToast]
  );

  const importBhavcopyFiles = useCallback(
    async (files: FileList | File[]) => {
      const summary = await bhavcopyStore.importFiles(files);
      pushToast(
        `Imported ${summary.rowsImported.toLocaleString()} NSE rows (${summary.datesAdded.length} date${
          summary.datesAdded.length === 1 ? '' : 's'
        })`,
        'emerald'
      );
      return summary;
    },
    [pushToast]
  );

  const clearBhavcopyData = useCallback(async () => {
    await bhavcopyStore.clearAll();
    pushToast('Cleared locally imported Bhavcopy EOD data', 'neutral');
  }, [pushToast]);

  const resetPreferences = () => {
    setPreferences(preferencesService.savePreferences(DEFAULT_PREFERENCES));
    setActiveMarket(DEFAULT_PREFERENCES.defaultMarket);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const effectiveFxUsdToInr =
    dataMode === 'demo'
      ? 84.45
      : providerMeta?.fxUsdToInr?.provider !== 'Demo Fixture'
      ? providerMeta?.fxUsdToInr?.rate ?? null
      : null;

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        accountService,
        loginUser,
        registerUser,
        logoutUser,
        refreshAuth,
        watchlist,
        isInWatchlist,
        toggleWatchlist,
        addToWatchlist,
        removeFromWatchlist,
        preferences,
        updatePreferences,
        resetPreferences,
        activeMarket,
        setActiveMarket,
        dataMode,
        setDataMode,
        hasRealSource,
        bhavcopyStats,
        bhavcopyVersion,
        importBhavcopyFiles,
        clearBhavcopyData,
        providerMeta,
        fxUsdToInr: effectiveFxUsdToInr,
        notifications,
        markAllNotificationsRead,
        markNotificationRead,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppProvider');
  }
  return ctx;
}


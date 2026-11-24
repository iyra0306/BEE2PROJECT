import type {
  DataMode,
  NewsArticle,
  NewsListResponse,
  ProviderHealthStatus,
} from '../../src/types/market.ts';
import { getProviderConfig } from '../config/providers.ts';
import { listDemoNews } from '../data/demoData.ts';
import { dedupeInFlight, getFreshCache, setCacheValue } from '../services/providerCache.ts';

let lastSuccessAt: string | null = null;
let lastError: string | null = null;

function isSafeArticleUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export const newsProvider = {
  isConfigured(): boolean {
    return getProviderConfig().news.configured;
  },

  getHealth(): ProviderHealthStatus {
    const cfg = getProviderConfig().news;
    return {
      id: 'news',
      name: 'Market News Feed',
      configured: cfg.configured,
      connected: cfg.configured && lastSuccessAt !== null,
      feedStatus: cfg.configured ? 'Live' : 'Unavailable',
      streaming: false,
      recommendedPollMs: 300_000,
      missingSettings: cfg.configured ? [] : ['NEWS_API_URL'],
      notes: cfg.configured
        ? 'Connected to configured licensed market news endpoint.'
        : 'Neither GFDL nor Twelve Data base plans include licensed article feeds. Configure NEWS_API_URL to enable.',
      lastSuccessAt,
      lastError: cfg.configured ? lastError : 'News feed not connected.',
    };
  },

  async listNews(
    filters?: {
      category?: string;
      q?: string;
      ticker?: string;
    },
    mode: DataMode = 'real'
  ): Promise<Omit<NewsListResponse, 'meta'>> {
    if (mode === 'demo') {
      const demo = listDemoNews(filters);
      return {
        dataMode: 'demo',
        connected: true,
        isDemo: true,
        provider: 'Demo Fixture',
        articles: demo.articles,
        total: demo.articles.length,
        categories: demo.categories,
      };
    }

    const cfg = getProviderConfig().news;
    if (!cfg.configured || !cfg.apiUrl) {
      return {
        dataMode: 'real',
        connected: false,
        isDemo: false,
        provider: null,
        message: 'News feed not connected.',
        articles: [],
        total: 0,
        categories: ['All'],
      };
    }

    const cacheKey = `news:${filters?.category ?? 'All'}:${filters?.ticker ?? ''}:${filters?.q ?? ''}`;
    const fresh = getFreshCache<Omit<NewsListResponse, 'meta'>>(cacheKey);
    if (fresh) return fresh;

    return dedupeInFlight(cacheKey, async () => {
      const url = new URL(cfg.apiUrl!);
      if (filters?.ticker) url.searchParams.set('symbol', filters.ticker);
      if (filters?.q) url.searchParams.set('q', filters.q);
      if (filters?.category && filters.category !== 'All') {
        url.searchParams.set('category', filters.category);
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        if (!res.ok) {
          lastError = `News endpoint returned HTTP ${res.status}.`;
          return {
            connected: false,
            provider: 'Configured News Endpoint',
            message: 'News feed temporarily unavailable.',
            articles: [],
            total: 0,
            categories: ['All'],
          };
        }
        const payload = (await res.json()) as {
          articles?: Record<string, unknown>[];
          data?: Record<string, unknown>[];
        };
        const rawArticles = Array.isArray(payload.articles)
          ? payload.articles
          : Array.isArray(payload.data)
          ? payload.data
          : [];

        const articles: NewsArticle[] = rawArticles.map((item, idx) => ({
          id: String(item.id ?? `news-${idx}`),
          title: String(item.title ?? 'Untitled market briefing'),
          summary: String(item.summary ?? item.description ?? ''),
          source: String(item.source ?? 'Market Wire'),
          publishedAt: String(
            item.publishedAt ?? item.published_at ?? new Date().toISOString()
          ),
          url: isSafeArticleUrl(item.url ?? item.link),
          category: String(item.category ?? 'Markets'),
          sentiment:
            item.sentiment === 'Bullish' ||
            item.sentiment === 'Bearish' ||
            item.sentiment === 'Neutral'
              ? item.sentiment
              : null,
          tickers: Array.isArray(item.tickers)
            ? item.tickers.map((t) => String(t).toUpperCase())
            : [],
        }));

        const categories = [
          'All',
          ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean))),
        ];
        lastSuccessAt = new Date().toISOString();
        lastError = null;

        const out: Omit<NewsListResponse, 'meta'> = {
          connected: true,
          provider: 'Configured News Feed',
          articles,
          total: articles.length,
          categories,
        };
        setCacheValue(cacheKey, out, 180_000);
        return out;
      } catch {
        lastError = 'Unable to reach configured news provider.';
        return {
          connected: false,
          provider: 'Configured News Endpoint',
          message: 'News feed temporarily unavailable.',
          articles: [],
          total: 0,
          categories: ['All'],
        };
      } finally {
        clearTimeout(timer);
      }
    });
  },
};

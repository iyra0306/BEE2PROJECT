import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Newspaper, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ApiErrorBanner } from '../components/ApiErrorBanner';
import { ArticleModal } from '../components/ArticleModal';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { NewsCard } from '../components/NewsCard';
import { useAppContext } from '../context/AppContext';
import { apiClient, isAbortError } from '../services/apiClient';
import { NewsArticle } from '../types/market';

export const NewsPage: React.FC = () => {
  const { dataMode } = useAppContext();
  const [category, setCategory] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const [connected, setConnected] = useState(false);
  const [providerName, setProviderName] = useState<string | null>(null);
  const [feedMessage, setFeedMessage] = useState<string | undefined>(undefined);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const reqIdRef = useRef(0);
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  useEffect(() => {
    const reqId = ++reqIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(
      async () => {
        try {
          const res = await apiClient.getNews(
            {
              category: category !== 'All' ? category : undefined,
              q: query.trim() || undefined,
              mode: dataMode,
            },
            controller.signal
          );
          if (reqId !== reqIdRef.current) return;
          setConnected(res.connected);
          setProviderName(res.provider);
          setFeedMessage(res.message);
          setArticles(res.articles);
          setCategories(res.categories.length > 0 ? res.categories : ['All']);
          setLoading(false);
        } catch (err) {
          if (isAbortError(err) || reqId !== reqIdRef.current) return;
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to query market news endpoint.'
          );
          setLoading(false);
        }
      },
      query.trim() ? 150 : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, query, dataMode, retryToken]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#91A197]">
            {dataMode === 'demo' && <DemoDataBadge compact />}
            <span>
              {connected
                ? `Market News · ${providerName ?? 'Configured Feed'}`
                : 'Market News · External News Feed'}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            Market News
          </h1>
        </div>
        <div className="text-xs font-mono-num text-[#91A197]">
          {connected
            ? `${articles.length} articles${loading ? ' · Updating...' : ''}`
            : loading
            ? 'Checking feed...'
            : 'Not connected'}
        </div>
      </div>

      {error ? (
        <ApiErrorBanner
          title="News feed unavailable"
          message={error}
          onRetry={retry}
        />
      ) : loading && !connected && articles.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      ) : !connected ? (
        <div className="rounded-xl border border-white/8 bg-[#18211C] p-10 text-center space-y-3">
          <Newspaper className="w-8 h-8 text-[#91A197] mx-auto" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
            {feedMessage || 'News feed not connected.'}
          </h2>
          <p className="text-xs text-[#91A197] max-w-md mx-auto leading-relaxed">
            Real data mode does not substitute simulated headlines. Configure{' '}
            <span className="font-mono-num text-[#E8F0EA]">NEWS_API_URL</span>{' '}
            (and optional{' '}
            <span className="font-mono-num text-[#E8F0EA]">NEWS_API_KEY</span>) on
            the server or switch to Demo mode to browse sample articles.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="rounded-xl border border-white/8 bg-[#18211C] p-4 space-y-3">
            <div className="relative max-w-md">
              <label htmlFor="news-search" className="sr-only">
                Search news articles or tickers
              </label>
              <Search
                className="w-4 h-4 text-[#91A197] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="news-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search headlines or tickers (e.g. NVDA, INFY)..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA] placeholder:text-[#91A197]/70 focus:border-[#36C982] focus:outline-none"
              />
            </div>

            {categories.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      category === cat
                        ? 'border-[#36C982]/40 text-[#A5EBC3]'
                        : 'bg-[#141C17] border-white/8 text-[#91A197] hover:text-[#E8F0EA]'
                    }`}
                  >
                    {category === cat && (
                      <motion.span
                        layoutId="news-category-pill"
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 rounded-lg bg-[#214B37]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="relative z-10">{cat}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${query.trim()}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {articles.length === 0 ? (
                <div className="rounded-xl border border-white/8 bg-[#18211C] p-10 text-center space-y-2">
                  <p className="text-sm text-[#E8F0EA]">
                    No articles match your current filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('All');
                      setQuery('');
                    }}
                    className="text-xs text-[#A5EBC3] underline"
                  >
                    Reset news filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {articles.map((article) => (
                    <NewsCard
                      key={article.id}
                      article={article}
                      onOpen={setActiveArticle}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      <ArticleModal
        article={activeArticle}
        onClose={() => setActiveArticle(null)}
      />
    </div>
  );
};

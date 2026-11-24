import React, { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { NewsArticle } from '../types/market';

interface ArticleModalProps {
  article: NewsArticle | null;
  onClose: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ article, onClose }) => {
  useEffect(() => {
    if (!article) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [article, onClose]);

  return (
    <AnimatePresence>
      {article && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="article-modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#18211C] p-6 sm:p-8 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="text-xs text-[#91A197] flex flex-wrap items-center gap-2">
                <span>{article.source}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{article.publishedAt}</span>
                {article.readTime && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{article.readTime}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close article"
                className="p-2 rounded-lg border border-white/10 bg-[#141C17] text-[#91A197] hover:text-[#E8F0EA] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2
              id="article-modal-title"
              className="text-xl sm:text-2xl font-bold font-display text-[#E8F0EA] leading-snug"
            >
              {article.title}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-[#91A197]">
                Category: <strong className="text-[#E8F0EA]">{article.category}</strong>
              </span>
              {article.sentiment && (
                <>
                  <span aria-hidden="true" className="text-[#91A197]">
                    ·
                  </span>
                  <span className="text-[#91A197]">
                    Sentiment:{' '}
                    <strong
                      className={
                        article.sentiment === 'Bullish'
                          ? 'text-[#36C982]'
                          : article.sentiment === 'Bearish'
                          ? 'text-[#E06C65]'
                          : 'text-[#D4A857]'
                      }
                    >
                      {article.sentiment}
                    </strong>
                  </span>
                </>
              )}
            </div>

            <div className="mt-6 space-y-4 text-sm sm:text-base text-[#E8F0EA]/90 leading-relaxed">
              {article.body && article.body.length > 0 ? (
                article.body.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
              ) : (
                <p>{article.summary}</p>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-white/8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {article.tickers.length > 0 && (
                  <span className="text-[#91A197]">Referenced Tickers:</span>
                )}
                {article.tickers.map((t) => (
                  <Link
                    key={t}
                    to={`/app/stock/${t}`}
                    onClick={onClose}
                    className="px-2.5 py-1 rounded-md bg-[#141C17] border border-white/8 font-mono-num text-[#A5EBC3] hover:border-[#36C982]/50 transition-colors"
                  >
                    {t}
                  </Link>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/12 bg-[#141C17] text-xs font-semibold text-[#A5EBC3] hover:border-[#36C982]/50 transition-colors"
                  >
                    Open Original Article
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold hover:bg-[#A5EBC3] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

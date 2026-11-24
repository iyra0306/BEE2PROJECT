import React from 'react';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NewsArticle } from '../types/market';

interface NewsCardProps {
  article: NewsArticle;
  onOpen: (article: NewsArticle) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({ article, onOpen }) => {
  const sentimentColor =
    article.sentiment === 'Bullish'
      ? 'text-[#36C982]'
      : article.sentiment === 'Bearish'
      ? 'text-[#E06C65]'
      : 'text-[#D4A857]';

  return (
    <article
      data-cursor="card"
      className="rounded-xl border border-white/8 bg-[#18211C] hover:border-white/18 transition-colors p-5 flex flex-col justify-between gap-4"
    >
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#91A197] mb-2.5">
          <span>{article.source}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-num">{article.publishedAt}</span>
          {article.category && (
            <>
              <span aria-hidden="true">·</span>
              <span>{article.category}</span>
            </>
          )}
          {article.sentiment && (
            <>
              <span aria-hidden="true">·</span>
              <span className={`font-medium ${sentimentColor}`}>
                {article.sentiment}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpen(article)}
          className="text-left group focus-visible:outline-none"
        >
          <h3 className="text-base font-semibold font-display text-[#E8F0EA] group-hover:text-[#A5EBC3] transition-colors leading-snug">
            {article.title}
          </h3>
        </button>

        {article.summary && (
          <p className="mt-2 text-sm text-[#91A197] leading-relaxed line-clamp-2">
            {article.summary}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-white/6 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {article.tickers.map((t) => (
            <Link
              key={t}
              to={`/app/stock/${t}`}
              className="font-mono-num text-[#A5EBC3] hover:underline"
            >
              {t}
            </Link>
          ))}
        </div>

        {article.url ? (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#E8F0EA] hover:text-[#36C982] transition-colors whitespace-nowrap shrink-0"
          >
            Source
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(article)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#E8F0EA] hover:text-[#36C982] transition-colors whitespace-nowrap shrink-0"
          >
            Read brief
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
};

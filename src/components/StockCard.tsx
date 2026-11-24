import React from 'react';
import { ArrowDownRight, ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { StockRecord } from '../types/market';
import {
  formatCurrency,
  formatMarketCap,
  formatProviderTimestamp,
  formatSignedPercent,
} from '../utils/formatters';
import { FeedStatusBadge } from './FeedStatusBadge';
import { Sparkline } from './Sparkline';

interface StockCardProps {
  stock: StockRecord;
  compact?: boolean;
}

export const StockCard: React.FC<StockCardProps> = ({ stock, compact = false }) => {
  const { isInWatchlist, toggleWatchlist, preferences, fxUsdToInr } =
    useAppContext();
  const saved = isInWatchlist(stock.ticker);
  const hasPrice = stock.price !== null && Number.isFinite(stock.price);
  const isPositive = (stock.change ?? 0) >= 0;

  return (
    <div
      data-cursor="card"
      className="group rounded-xl border border-white/8 bg-[#18211C] hover:border-white/18 hover:bg-[#1C2620] transition-colors duration-150 p-4 flex flex-col justify-between gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/app/stock/${stock.ticker}`}
          className="min-w-0 flex-1 focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#91A197]">
            <span className="font-semibold text-[#E8F0EA] group-hover:text-[#A5EBC3] transition-colors">
              {stock.normalizedSymbol}
            </span>
            <span aria-hidden="true">·</span>
            <span>{stock.currency}</span>
          </div>
          <h3 className="text-sm font-medium text-[#E8F0EA] truncate mt-0.5">
            {stock.name}
          </h3>
        </Link>

        <button
          type="button"
          onClick={() => toggleWatchlist(stock.ticker)}
          aria-label={
            saved
              ? `Remove ${stock.ticker} from watchlist`
              : `Add ${stock.ticker} to watchlist`
          }
          className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
            saved
              ? 'border-[#36C982]/40 bg-[#214B37]/60 text-[#A5EBC3]'
              : 'border-white/8 bg-[#141C17] text-[#91A197] hover:text-[#E8F0EA]'
          }`}
        >
          <Star
            className="w-3.5 h-3.5"
            fill={saved ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <Link
        to={`/app/stock/${stock.ticker}`}
        className="flex items-end justify-between gap-3"
      >
        {hasPrice ? (
          <div>
            <div className="text-lg font-bold font-mono-num text-[#E8F0EA]">
              {formatCurrency(
                stock.price,
                stock.currency,
                preferences.currencyMode,
                2,
                fxUsdToInr
              )}
            </div>
            <div
              className={`mt-0.5 inline-flex items-center gap-1 text-xs font-mono-num font-medium ${
                isPositive ? 'text-[#36C982]' : 'text-[#E06C65]'
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{formatSignedPercent(stock.changePercent)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="text-sm font-mono-num font-semibold text-[#91A197]">
              Unavailable
            </div>
            <div className="text-[11px] text-[#91A197]/80 line-clamp-1">
              {stock.unavailableReason ??
                (stock.provider === 'GFDL'
                  ? 'Indian market feed not connected'
                  : 'US market feed not connected')}
            </div>
          </div>
        )}

        {stock.sparkline.length > 1 ? (
          <Sparkline
            data={stock.sparkline}
            positive={isPositive}
            width={80}
            height={28}
          />
        ) : (
          <FeedStatusBadge
            status={stock.feedStatus}
            stale={stock.stale}
            provider={stock.provider}
            compact
          />
        )}
      </Link>

      {!compact && (
        <div className="pt-2.5 border-t border-white/6 flex items-center justify-between gap-2 text-[11px] text-[#91A197]">
          <span className="truncate">{stock.sector}</span>
          <span className="font-mono-num shrink-0">
            {stock.marketCap
              ? `Cap ${formatMarketCap(
                  stock.marketCap,
                  stock.currency,
                  preferences.currencyMode,
                  fxUsdToInr
                )}`
              : formatProviderTimestamp(stock.providerTimestamp)}
          </span>
        </div>
      )}
    </div>
  );
};

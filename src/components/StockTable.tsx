import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Star,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';
import type { StockRecord } from '../types/market';
import {
  formatCurrency,
  formatMarketCap,
  formatProviderTimestamp,
  formatSignedPercent,
  formatVolume,
} from '../utils/formatters';
import { FeedStatusBadge } from './FeedStatusBadge';

export type SortKey =
  | 'ticker'
  | 'market'
  | 'price'
  | 'changePercent'
  | 'volume'
  | 'marketCap';

interface StockTableProps {
  stocks: StockRecord[];
  compact?: boolean;
  emptyMessage?: string;
}

export const StockTable: React.FC<StockTableProps> = ({
  stocks,
  compact = false,
  emptyMessage = 'No matching equities found.',
}) => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotionSafe();
  const { isInWatchlist, toggleWatchlist, preferences, fxUsdToInr } =
    useAppContext();
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedStocks = useMemo(() => {
    const copy = [...stocks];
    copy.sort((a, b) => {
      if (sortKey === 'ticker') {
        return (a.ticker.localeCompare(b.ticker)) * (sortDir === 'asc' ? 1 : -1);
      }
      if (sortKey === 'market') {
        return (a.market.localeCompare(b.market)) * (sortDir === 'asc' ? 1 : -1);
      }

      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === 'number' && Number.isFinite(av) ? av : null;
      const bn = typeof bv === 'number' && Number.isFinite(bv) ? bv : null;
      if (an === null && bn === null) return a.ticker.localeCompare(b.ticker);
      if (an === null) return 1;
      if (bn === null) return -1;
      return (an - bn) * (sortDir === 'asc' ? 1 : -1);
    });
    return copy;
  }, [stocks, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'ticker' || key === 'market' ? 'asc' : 'desc');
    }
  };

  if (stocks.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-[#18211C] p-10 text-center text-sm text-[#91A197]">
        {emptyMessage}
      </div>
    );
  }

  const rowPy = compact || preferences.compactTables ? 'py-2.5' : 'py-3.5';

  const HeaderButton = ({
    label,
    colKey,
    align = 'right',
  }: {
    label: string;
    colKey: SortKey;
    align?: 'left' | 'right';
  }) => (
    <button
      type="button"
      onClick={() => handleSort(colKey)}
      className={`inline-flex items-center gap-1 text-xs font-medium text-[#91A197] hover:text-[#E8F0EA] transition-colors duration-150 whitespace-nowrap ${
        align === 'right' ? 'justify-end ml-auto' : 'justify-start'
      }`}
    >
      <span>{label}</span>
      <ArrowUpDown
        className={`w-3 h-3 ${
          sortKey === colKey ? 'text-[#36C982]' : 'opacity-50'
        }`}
        aria-hidden="true"
      />
    </button>
  );

  return (
    <div className="rounded-xl border border-white/8 bg-[#18211C] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left border-collapse">
          <thead>
            <tr className="border-b border-white/8 bg-[#141C17]">
              <th className="px-4 py-3 text-xs font-medium text-[#91A197] w-10">
                <span className="sr-only">Watchlist</span>
              </th>
              <th className="px-4 py-3">
                <HeaderButton label="Symbol / Company" colKey="ticker" align="left" />
              </th>
              <th className="px-4 py-3">
                <HeaderButton label="Exchange" colKey="market" align="left" />
              </th>
              <th className="px-4 py-3 text-right">
                <HeaderButton label="Price" colKey="price" />
              </th>
              <th className="px-4 py-3 text-right">
                <HeaderButton label="Daily Change" colKey="changePercent" />
              </th>
              <th className="px-4 py-3 text-right">
                <HeaderButton label="Volume" colKey="volume" />
              </th>
              <th className="px-4 py-3 text-right">
                <HeaderButton label="Market Cap" colKey="marketCap" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[#91A197]">
                Feed / Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {sortedStocks.map((stock) => {
              const saved = isInWatchlist(stock.ticker);
              const hasPrice = stock.price !== null && Number.isFinite(stock.price);
              const isPos = (stock.change ?? 0) >= 0;
              return (
                <motion.tr
                  key={stock.ticker}
                  layout={reducedMotion ? false : 'position'}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => navigate(`/app/stock/${stock.ticker}`)}
                  className="hover:bg-[#202B24]/75 transition-colors duration-150 cursor-pointer group"
                >
                  <td
                    className={`px-4 ${rowPy}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => toggleWatchlist(stock.ticker)}
                      aria-label={
                        saved
                          ? `Remove ${stock.ticker} from watchlist`
                          : `Add ${stock.ticker} to watchlist`
                      }
                      className={`p-1.5 rounded-md transition-colors duration-150 ${
                        saved
                          ? 'text-[#36C982] bg-[#214B37]/60'
                          : 'text-[#91A197] hover:text-[#E8F0EA]'
                      }`}
                    >
                      <Star
                        className="w-3.5 h-3.5"
                        fill={saved ? 'currentColor' : 'none'}
                      />
                    </button>
                  </td>
                  <td className={`px-4 ${rowPy}`}>
                    <div className="font-semibold text-sm text-[#E8F0EA] group-hover:text-[#A5EBC3] transition-colors font-mono-num">
                      {stock.normalizedSymbol}
                    </div>
                    <div className="text-xs text-[#91A197] truncate max-w-[210px]">
                      {stock.name}
                    </div>
                  </td>
                  <td className={`px-4 ${rowPy}`}>
                    <div className="text-xs text-[#E8F0EA]">
                      {stock.exchange} · {stock.currency}
                    </div>
                    <div className="text-[11px] text-[#91A197]">
                      {stock.sector}
                    </div>
                  </td>
                  <td
                    className={`px-4 ${rowPy} text-right font-mono-num text-sm font-medium whitespace-nowrap ${
                      hasPrice ? 'text-[#E8F0EA]' : 'text-[#91A197]'
                    }`}
                  >
                    {formatCurrency(
                      stock.price,
                      stock.currency,
                      preferences.currencyMode,
                      2,
                      fxUsdToInr
                    )}
                  </td>
                  <td className={`px-4 ${rowPy} text-right whitespace-nowrap`}>
                    {stock.changePercent !== null ? (
                      <span
                        className={`inline-flex items-center justify-end gap-1 font-mono-num text-xs font-medium ${
                          isPos ? 'text-[#36C982]' : 'text-[#E06C65]'
                        }`}
                      >
                        {isPos ? (
                          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        {formatSignedPercent(stock.changePercent)}
                      </span>
                    ) : (
                      <span className="font-mono-num text-xs text-[#91A197]">
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 ${rowPy} text-right font-mono-num text-xs text-[#91A197] whitespace-nowrap`}
                  >
                    {formatVolume(stock.volume)}
                  </td>
                  <td
                    className={`px-4 ${rowPy} text-right font-mono-num text-xs text-[#91A197] whitespace-nowrap`}
                  >
                    {formatMarketCap(
                      stock.marketCap,
                      stock.currency,
                      preferences.currencyMode,
                      fxUsdToInr
                    )}
                  </td>
                  <td className={`px-4 ${rowPy} text-right whitespace-nowrap`}>
                    <div className="flex flex-col items-end gap-0.5">
                      <FeedStatusBadge
                        status={stock.feedStatus}
                        stale={stock.stale}
                        provider={stock.provider}
                        compact
                      />
                      <span className="text-[10px] font-mono-num text-[#91A197]">
                        {formatProviderTimestamp(stock.providerTimestamp)}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';
import type { MarketIndex } from '../types/market';
import {
  formatIndexValue,
  formatProviderTimestamp,
  formatSignedPercent,
} from '../utils/formatters';
import { FeedStatusBadge } from './FeedStatusBadge';
import { Sparkline } from './Sparkline';

interface MarketIndexCardProps {
  index: MarketIndex;
  active?: boolean;
  onSelect?: (index: MarketIndex) => void;
  compact?: boolean;
}

export const MarketIndexCard: React.FC<MarketIndexCardProps> = ({
  index,
  active = false,
  onSelect,
  compact = false,
}) => {
  const isAvailable = index.value !== null && Number.isFinite(index.value);
  const isPositive = (index.change ?? 0) >= 0;
  const reducedMotion = useReducedMotionSafe();
  const [displayValue, setDisplayValue] = useState<number | null>(() => {
    if (!isAvailable || index.value === null) return null;
    return reducedMotion ? index.value : index.value * 0.985;
  });
  const hasAnimatedRef = useRef(false);

  // Animate value once on first load when numeric data exists; keep steady afterward
  useEffect(() => {
    if (!isAvailable || index.value === null) {
      setDisplayValue(null);
      return;
    }
    const targetValue = index.value;
    if (reducedMotion || hasAnimatedRef.current) {
      setDisplayValue(targetValue);
      return;
    }
    hasAnimatedRef.current = true;
    const startVal = targetValue * 0.985;
    const duration = 450;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (targetValue - startVal) * eased);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(targetValue);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [index.value, isAvailable, reducedMotion]);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(index)}
      data-cursor="card"
      className={`w-full text-left rounded-xl transition-[background-color,border-color] duration-150 border ${
        compact ? 'px-3.5 py-3' : 'p-4'
      } ${
        active
          ? 'bg-[#202B24] border-[#36C982]/55'
          : 'bg-[#18211C] border-white/8 hover:border-white/20 hover:bg-[#1C2721]'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#91A197]">
            <span className="font-semibold text-[#E8F0EA]">
              {index.normalizedSymbol}
            </span>
            <span aria-hidden="true">·</span>
            <span>{index.currency}</span>
          </div>
          <p className="text-[11px] text-[#91A197] truncate mt-0.5">{index.name}</p>
        </div>
        <FeedStatusBadge
          status={index.feedStatus}
          stale={index.stale}
          provider={index.provider}
          compact
        />
      </div>

      {isAvailable ? (
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-lg sm:text-xl font-bold font-mono-num text-[#E8F0EA] tracking-tight">
              {formatIndexValue(displayValue, index.currency)}
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
              <span>{formatSignedPercent(index.changePercent)}</span>
            </div>
          </div>

          {index.sparkline.length > 1 && (
            <Sparkline
              data={index.sparkline}
              positive={isPositive}
              width={compact ? 76 : 84}
              height={compact ? 26 : 30}
              animateOnMount
            />
          )}
        </div>
      ) : (
        <div className="pt-1 space-y-1">
          <div className="text-sm font-mono-num font-semibold text-[#91A197]">
            {index.provider === 'GFDL'
              ? 'Indian market feed not connected'
              : 'Feed Unavailable'}
          </div>
          <p className="text-[11px] text-[#91A197]/85 line-clamp-2 leading-snug">
            {index.unavailableReason ??
              `${index.provider} quote unavailable for ${index.symbol}.`}
          </p>
        </div>
      )}

      <div className="mt-2 pt-1.5 border-t border-white/6 flex items-center justify-between text-[10px] font-mono-num text-[#91A197]">
        <span>{index.provider}</span>
        <span className="truncate max-w-[140px]">
          {formatProviderTimestamp(index.providerTimestamp)}
        </span>
      </div>
    </button>
  );
};

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ApiErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const ApiErrorBanner: React.FC<ApiErrorBannerProps> = ({
  title = 'Unable to load market data',
  message,
  onRetry,
  compact = false,
}) => {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-[#E06C65]/35 bg-[#18211C] ${
        compact ? 'p-4' : 'p-6'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="w-5 h-5 text-[#E06C65] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold font-display text-[#E8F0EA]">
            {title}
          </h2>
          <p className="text-xs text-[#91A197] leading-relaxed">{message}</p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/12 bg-[#141C17] text-xs font-semibold text-[#E8F0EA] hover:border-[#36C982]/50 hover:text-[#A5EBC3] transition-colors shrink-0 self-start sm:self-center whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry Request
        </button>
      )}
    </div>
  );
};

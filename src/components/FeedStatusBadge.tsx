import React from 'react';
import type { FeedStatus } from '../types/market';

interface FeedStatusBadgeProps {
  status: FeedStatus;
  stale?: boolean;
  provider?: string;
  compact?: boolean;
}

export const FeedStatusBadge: React.FC<FeedStatusBadgeProps> = ({
  status,
  stale = false,
  provider,
  compact = false,
}) => {
  const dotColor =
    stale
      ? 'bg-[#D4A857]'
      : status === 'Live'
      ? 'bg-[#36C982]'
      : status === 'Demo'
      ? 'bg-[#A5EBC3]'
      : status === 'Delayed' || status === 'End of day'
      ? 'bg-[#D4A857]'
      : 'bg-[#91A197]/60';

  const textColor =
    stale
      ? 'text-[#D4A857]'
      : status === 'Live'
      ? 'text-[#36C982]'
      : status === 'Demo'
      ? 'text-[#A5EBC3]'
      : status === 'Delayed' || status === 'End of day'
      ? 'text-[#D4A857]'
      : 'text-[#91A197]';

  const baseLabel = status === 'Demo' ? 'Demo data' : status;
  const label = stale ? `Stale · ${baseLabel}` : baseLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono-num ${
        compact ? 'text-[10px]' : 'text-[11px]'
      } ${textColor}`}
      title={provider ? `Feed: ${provider} (${label})` : label}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
};

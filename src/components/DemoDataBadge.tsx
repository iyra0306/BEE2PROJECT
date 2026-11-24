import React from 'react';
import { FlaskConical } from 'lucide-react';

interface DemoDataBadgeProps {
  compact?: boolean;
  label?: string;
}

export const DemoDataBadge: React.FC<DemoDataBadgeProps> = ({
  compact = false,
  label = 'Demo data',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-[#D4A857]/35 bg-[#D4A857]/12 font-mono-num font-medium text-[#E9C98A] whitespace-nowrap shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      }`}
      title="Displaying simulated demo market data (zero external credentials required)"
    >
      <FlaskConical className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

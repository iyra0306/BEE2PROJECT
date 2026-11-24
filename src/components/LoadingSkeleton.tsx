import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'card' | 'chart' | 'table' | 'line';
  rows?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  rows = 5,
  className = '',
}) => {
  if (variant === 'chart') {
    return (
      <div
        className={`rounded-xl border border-white/8 bg-[#18211C] p-5 ${className}`}
        aria-busy="true"
        aria-label="Loading chart"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="h-5 w-40 rounded bg-[#202B24]" />
          <div className="flex gap-2">
            <div className="h-7 w-12 rounded bg-[#202B24]" />
            <div className="h-7 w-12 rounded bg-[#202B24]" />
            <div className="h-7 w-12 rounded bg-[#202B24]" />
          </div>
        </div>
        <div className="h-64 w-full rounded-lg bg-[#141C17] border border-white/5" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div
        className={`rounded-xl border border-white/8 bg-[#18211C] overflow-hidden ${className}`}
        aria-busy="true"
        aria-label="Loading table"
      >
        <div className="border-b border-white/8 px-4 py-3 flex gap-4">
          <div className="h-4 w-24 rounded bg-[#202B24]" />
          <div className="h-4 w-32 rounded bg-[#202B24]" />
          <div className="h-4 w-20 rounded bg-[#202B24] ml-auto" />
        </div>
        <div className="divide-y divide-white/6">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 flex items-center gap-4">
              <div className="h-4 w-16 rounded bg-[#202B24]" />
              <div className="h-4 w-40 rounded bg-[#202B24]" />
              <div className="h-4 w-20 rounded bg-[#202B24] ml-auto" />
              <div className="h-4 w-16 rounded bg-[#202B24]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'line') {
    return (
      <div className={`space-y-2.5 ${className}`} aria-busy="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-[#202B24]" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-white/8 bg-[#18211C] p-5 space-y-3 ${className}`}
      aria-busy="true"
      aria-label="Loading card"
    >
      <div className="h-4 w-24 rounded bg-[#202B24]" />
      <div className="h-7 w-32 rounded bg-[#202B24]" />
      <div className="h-10 w-full rounded bg-[#141C17]" />
    </div>
  );
};

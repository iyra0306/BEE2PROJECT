import React, { useId } from 'react';
import { motion } from 'motion/react';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';

interface SparklineProps {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
  animateOnMount?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  positive = true,
  width = 88,
  height = 28,
  className = '',
  animateOnMount = false,
}) => {
  const uid = useId();
  const reducedMotion = useReducedMotionSafe();

  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className={`flex items-center justify-center text-[10px] text-[#91A197] ${className}`}
      >
        —
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;

  const coords = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((val - min) / span) * (height - pad * 2);
    return { x, y };
  });

  const pathD = coords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPoints = `${pad},${height} ${coords
    .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ')} ${width - pad},${height}`;

  const strokeColor = positive ? '#36C982' : '#E06C65';
  const fillId = `spark-fill-${uid.replace(/:/g, '')}`;
  const shouldAnimate = animateOnMount && !reducedMotion;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.24" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {shouldAnimate ? (
        <motion.polygon
          points={areaPoints}
          fill={`url(#${fillId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.15 }}
        />
      ) : (
        <polygon points={areaPoints} fill={`url(#${fillId})`} />
      )}

      {shouldAnimate ? (
        <motion.path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      ) : (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.65"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

import React, { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { useReducedMotionSafe } from '../hooks/useReducedMotionSafe';
import { SignalType } from '../types/market';

interface NeuralGraphicProps {
  signal?: SignalType;
  confidence?: number;
  compact?: boolean;
  pulseKey?: string;
}

export const NeuralGraphic: React.FC<NeuralGraphicProps> = ({
  signal = 'Bullish',
  confidence = 72,
  compact = false,
  pulseKey = 'default',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.35 });
  const reducedMotion = useReducedMotionSafe();

  const accent =
    signal === 'Bullish'
      ? '#36C982'
      : signal === 'Bearish'
      ? '#E06C65'
      : '#D4A857';

  const layers = [
    [34, 72, 110, 148],
    [24, 58, 92, 126, 160],
    [42, 92, 142],
    [65, 118],
    [92],
  ];
  const xCoords = [36, 112, 194, 272, 344];

  // Primary highlighted signal path indices across the 5 layers
  const signalPathNodes = [1, 2, 1, 0, 0];
  const shouldAnimate = !reducedMotion && inView;

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-white/8 bg-[#141C17] p-4 overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#91A197]">
          Sequence Feature Topology · Illustrative
        </span>
        <span className="text-xs font-mono-num text-[#E8F0EA]">
          {confidence}% demo score
        </span>
      </div>

      <svg
        key={pulseKey}
        viewBox="0 0 380 184"
        className={`w-full ${compact ? 'h-32' : 'h-44'}`}
        role="img"
        aria-label="Illustrative neural network architecture diagram"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background Connecting Synapses */}
        {layers.slice(0, -1).map((layerYs, lIdx) => {
          const nextYs = layers[lIdx + 1];
          return layerYs.map((y1, i) =>
            nextYs.map((y2, j) => {
              const isSignalEdge =
                signalPathNodes[lIdx] === i && signalPathNodes[lIdx + 1] === j;
              if (isSignalEdge) return null;
              const active = (i + j + lIdx) % 3 === 0;
              return (
                <line
                  key={`${lIdx}-${i}-${j}`}
                  x1={xCoords[lIdx]}
                  y1={y1}
                  x2={xCoords[lIdx + 1]}
                  y2={y2}
                  stroke={active ? accent : 'rgba(232,240,234,0.12)'}
                  strokeOpacity={active ? 0.34 : 0.4}
                  strokeWidth={active ? 1.15 : 0.75}
                />
              );
            })
          );
        })}

        {/* Primary Signal Path that lights up sequentially */}
        {layers.slice(0, -1).map((_, lIdx) => {
          const y1 = layers[lIdx][signalPathNodes[lIdx]];
          const y2 = layers[lIdx + 1][signalPathNodes[lIdx + 1]];
          const d = `M ${xCoords[lIdx]} ${y1} L ${xCoords[lIdx + 1]} ${y2}`;
          return shouldAnimate ? (
            <motion.path
              key={`sig-${lIdx}`}
              d={d}
              fill="none"
              stroke="#A5EBC3"
              strokeWidth="2.1"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 0.95 }}
              transition={{
                duration: 0.28,
                delay: lIdx * 0.14,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ) : (
            <path
              key={`sig-${lIdx}`}
              d={d}
              fill="none"
              stroke="#A5EBC3"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeOpacity="0.9"
            />
          );
        })}

        {/* Layer Nodes */}
        {layers.map((layerYs, lIdx) =>
          layerYs.map((y, idx) => {
            const isOutput = lIdx === layers.length - 1;
            const onPath = signalPathNodes[lIdx] === idx;
            return (
              <g key={`n-${lIdx}-${idx}`}>
                {(isOutput || onPath) && (
                  <motion.circle
                    cx={xCoords[lIdx]}
                    cy={y}
                    r={isOutput ? 18 : 11}
                    fill="url(#nodeGlow)"
                    initial={shouldAnimate ? { opacity: 0 } : false}
                    animate={{ opacity: onPath || isOutput ? 0.9 : 0.4 }}
                    transition={{ duration: 0.25, delay: lIdx * 0.14 }}
                  />
                )}
                <motion.circle
                  cx={xCoords[lIdx]}
                  cy={y}
                  r={isOutput ? 7 : onPath ? 5.2 : 4.2}
                  fill={isOutput || onPath ? accent : '#18211C'}
                  stroke={isOutput || onPath ? '#A5EBC3' : accent}
                  strokeWidth={isOutput || onPath ? 2 : 1.2}
                  initial={shouldAnimate && onPath ? { scale: 0.75, opacity: 0.4 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.24, delay: lIdx * 0.14 }}
                />
              </g>
            );
          })
        )}

        {/* Layer Labels */}
        <text x="36" y="176" textAnchor="middle" fill="#91A197" fontSize="9">
          OHLCV
        </text>
        <text x="112" y="176" textAnchor="middle" fill="#91A197" fontSize="9">
          Momentum
        </text>
        <text x="194" y="176" textAnchor="middle" fill="#91A197" fontSize="9">
          Regime
        </text>
        <text x="272" y="176" textAnchor="middle" fill="#91A197" fontSize="9">
          Fusion
        </text>
        <text x="344" y="176" textAnchor="middle" fill={accent} fontSize="9">
          {signal}
        </text>
      </svg>
    </div>
  );
};

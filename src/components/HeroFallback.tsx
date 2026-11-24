import React from 'react';

export const HeroFallback: React.FC = () => {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none bg-[#101512]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 60% at 72% 45%, rgba(33, 75, 55, 0.34) 0%, rgba(16, 21, 18, 0.94) 72%, #101512 100%)',
        }}
      />
      <svg
        viewBox="0 0 1200 680"
        className="w-full h-full opacity-75"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="bullsight-grid-fallback"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(54, 201, 130, 0.08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="1200" height="680" fill="url(#bullsight-grid-fallback)" />

        {/* Sculptural Static Bull Silhouette Formed by Emerald Market Traces */}
        <g transform="translate(520, 75)">
          {/* Sweeping Right & Left Horns */}
          <path
            d="M 250 185 C 320 120, 415 95, 495 35"
            fill="none"
            stroke="#A5EBC3"
            strokeWidth="2.4"
            strokeOpacity="0.85"
          />
          <path
            d="M 240 198 C 318 138, 405 112, 480 54"
            fill="none"
            stroke="#36C982"
            strokeWidth="1.4"
            strokeOpacity="0.55"
          />
          <path
            d="M 190 175 C 125 115, 95 68, 128 22"
            fill="none"
            stroke="#A5EBC3"
            strokeWidth="2.2"
            strokeOpacity="0.75"
          />

          {/* Cranial Crest, Snout & Charging Shoulder Traces */}
          <path
            d="M 250 185 C 195 210, 145 268, 118 335 C 145 365, 205 385, 285 410 C 375 435, 455 415, 515 355"
            fill="rgba(33, 75, 55, 0.25)"
            stroke="#36C982"
            strokeWidth="2"
            strokeOpacity="0.8"
          />
          <path
            d="M 250 185 C 335 162, 435 180, 525 260 C 545 295, 540 335, 515 355"
            fill="none"
            stroke="#A5EBC3"
            strokeWidth="1.8"
            strokeOpacity="0.7"
          />
          <path
            d="M 188 242 C 275 235, 375 260, 468 330"
            fill="none"
            stroke="#36C982"
            strokeWidth="1.2"
            strokeOpacity="0.5"
          />

          {/* Trace Vertex Nodes */}
          {[
            [495, 35],
            [128, 22],
            [250, 185],
            [118, 335],
            [285, 410],
            [525, 260],
          ].map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r="4"
              fill="#A5EBC3"
              fillOpacity="0.9"
            />
          ))}
        </g>

        {/* Subdued Candlestick Silhouette */}
        {[
          { x: 640, top: 410, h: 75, bull: true },
          { x: 695, top: 385, h: 95, bull: true },
          { x: 750, top: 420, h: 65, bull: false },
          { x: 805, top: 365, h: 105, bull: true },
          { x: 860, top: 340, h: 90, bull: true },
          { x: 915, top: 315, h: 115, bull: true },
        ].map((c, idx) => (
          <g key={idx}>
            <line
              x1={c.x}
              y1={c.top - 22}
              x2={c.x}
              y2={c.top + c.h + 22}
              stroke="#91A197"
              strokeOpacity="0.3"
              strokeWidth="1.4"
            />
            <rect
              x={c.x - 9}
              y={c.top}
              width="18"
              height={c.h}
              rx="2"
              fill={c.bull ? '#36C982' : '#214B37'}
              fillOpacity={c.bull ? 0.35 : 0.6}
              stroke={c.bull ? '#A5EBC3' : '#36C982'}
              strokeOpacity="0.32"
            />
          </g>
        ))}
      </svg>
    </div>
  );
};

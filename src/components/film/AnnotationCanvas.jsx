import { useEffect, useRef } from 'react';

const COLOR_MAP = {
  red:    { stroke: '#EF4444', fill: '#EF444420', text: '#EF4444', glow: '#EF444460' },
  green:  { stroke: '#00FF87', fill: '#00FF8720', text: '#00FF87', glow: '#00FF8760' },
  yellow: { stroke: '#FBBF24', fill: '#FBBF2420', text: '#FBBF24', glow: '#FBBF2460' },
  blue:   { stroke: '#60A5FA', fill: '#60A5FA20', text: '#60A5FA', glow: '#60A5FA60' },
  white:  { stroke: '#FFFFFF', fill: '#FFFFFF15', text: '#FFFFFF', glow: '#FFFFFF40' },
};

function ArrowMarker({ id, color }) {
  return (
    <marker
      id={id}
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill={color} />
    </marker>
  );
}

export default function AnnotationCanvas({ annotations = [], width = 640, height = 360, animated = true }) {
  const svgRef = useRef(null);

  if (!annotations || annotations.length === 0) return null;

  const toX = (pct) => (pct / 100) * width;
  const toY = (pct) => (pct / 100) * height;
  const toR = (pct) => (pct / 100) * width;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ zIndex: 10 }}
    >
      <defs>
        {/* Arrow markers for each color */}
        {Object.entries(COLOR_MAP).map(([name, c]) => (
          <ArrowMarker key={name} id={`arrow-${name}`} color={c.stroke} />
        ))}
        {/* Glow filters */}
        {Object.entries(COLOR_MAP).map(([name, c]) => (
          <filter key={`glow-${name}`} id={`glow-${name}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {annotations.map((ann, i) => {
        const c = COLOR_MAP[ann.color] || COLOR_MAP.white;
        const x = toX(ann.x);
        const y = toY(ann.y);
        const x2 = ann.x2 != null ? toX(ann.x2) : null;
        const y2 = ann.y2 != null ? toY(ann.y2) : null;
        const r = toR(ann.radius || 5);
        const pulse = ann.pulse && animated;

        if (ann.type === 'circle') {
          return (
            <g key={i} filter={`url(#glow-${ann.color || 'white'})`}>
              {pulse && (
                <circle cx={x} cy={y} r={r} fill="none" stroke={c.stroke} strokeWidth="2" opacity="0.5">
                  <animate attributeName="r" values={`${r};${r * 1.5};${r}`} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={x} cy={y} r={r}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth="2.5"
                strokeDasharray={ann.verdict === 'mistake' ? '6 3' : 'none'}
              />
              {ann.label && (
                <text
                  x={x} y={y - r - 6}
                  textAnchor="middle"
                  fill={c.text}
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                  style={{ textShadow: '0 1px 4px #000' }}
                >
                  {ann.label}
                </text>
              )}
            </g>
          );
        }

        if (ann.type === 'arrow' && x2 != null && y2 != null) {
          // Calculate angle for label placement
          const midX = (x + x2) / 2;
          const midY = (y + y2) / 2;
          return (
            <g key={i} filter={`url(#glow-${ann.color || 'white'})`}>
              <line
                x1={x} y1={y} x2={x2} y2={y2}
                stroke={c.stroke}
                strokeWidth="3"
                strokeLinecap="round"
                markerEnd={`url(#arrow-${ann.color || 'white'})`}
                strokeDasharray={ann.dashed ? '8 4' : 'none'}
              />
              {ann.label && (
                <text
                  x={midX} y={midY - 8}
                  textAnchor="middle"
                  fill={c.text}
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                >
                  {ann.label}
                </text>
              )}
            </g>
          );
        }

        if (ann.type === 'zone' && x2 != null && y2 != null) {
          const zx = Math.min(x, x2);
          const zy = Math.min(y, y2);
          const zw = Math.abs(x2 - x);
          const zh = Math.abs(y2 - y);
          return (
            <g key={i}>
              <rect
                x={zx} y={zy} width={zw} height={zh}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth="1.5"
                strokeDasharray="5 3"
                rx="4"
              />
              {ann.label && (
                <text
                  x={zx + zw / 2} y={zy + zh / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={c.text}
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="system-ui, sans-serif"
                >
                  {ann.label}
                </text>
              )}
            </g>
          );
        }

        if (ann.type === 'label') {
          return (
            <g key={i}>
              <rect
                x={x - 4} y={y - 14}
                width={ann.label ? ann.label.length * 6.5 + 8 : 60}
                height={20}
                fill="#0D1117CC"
                stroke={c.stroke}
                strokeWidth="1"
                rx="4"
              />
              <text
                x={x} y={y}
                fill={c.text}
                fontSize="11"
                fontWeight="bold"
                fontFamily="system-ui, sans-serif"
              >
                {ann.label}
              </text>
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}

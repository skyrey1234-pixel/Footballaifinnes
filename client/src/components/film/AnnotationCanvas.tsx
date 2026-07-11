type Annotation = {
  type: "circle" | "arrow" | "zone" | "label";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  width?: number;
  height?: number;
  color: "red" | "green" | "yellow" | "blue" | "white";
  label: string;
};

const colorMap: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#3b82f6",
  white: "#ffffff",
};

export default function AnnotationCanvas({ annotations }: { annotations: Annotation[] }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Arrow marker for each color */}
        {Object.entries(colorMap).map(([name, hex]) => (
          <marker
            key={name}
            id={`arrow-${name}`}
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={hex} />
          </marker>
        ))}
      </defs>

      {annotations.map((ann, i) => {
        const hex = colorMap[ann.color] || "#ffffff";

        switch (ann.type) {
          case "circle":
            return (
              <g key={i}>
                <circle
                  cx={ann.x}
                  cy={ann.y}
                  r={ann.radius || 5}
                  fill="none"
                  stroke={hex}
                  strokeWidth="0.4"
                  opacity="0.9"
                >
                  <animate
                    attributeName="r"
                    values={`${(ann.radius || 5) - 0.5};${(ann.radius || 5) + 0.5};${(ann.radius || 5) - 0.5}`}
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0.6;0.9"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                {ann.label && (
                  <text
                    x={ann.x}
                    y={ann.y - (ann.radius || 5) - 1.5}
                    textAnchor="middle"
                    fill={hex}
                    fontSize="2.5"
                    fontWeight="bold"
                    style={{ textShadow: "0 0 2px rgba(0,0,0,0.8)" }}
                  >
                    {ann.label}
                  </text>
                )}
              </g>
            );

          case "arrow":
            return (
              <g key={i}>
                <line
                  x1={ann.x}
                  y1={ann.y}
                  x2={ann.x2 || ann.x + 15}
                  y2={ann.y2 || ann.y}
                  stroke={hex}
                  strokeWidth="0.4"
                  markerEnd={`url(#arrow-${ann.color})`}
                  opacity="0.85"
                  strokeDasharray="1.5,0.5"
                />
                {ann.label && (
                  <text
                    x={(ann.x + (ann.x2 || ann.x + 15)) / 2}
                    y={((ann.y + (ann.y2 || ann.y)) / 2) - 2}
                    textAnchor="middle"
                    fill={hex}
                    fontSize="2"
                    fontWeight="bold"
                    style={{ textShadow: "0 0 2px rgba(0,0,0,0.8)" }}
                  >
                    {ann.label}
                  </text>
                )}
              </g>
            );

          case "zone":
            return (
              <g key={i}>
                <rect
                  x={ann.x}
                  y={ann.y}
                  width={ann.width || 20}
                  height={ann.height || 15}
                  fill={hex}
                  fillOpacity="0.12"
                  stroke={hex}
                  strokeWidth="0.3"
                  strokeDasharray="1,0.5"
                  rx="1"
                />
                {ann.label && (
                  <text
                    x={ann.x + (ann.width || 20) / 2}
                    y={ann.y + (ann.height || 15) / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={hex}
                    fontSize="2"
                    fontWeight="bold"
                    style={{ textShadow: "0 0 2px rgba(0,0,0,0.8)" }}
                  >
                    {ann.label}
                  </text>
                )}
              </g>
            );

          case "label":
            return (
              <g key={i}>
                <rect
                  x={ann.x - 1}
                  y={ann.y - 2.5}
                  width={ann.label.length * 1.4 + 2}
                  height="4"
                  fill="rgba(0,0,0,0.7)"
                  rx="0.5"
                />
                <text
                  x={ann.x}
                  y={ann.y}
                  fill={hex}
                  fontSize="2.2"
                  fontWeight="bold"
                  dominantBaseline="middle"
                >
                  {ann.label}
                </text>
              </g>
            );

          default:
            return null;
        }
      })}
    </svg>
  );
}


import { interpolateRoute } from "@/components/gameplan/FormationDiagram";
import type {
  TacticalTwinMarker,
  TacticalTwinPlayer,
  TacticalTwinPoint,
} from "@shared/tacticalTwin";
import { clampTwinCoordinate } from "@shared/tacticalTwin";
import { useCallback, useMemo, useState } from "react";

export type TwinEditorTool = "select" | "route" | "ball" | "mistake" | "correction" | "key";

type TacticalTwinMapProps = {
  players: TacticalTwinPlayer[];
  ballPath: TacticalTwinPoint[];
  markers: TacticalTwinMarker[];
  progress: number;
  selectedPlayerId: string | null;
  tool: TwinEditorTool;
  onSelectPlayer: (id: string) => void;
  onMovePlayer: (id: string, point: TacticalTwinPoint) => void;
  onAddRoutePoint: (id: string, point: TacticalTwinPoint) => void;
  onAddBallPoint: (point: TacticalTwinPoint) => void;
  onAddMarker: (kind: TacticalTwinMarker["kind"], point: TacticalTwinPoint) => void;
};

function pathData(start: TacticalTwinPoint, points: TacticalTwinPoint[]) {
  return [`M ${start.x} ${start.y}`, ...points.map((point) => `L ${point.x} ${point.y}`)].join(" ");
}

function interpolatePoints(points: TacticalTwinPoint[], progress: number) {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  const start = points[0];
  const remaining = points.slice(1).map((point) => [point.x, point.y] as [number, number]);
  return interpolateRoute(start.x, start.y, remaining, progress);
}

function eventPoint(event: React.PointerEvent<SVGSVGElement>): TacticalTwinPoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: clampTwinCoordinate(((event.clientX - bounds.left) / bounds.width) * 100),
    y: clampTwinCoordinate(((event.clientY - bounds.top) / bounds.height) * 100),
  };
}

export function TacticalTwinMap({
  players,
  ballPath,
  markers,
  progress,
  selectedPlayerId,
  tool,
  onSelectPlayer,
  onMovePlayer,
  onAddRoutePoint,
  onAddBallPoint,
  onAddMarker,
}: TacticalTwinMapProps) {
  const [draggingPlayerId, setDraggingPlayerId] = useState<string | null>(null);
  const selectedPlayer = players.find((item) => item.id === selectedPlayerId) ?? null;
  const ballPosition = useMemo(() => interpolatePoints(ballPath, progress), [ballPath, progress]);

  const handleFieldPointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget && (event.target as Element).closest("[data-player-node]")) return;
    const point = eventPoint(event);
    if (tool === "route" && selectedPlayerId) onAddRoutePoint(selectedPlayerId, point);
    if (tool === "ball") onAddBallPoint(point);
    if (tool === "mistake" || tool === "correction" || tool === "key") onAddMarker(tool, point);
    if (tool === "select" && selectedPlayerId) onMovePlayer(selectedPlayerId, point);
  }, [onAddBallPoint, onAddMarker, onAddRoutePoint, onMovePlayer, selectedPlayerId, tool]);

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingPlayerId) return;
    onMovePlayer(draggingPlayerId, eventPoint(event));
  }, [draggingPlayerId, onMovePlayer]);

  return (
    <div className="relative min-h-[520px] overflow-hidden border border-emerald-400/20 bg-[#06150e]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(16,185,129,0.14),transparent_45%)]" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="relative block min-h-[520px] w-full touch-none select-none"
        onPointerDown={handleFieldPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingPlayerId(null)}
        onPointerLeave={() => setDraggingPlayerId(null)}
        aria-label="Editable Tactical Twin football field"
      >
        <defs>
          <linearGradient id="twin-field" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0d3b27" />
            <stop offset="50%" stopColor="#082f1d" />
            <stop offset="100%" stopColor="#0b3a25" />
          </linearGradient>
          <filter id="twin-glow"><feGaussianBlur stdDeviation="0.7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <marker id="twin-arrow-offense" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#34d399" /></marker>
          <marker id="twin-arrow-defense" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#fb7185" /></marker>
          <marker id="twin-arrow-ball" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill="#fbbf24" /></marker>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#twin-field)" />
        {Array.from({ length: 11 }, (_, index) => index * 10).map((y) => (
          <g key={y}>
            <line x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.28)" strokeWidth="0.22" />
            {y > 0 && y < 100 ? <text x="2" y={y - 1} fill="rgba(255,255,255,0.32)" fontSize="2.1">{Math.abs(50 - y)}</text> : null}
          </g>
        ))}
        <line x1="0" x2="100" y1="50" y2="50" stroke="#fbbf24" strokeWidth="0.55" strokeDasharray="1.5 1" />
        {Array.from({ length: 20 }, (_, index) => index * 5 + 2.5).map((y) => (
          <g key={`hash-${y}`}>
            <line x1="44" x2="47" y1={y} y2={y} stroke="rgba(255,255,255,0.28)" strokeWidth="0.18" />
            <line x1="53" x2="56" y1={y} y2={y} stroke="rgba(255,255,255,0.28)" strokeWidth="0.18" />
          </g>
        ))}

        {players.map((player) => {
          if (player.route.length === 0) return null;
          const color = player.side === "offense" ? "#34d399" : "#fb7185";
          return (
            <path
              key={`route-${player.id}`}
              d={pathData(player, player.route)}
              fill="none"
              stroke={color}
              strokeWidth={selectedPlayerId === player.id ? 0.75 : 0.42}
              strokeDasharray={player.routeType === "zone" || player.routeType === "block" ? "1.4 1" : undefined}
              markerEnd={`url(#twin-arrow-${player.side})`}
              opacity={selectedPlayerId === player.id ? 1 : 0.48}
            />
          );
        })}

        {ballPath.length > 1 ? (
          <path d={pathData(ballPath[0], ballPath.slice(1))} fill="none" stroke="#fbbf24" strokeWidth="0.7" strokeDasharray="1.5 0.9" markerEnd="url(#twin-arrow-ball)" filter="url(#twin-glow)" />
        ) : null}

        {markers.map((marker) => {
          const color = marker.kind === "mistake" ? "#ef4444" : marker.kind === "correction" ? "#34d399" : "#fbbf24";
          return (
            <g key={marker.id}>
              <circle cx={marker.x} cy={marker.y} r="3.4" fill="none" stroke={color} strokeWidth="0.65" strokeDasharray="1 0.6" />
              <text x={marker.x} y={marker.y - 4.5} fill={color} fontSize="2" textAnchor="middle" fontWeight="700">{marker.label}</text>
            </g>
          );
        })}

        {players.map((player) => {
          const route = player.route.map((point) => [point.x, point.y] as [number, number]);
          const position = route.length > 0 ? interpolateRoute(player.x, player.y, route, progress) : player;
          const selected = selectedPlayerId === player.id;
          const offense = player.side === "offense";
          return (
            <g
              key={player.id}
              data-player-node
              role="button"
              tabIndex={0}
              aria-label={`${player.side} ${player.label}`}
              transform={`translate(${position.x} ${position.y})`}
              className="cursor-grab outline-none focus-visible:[&_circle]:stroke-white"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectPlayer(player.id);
                setDraggingPlayerId(player.id);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelectPlayer(player.id);
              }}
            >
              {selected ? <circle r="3.7" fill="none" stroke="#fbbf24" strokeWidth="0.65" filter="url(#twin-glow)" /> : null}
              <circle r="2.25" fill={offense ? "#10b981" : "#e11d48"} stroke={offense ? "#a7f3d0" : "#fecdd3"} strokeWidth="0.5" />
              <text y="0.7" fill="#020617" fontSize="1.9" textAnchor="middle" fontWeight="900">{player.label.slice(0, 4)}</text>
            </g>
          );
        })}

        {ballPosition ? (
          <g transform={`translate(${ballPosition.x} ${ballPosition.y})`} filter="url(#twin-glow)">
            <ellipse rx="1.45" ry="0.85" fill="#92400e" stroke="#fbbf24" strokeWidth="0.35" />
            <line x1="-0.55" x2="0.55" y1="0" y2="0" stroke="#fde68a" strokeWidth="0.2" />
          </g>
        ) : null}

        {selectedPlayer && tool === "route" ? (
          <text x="50" y="96" textAnchor="middle" fill="#a7f3d0" fontSize="2.2" fontWeight="700">CLICK FIELD TO EXTEND {selectedPlayer.label}'S ROUTE</text>
        ) : null}
      </svg>
    </div>
  );
}

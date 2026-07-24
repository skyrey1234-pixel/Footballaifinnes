import { useMemo, useState, useEffect, useRef, useCallback } from "react";

export interface PlayerPos {
  x: number;
  y: number;
  label: string;
  side: "offense" | "defense";
  route?: { points: [number, number][]; type: "route" | "block" | "blitz" | "zone" };
}

interface FormationDiagramProps {
  formation: string;
  playName: string;
  playType: string;
  target?: string;
  compact?: boolean;
  defenseScheme?: string;
  /** Show animated ball flight from QB to the primary target during Run Play */
  showBall?: boolean;
}

// ===== OFFENSIVE FORMATIONS =====
export function getOffensivePlayers(formation: string, playType: string, target?: string): PlayerPos[] {
  const f = formation.toLowerCase();
  const players: PlayerPos[] = [];

  const lineY = 52;
  players.push({ x: 38, y: lineY, label: "LT", side: "offense", route: { points: [[38, lineY - 4]], type: "block" } });
  players.push({ x: 44, y: lineY, label: "LG", side: "offense", route: { points: [[44, lineY - 4]], type: "block" } });
  players.push({ x: 50, y: lineY, label: "C", side: "offense", route: { points: [[50, lineY - 4]], type: "block" } });
  players.push({ x: 56, y: lineY, label: "RG", side: "offense", route: { points: [[56, lineY - 4]], type: "block" } });
  players.push({ x: 62, y: lineY, label: "RT", side: "offense", route: { points: [[62, lineY - 4]], type: "block" } });

  let qbY = 58;
  if (f.includes("shotgun") || f.includes("spread") || f.includes("empty")) qbY = 64;
  else if (f.includes("pistol")) qbY = 61;
  players.push({ x: 50, y: qbY, label: "QB", side: "offense" });

  if (!f.includes("empty") && !f.includes("5 wide")) {
    if (f.includes("shotgun") || f.includes("spread")) {
      players.push({ x: 44, y: 64, label: "RB", side: "offense", route: getRbRoute(playType, 44, 64) });
    } else if (f.includes("pistol")) {
      players.push({ x: 50, y: 68, label: "RB", side: "offense", route: getRbRoute(playType, 50, 68) });
    } else if (f.includes("i-form") || f.includes("i form")) {
      players.push({ x: 50, y: 65, label: "FB", side: "offense", route: { points: [[50, 61]], type: "block" } });
      players.push({ x: 50, y: 72, label: "RB", side: "offense", route: getRbRoute(playType, 50, 72) });
    } else {
      players.push({ x: 45, y: 64, label: "RB", side: "offense", route: getRbRoute(playType, 45, 64) });
    }
  }

  if (f.includes("trips right") || f.includes("trips")) {
    players.push({ x: 82, y: 50, label: "X", side: "offense", route: getWrRoute("go", 82, 50) });
    players.push({ x: 76, y: 52, label: "H", side: "offense", route: getWrRoute("slant", 76, 52) });
    players.push({ x: 70, y: 52, label: "Y", side: "offense", route: getWrRoute("out", 70, 52) });
    players.push({ x: 18, y: 50, label: "Z", side: "offense", route: getWrRoute("post", 18, 50) });
  } else if (f.includes("trips left")) {
    players.push({ x: 18, y: 50, label: "X", side: "offense", route: getWrRoute("go", 18, 50) });
    players.push({ x: 24, y: 52, label: "H", side: "offense", route: getWrRoute("slant", 24, 52) });
    players.push({ x: 30, y: 52, label: "Y", side: "offense", route: getWrRoute("out", 30, 52) });
    players.push({ x: 82, y: 50, label: "Z", side: "offense", route: getWrRoute("post", 82, 50) });
  } else if (f.includes("empty") || f.includes("5 wide")) {
    players.push({ x: 12, y: 50, label: "X", side: "offense", route: getWrRoute("go", 12, 50) });
    players.push({ x: 28, y: 52, label: "H", side: "offense", route: getWrRoute("slant", 28, 52) });
    players.push({ x: 72, y: 52, label: "Y", side: "offense", route: getWrRoute("curl", 72, 52) });
    players.push({ x: 88, y: 50, label: "Z", side: "offense", route: getWrRoute("out", 88, 50) });
    players.push({ x: 50, y: 70, label: "RB", side: "offense", route: getWrRoute("flat", 50, 70) });
  } else if (f.includes("twins") || f.includes("2x2")) {
    players.push({ x: 14, y: 50, label: "X", side: "offense", route: getWrRoute("post", 14, 50) });
    players.push({ x: 26, y: 52, label: "H", side: "offense", route: getWrRoute("slant", 26, 52) });
    players.push({ x: 74, y: 52, label: "Y", side: "offense", route: getWrRoute("curl", 74, 52) });
    players.push({ x: 86, y: 50, label: "Z", side: "offense", route: getWrRoute("go", 86, 50) });
  } else if (f.includes("heavy") || f.includes("goal line") || f.includes("jumbo")) {
    players.push({ x: 33, y: lineY, label: "TE", side: "offense", route: { points: [[33, lineY - 4]], type: "block" } });
    players.push({ x: 67, y: lineY, label: "TE", side: "offense", route: { points: [[67, lineY - 4]], type: "block" } });
    players.push({ x: 50, y: 65, label: "FB", side: "offense", route: { points: [[50, 61]], type: "block" } });
    players.push({ x: 82, y: 50, label: "Z", side: "offense", route: getWrRoute("go", 82, 50) });
  } else if (f.includes("spread")) {
    players.push({ x: 12, y: 50, label: "X", side: "offense", route: getWrRoute("go", 12, 50) });
    players.push({ x: 28, y: 52, label: "H", side: "offense", route: getWrRoute("slant", 28, 52) });
    players.push({ x: 72, y: 52, label: "Y", side: "offense", route: getWrRoute("curl", 72, 52) });
    players.push({ x: 88, y: 50, label: "Z", side: "offense", route: getWrRoute("out", 88, 50) });
  } else {
    players.push({ x: 67, y: lineY, label: "TE", side: "offense", route: getWrRoute("curl", 67, lineY) });
    players.push({ x: 14, y: 50, label: "X", side: "offense", route: getWrRoute("post", 14, 50) });
    players.push({ x: 86, y: 50, label: "Z", side: "offense", route: getWrRoute("go", 86, 50) });
  }

  return players;
}

// ===== DEFENSIVE FORMATIONS =====
export function getDefensivePlayers(defenseScheme?: string): PlayerPos[] {
  const scheme = (defenseScheme || "4-3").toLowerCase();
  const players: PlayerPos[] = [];
  const dLineY = 47;
  const lbY = 38;
  const dbY = 26;
  const safetyY = 14;

  if (scheme.includes("3-4") || scheme.includes("34")) {
    players.push({ x: 44, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 50, y: dLineY, label: "NT", side: "defense" });
    players.push({ x: 56, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 35, y: lbY, label: "OLB", side: "defense" });
    players.push({ x: 44, y: lbY, label: "ILB", side: "defense" });
    players.push({ x: 56, y: lbY, label: "ILB", side: "defense" });
    players.push({ x: 65, y: lbY, label: "OLB", side: "defense" });
  } else if (scheme.includes("nickel") || scheme.includes("5 db")) {
    players.push({ x: 42, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 50, y: dLineY, label: "DT", side: "defense" });
    players.push({ x: 58, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 44, y: lbY, label: "LB", side: "defense" });
    players.push({ x: 56, y: lbY, label: "LB", side: "defense" });
    players.push({ x: 30, y: dbY + 4, label: "NB", side: "defense" });
  } else if (scheme.includes("dime") || scheme.includes("6 db")) {
    players.push({ x: 44, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 56, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 50, y: lbY, label: "LB", side: "defense" });
    players.push({ x: 30, y: dbY + 4, label: "NB", side: "defense" });
    players.push({ x: 70, y: dbY + 4, label: "NB", side: "defense" });
  } else {
    players.push({ x: 41, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 47, y: dLineY, label: "DT", side: "defense" });
    players.push({ x: 53, y: dLineY, label: "DT", side: "defense" });
    players.push({ x: 59, y: dLineY, label: "DE", side: "defense" });
    players.push({ x: 38, y: lbY, label: "WLB", side: "defense" });
    players.push({ x: 50, y: lbY, label: "MLB", side: "defense" });
    players.push({ x: 62, y: lbY, label: "SLB", side: "defense" });
  }

  players.push({ x: 18, y: dbY, label: "CB", side: "defense" });
  players.push({ x: 82, y: dbY, label: "CB", side: "defense" });
  players.push({ x: 40, y: safetyY, label: "SS", side: "defense" });
  players.push({ x: 60, y: safetyY, label: "FS", side: "defense" });

  return players;
}

// ===== ROUTE HELPERS =====
function getRbRoute(playType: string, x: number, y: number): PlayerPos["route"] {
  if (playType === "run") return { points: [[x + 6, y - 4], [x + 12, y - 10]], type: "route" };
  if (playType === "screen") return { points: [[x - 4, y - 2], [x - 12, y - 6]], type: "route" };
  return { points: [[x + 4, y - 3], [x + 6, y - 6]], type: "route" };
}

function getWrRoute(type: string, x: number, y: number): PlayerPos["route"] {
  const dir = x < 50 ? 1 : -1;
  switch (type) {
    case "go": return { points: [[x, y - 8], [x, y - 20]], type: "route" };
    case "slant": return { points: [[x, y - 5], [x + dir * 10, y - 14]], type: "route" };
    case "out": return { points: [[x, y - 6], [x - dir * 10, y - 6]], type: "route" };
    case "curl": return { points: [[x, y - 12], [x + dir * 2, y - 10]], type: "route" };
    case "post": return { points: [[x, y - 6], [x + dir * 8, y - 18]], type: "route" };
    case "corner": return { points: [[x, y - 6], [x - dir * 8, y - 18]], type: "route" };
    case "flat": return { points: [[x - dir * 8, y - 2], [x - dir * 14, y - 2]], type: "route" };
    case "drag": return { points: [[x, y - 3], [x + dir * 20, y - 3]], type: "route" };
    default: return { points: [[x, y - 12]], type: "route" };
  }
}

// ===== SVG PATH BUILDER =====
function buildRoutePath(startX: number, startY: number, points: [number, number][]): string {
  let path = `M ${startX} ${startY}`;
  for (const [px, py] of points) {
    path += ` L ${px} ${py}`;
  }
  return path;
}

// ===== INTERPOLATE POSITION ALONG ROUTE =====
export function interpolateRoute(startX: number, startY: number, points: [number, number][], progress: number): { x: number; y: number } {
  if (progress <= 0 || points.length === 0) return { x: startX, y: startY };

  // Build full path as segments
  const allPoints: [number, number][] = [[startX, startY], ...points];
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let i = 1; i < allPoints.length; i++) {
    const dx = allPoints[i][0] - allPoints[i - 1][0];
    const dy = allPoints[i][1] - allPoints[i - 1][1];
    const len = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(len);
    totalLength += len;
  }

  const targetDist = progress * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulated + segmentLengths[i] >= targetDist) {
      const segProgress = (targetDist - accumulated) / segmentLengths[i];
      const x = allPoints[i][0] + (allPoints[i + 1][0] - allPoints[i][0]) * segProgress;
      const y = allPoints[i][1] + (allPoints[i + 1][1] - allPoints[i][1]) * segProgress;
      return { x, y };
    }
    accumulated += segmentLengths[i];
  }

  return { x: points[points.length - 1][0], y: points[points.length - 1][1] };
}

// ===== PARTIAL PATH FOR ANIMATION =====
function buildPartialPath(startX: number, startY: number, points: [number, number][], progress: number): string {
  if (progress <= 0) return "";

  const allPoints: [number, number][] = [[startX, startY], ...points];
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let i = 1; i < allPoints.length; i++) {
    const dx = allPoints[i][0] - allPoints[i - 1][0];
    const dy = allPoints[i][1] - allPoints[i - 1][1];
    segmentLengths.push(Math.sqrt(dx * dx + dy * dy));
    totalLength += segmentLengths[segmentLengths.length - 1];
  }

  const targetDist = progress * totalLength;
  let accumulated = 0;
  let path = `M ${allPoints[0][0]} ${allPoints[0][1]}`;

  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulated + segmentLengths[i] >= targetDist) {
      const segProgress = (targetDist - accumulated) / segmentLengths[i];
      const x = allPoints[i][0] + (allPoints[i + 1][0] - allPoints[i][0]) * segProgress;
      const y = allPoints[i][1] + (allPoints[i + 1][1] - allPoints[i][1]) * segProgress;
      path += ` L ${x} ${y}`;
      break;
    }
    path += ` L ${allPoints[i + 1][0]} ${allPoints[i + 1][1]}`;
    accumulated += segmentLengths[i];
  }

  return path;
}

// ===== MAIN COMPONENT =====
export function FormationDiagram({ formation, playName, playType, target, compact = false, defenseScheme, showBall = true }: FormationDiagramProps) {
  const offensePlayers = useMemo(() => getOffensivePlayers(formation, playType, target), [formation, playType, target]);
  const defensePlayers = useMemo(() => getDefensivePlayers(defenseScheme), [defenseScheme]);

  const [isAnimating, setIsAnimating] = useState(false);
  const [progress, setProgress] = useState(1); // 0 = pre-snap, 1 = full routes shown
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const PLAY_DURATION = 2500; // 2.5 seconds for the full play to develop

  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = timestamp - startTimeRef.current;
    const p = Math.min(elapsed / PLAY_DURATION, 1);
    setProgress(p);

    if (p < 1) {
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      setIsAnimating(false);
    }
  }, []);

  const handlePlayToggle = useCallback(() => {
    if (isAnimating) {
      // Pause
      cancelAnimationFrame(animFrameRef.current);
      setIsAnimating(false);
    } else {
      // Start/restart
      setProgress(0);
      startTimeRef.current = 0;
      setIsAnimating(true);
      animFrameRef.current = requestAnimationFrame(animate);
    }
  }, [isAnimating, animate]);

  const handleReset = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setIsAnimating(false);
    setProgress(1); // Show full routes
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Unique IDs for markers to avoid conflicts between multiple diagrams
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  // ===== BALL FLIGHT =====
  // Pass: ball arcs from QB to the primary receiver's route end after routes develop (release at 45% of play).
  // Run/screen: ball travels with the RB along his route.
  const ballFlight = useMemo(() => {
    if (!showBall) return null;
    const qb = offensePlayers.find(p => p.label === "QB");
    if (!qb) return null;
    const isRun = playType === "run";
    if (isRun) {
      const rb = offensePlayers.find(p => p.label === "RB" && p.route);
      if (!rb || !rb.route) return null;
      return { mode: "carry" as const, carrier: rb };
    }
    // Pass or screen: choose primary target — receiver whose label matches target hint, else deepest route
    const receivers = offensePlayers.filter(p => p.route && p.route.type === "route" && p.label !== "QB");
    if (receivers.length === 0) return null;
    let primary = receivers[0];
    if (target) {
      const t = target.toLowerCase();
      const byLabel = receivers.find(r => t.includes(r.label.toLowerCase()));
      if (byLabel) primary = byLabel;
    }
    if (primary === receivers[0] && !target) {
      // deepest route end = smallest y
      primary = receivers.reduce((best, r) => {
        const endY = r.route!.points[r.route!.points.length - 1][1];
        const bestY = best.route!.points[best.route!.points.length - 1][1];
        return endY < bestY ? r : best;
      }, receivers[0]);
    }
    const end = primary.route!.points[primary.route!.points.length - 1];
    return { mode: "throw" as const, from: { x: qb.x, y: qb.y }, to: { x: end[0], y: end[1] } };
  }, [showBall, offensePlayers, playType, target]);

  // Ball position for the current progress
  const ballPos = useMemo(() => {
    if (!ballFlight || progress <= 0 || progress >= 1) return null;
    if (ballFlight.mode === "carry") {
      const c = ballFlight.carrier;
      const routeProgress = Math.min(progress, 1);
      const pos = interpolateRoute(c.x, c.y, c.route!.points, routeProgress);
      return { x: pos.x, y: pos.y - 1.2, inFlight: false };
    }
    const RELEASE = 0.45;
    if (progress < RELEASE) return { x: ballFlight.from.x, y: ballFlight.from.y - 1.2, inFlight: false };
    const t = Math.min((progress - RELEASE) / (1 - RELEASE), 1);
    const x = ballFlight.from.x + (ballFlight.to.x - ballFlight.from.x) * t;
    const yLinear = ballFlight.from.y + (ballFlight.to.y - ballFlight.from.y) * t;
    // Parabolic arc: peak height scales with throw distance
    const dist = Math.hypot(ballFlight.to.x - ballFlight.from.x, ballFlight.to.y - ballFlight.from.y);
    const arc = Math.min(3 + dist * 0.18, 10);
    const y = yLinear - arc * 4 * t * (1 - t);
    return { x, y, inFlight: true };
  }, [ballFlight, progress]);

  // Dotted throw-lane preview when play is fully developed
  const throwLane = ballFlight?.mode === "throw" && progress >= 1 ? ballFlight : null;

  return (
    <div className={compact ? "w-[160px] h-[160px]" : "w-full max-w-[360px]"}>
      <svg viewBox="0 0 100 85" className="w-full rounded-md overflow-hidden" style={{ background: "#0f2b0f" }}>
        {/* Field background */}
        <rect x="0" y="0" width="100" height="85" fill="#0f2b0f" />

        {/* Yard lines */}
        {[17, 34, 52, 68].map(y => (
          <line key={y} x1="5" y1={y} x2="95" y2={y} stroke="#1a4a1a" strokeWidth="0.3" />
        ))}

        {/* Hash marks */}
        {[17, 34, 52, 68].map(y => (
          <g key={`hash-${y}`}>
            <line x1="35" y1={y - 1} x2="35" y2={y + 1} stroke="#1a4a1a" strokeWidth="0.4" />
            <line x1="65" y1={y - 1} x2="65" y2={y + 1} stroke="#1a4a1a" strokeWidth="0.4" />
          </g>
        ))}

        {/* Line of scrimmage */}
        <line x1="5" y1="50" x2="95" y2="50" stroke="#FFD700" strokeWidth="0.4" opacity="0.6" strokeDasharray="2,1" />
        {!compact && <text x="97" y="50.5" fontSize="2" fill="#FFD700" opacity="0.5" textAnchor="end">LOS</text>}

        {/* Arrow marker defs */}
        <defs>
          <marker id={`ra-${uid}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="#00FF87" />
          </marker>
          <marker id={`ba-${uid}`} markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto">
            <polygon points="0 0, 3 1.5, 0 3" fill="#888" />
          </marker>
        </defs>

        {/* Offensive routes (animated or static) */}
        {offensePlayers.filter(p => p.route).map((player, i) => {
          const isBlock = player.route!.type === "block";
          const routeProgress = isBlock ? Math.min(progress * 2, 1) : progress; // Blocks develop faster
          const pathD = progress >= 1
            ? buildRoutePath(player.x, player.y, player.route!.points)
            : buildPartialPath(player.x, player.y, player.route!.points, routeProgress);

          return pathD ? (
            <path
              key={`off-route-${i}`}
              d={pathD}
              fill="none"
              stroke={isBlock ? "#666" : "#00FF87"}
              strokeWidth={isBlock ? "0.5" : "0.8"}
              strokeDasharray={isBlock ? "1,0.5" : "none"}
              opacity={0.85}
              markerEnd={progress >= 1 ? (isBlock ? `url(#ba-${uid})` : `url(#ra-${uid})`) : undefined}
            />
          ) : null;
        })}

        {/* Offensive players — animated position along route */}
        {offensePlayers.map((player, i) => {
          let px = player.x;
          let py = player.y;
          if (player.route && progress < 1 && progress > 0) {
            const isBlock = player.route.type === "block";
            const routeProgress = isBlock ? Math.min(progress * 2, 1) : progress;
            const pos = interpolateRoute(player.x, player.y, player.route.points, routeProgress);
            px = pos.x;
            py = pos.y;
          } else if (player.route && progress >= 1) {
            // Show at end of route
            const lastPt = player.route.points[player.route.points.length - 1];
            px = lastPt[0];
            py = lastPt[1];
          }

          // For static view (progress=1), show at original position
          const showAtOrigin = progress >= 1;
          const displayX = showAtOrigin ? player.x : px;
          const displayY = showAtOrigin ? player.y : py;

          return (
            <g key={`off-${i}`}>
              <circle cx={displayX} cy={displayY} r={compact ? "2" : "2.5"} fill={progress < 1 && progress > 0 ? "rgba(0,255,135,0.15)" : "none"} stroke="#fff" strokeWidth="0.7" />
              {!compact && (
                <text x={displayX} y={displayY + 0.7} textAnchor="middle" fontSize="1.8" fill="#fff" fontWeight="bold" fontFamily="monospace">
                  {player.label.length > 2 ? player.label.slice(0, 2) : player.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Defensive players (X marks) */}
        {defensePlayers.map((player, i) => (
          <g key={`def-${i}`}>
            <line x1={player.x - 1.5} y1={player.y - 1.5} x2={player.x + 1.5} y2={player.y + 1.5} stroke="#FF4444" strokeWidth="0.8" />
            <line x1={player.x + 1.5} y1={player.y - 1.5} x2={player.x - 1.5} y2={player.y + 1.5} stroke="#FF4444" strokeWidth="0.8" />
            {!compact && (
              <text x={player.x} y={player.y + 5} textAnchor="middle" fontSize="1.6" fill="#FF6666" fontFamily="monospace">
                {player.label}
              </text>
            )}
          </g>
        ))}

        {/* Static throw-lane preview (full development view) */}
        {throwLane && (
          <g>
            <path
              d={`M ${throwLane.from.x} ${throwLane.from.y} Q ${(throwLane.from.x + throwLane.to.x) / 2} ${Math.min(throwLane.from.y, throwLane.to.y) - 8} ${throwLane.to.x} ${throwLane.to.y}`}
              fill="none"
              stroke="#FFD700"
              strokeWidth="0.5"
              strokeDasharray="1.4,1"
              opacity="0.75"
            />
            <circle cx={throwLane.to.x} cy={throwLane.to.y} r="2.2" fill="none" stroke="#FFD700" strokeWidth="0.4" opacity="0.8" strokeDasharray="0.8,0.6" />
            {!compact && (
              <text x={throwLane.to.x} y={throwLane.to.y - 3} textAnchor="middle" fontSize="1.8" fill="#FFD700" fontWeight="bold" fontFamily="monospace">
                CATCH
              </text>
            )}
          </g>
        )}

        {/* Animated ball */}
        {ballPos && (
          <g>
            {ballPos.inFlight && (
              <circle cx={ballPos.x} cy={ballPos.y} r="2.4" fill="rgba(255,215,0,0.18)">
                <animate attributeName="r" values="2;3;2" dur="0.5s" repeatCount="indefinite" />
              </circle>
            )}
            <ellipse
              cx={ballPos.x}
              cy={ballPos.y}
              rx="1.3"
              ry="0.85"
              fill="#8B4513"
              stroke="#FFD700"
              strokeWidth="0.25"
              transform={ballPos.inFlight ? `rotate(${progress * 720} ${ballPos.x} ${ballPos.y})` : undefined}
            />
            <line x1={ballPos.x - 0.6} y1={ballPos.y} x2={ballPos.x + 0.6} y2={ballPos.y} stroke="#fff" strokeWidth="0.15" />
          </g>
        )}

        {/* Play name label */}
        {!compact && (
          <>
            <rect x="2" y="76" width="96" height="8" fill="#000" opacity="0.5" rx="1" />
            <text x="50" y="81.5" textAnchor="middle" fontSize="2.5" fill="#00FF87" fontWeight="bold" fontFamily="monospace">
              {playName.length > 35 ? playName.slice(0, 35) + "..." : playName}
            </text>
          </>
        )}

        {/* Formation label */}
        {!compact && (
          <text x="50" y="5" textAnchor="middle" fontSize="2" fill="#888" fontFamily="monospace">
            {formation.length > 40 ? formation.slice(0, 40) + "..." : formation}
          </text>
        )}
      </svg>

      {/* Animation Controls */}
      {!compact && (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handlePlayToggle}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/30 hover:bg-[#00FF87]/20 transition-colors"
          >
            {isAnimating ? (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="8" fill="currentColor"/><rect x="6" y="1" width="3" height="8" fill="currentColor"/></svg>
                Pause
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"/></svg>
                {progress < 1 && progress > 0 ? "Resume" : "Run Play"}
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 rounded text-xs font-medium bg-[#30363D] text-gray-400 border border-[#30363D] hover:text-white transition-colors"
          >
            Reset
          </button>
          {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-[#30363D] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00FF87] rounded-full transition-[width] duration-75"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 font-mono w-8 text-right">
            {progress < 1 ? `${Math.round(progress * 2.5 * 10) / 10}s` : "2.5s"}
          </span>
        </div>
      )}
    </div>
  );
}

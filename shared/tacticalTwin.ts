export type TacticalTwinSourceKind = "film_highlight" | "highlight_reel" | "live_event" | "manual";
export type TacticalTwinSourceType = "youtube" | "upload" | "camera" | "screen";
export type TacticalTwinSide = "offense" | "defense";
export type TacticalTwinRouteType = "route" | "block" | "blitz" | "zone";
export type TacticalTwinPlayType = "pass" | "run" | "screen" | "rpo" | "special_teams" | "unknown";

export type TacticalTwinPoint = {
  x: number;
  y: number;
};

export type TacticalTwinPlayer = TacticalTwinPoint & {
  id: string;
  label: string;
  side: TacticalTwinSide;
  routeType: TacticalTwinRouteType;
  route: TacticalTwinPoint[];
};

export type TacticalTwinMarker = TacticalTwinPoint & {
  id: string;
  kind: "mistake" | "correction" | "key";
  label: string;
};

export type TacticalTwinSource = {
  sourceKind: TacticalTwinSourceKind;
  sourceKey: string;
  gameSessionId?: number | null;
  liveSessionId?: number | null;
  liveEventId?: number | null;
  sourceType: TacticalTwinSourceType;
  sourceTitle: string;
  sourceDescription?: string | null;
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  youtubeVideoId?: string | null;
  videoUrl?: string | null;
};

export type TacticalTwinDraft = TacticalTwinSource & {
  title: string;
  formation: string;
  playType: TacticalTwinPlayType;
  target?: string | null;
  defenseScheme: string;
  players: TacticalTwinPlayer[];
  ballPath: TacticalTwinPoint[];
  markers: TacticalTwinMarker[];
  coachingNotes?: string | null;
  confidence: number;
};

export function clampTwinCoordinate(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

export function normalizeTwinPoint(point: TacticalTwinPoint): TacticalTwinPoint {
  return { x: clampTwinCoordinate(point.x), y: clampTwinCoordinate(point.y) };
}

export function toPlayerPos(player: TacticalTwinPlayer) {
  return {
    x: clampTwinCoordinate(player.x),
    y: clampTwinCoordinate(player.y),
    label: player.label,
    side: player.side,
    route: player.route.length > 0
      ? {
          points: player.route.map((point) => {
            const normalized = normalizeTwinPoint(point);
            return [normalized.x, normalized.y] as [number, number];
          }),
          type: player.routeType,
        }
      : undefined,
  };
}

function player(
  id: string,
  label: string,
  side: TacticalTwinSide,
  x: number,
  y: number,
  route: TacticalTwinPoint[] = [],
  routeType: TacticalTwinRouteType = side === "offense" ? "route" : "zone",
): TacticalTwinPlayer {
  return { id, label, side, x, y, route, routeType };
}

export function buildDefaultTwinPlayers(
  formation: string,
  playType: TacticalTwinPlayType,
  target?: string | null,
): TacticalTwinPlayer[] {
  const lower = formation.toLowerCase();
  const isRun = playType === "run";
  const offense: TacticalTwinPlayer[] = [
    player("o-lt", "LT", "offense", 38, 53, [{ x: 38, y: 47 }], "block"),
    player("o-lg", "LG", "offense", 44, 53, [{ x: 44, y: 47 }], "block"),
    player("o-c", "C", "offense", 50, 53, [{ x: 50, y: 47 }], "block"),
    player("o-rg", "RG", "offense", 56, 53, [{ x: 56, y: 47 }], "block"),
    player("o-rt", "RT", "offense", 62, 53, [{ x: 62, y: 47 }], "block"),
    player("o-qb", "QB", "offense", 50, lower.includes("under center") ? 58 : 64, []),
    player("o-rb", "RB", "offense", 44, 66, isRun ? [{ x: 50, y: 58 }, { x: 58, y: 43 }, { x: 66, y: 31 }] : [{ x: 39, y: 61 }, { x: 31, y: 56 }]),
    player("o-x", "X", "offense", 13, 51, [{ x: 13, y: 39 }, { x: 25, y: 24 }]),
    player("o-h", "H", "offense", 29, 52, [{ x: 30, y: 44 }, { x: 45, y: 37 }]),
    player("o-y", "Y", "offense", 71, 52, [{ x: 70, y: 44 }, { x: 58, y: 37 }]),
    player("o-z", "Z", "offense", 87, 51, [{ x: 87, y: 37 }, { x: 87, y: 23 }]),
  ];

  const defense: TacticalTwinPlayer[] = [
    player("d-de-l", "DE", "defense", 38, 47, [{ x: 40, y: 53 }], "blitz"),
    player("d-dt-l", "DT", "defense", 46, 47, [{ x: 47, y: 53 }], "blitz"),
    player("d-dt-r", "DT", "defense", 54, 47, [{ x: 53, y: 53 }], "blitz"),
    player("d-de-r", "DE", "defense", 62, 47, [{ x: 60, y: 53 }], "blitz"),
    player("d-wlb", "WLB", "defense", 36, 39, [{ x: 31, y: 34 }], "zone"),
    player("d-mlb", "MLB", "defense", 50, 38, [{ x: 50, y: 31 }], "zone"),
    player("d-slb", "SLB", "defense", 64, 39, [{ x: 69, y: 34 }], "zone"),
    player("d-cb-l", "CB", "defense", 15, 31, [{ x: 14, y: 22 }], "zone"),
    player("d-cb-r", "CB", "defense", 85, 31, [{ x: 86, y: 22 }], "zone"),
    player("d-ss", "SS", "defense", 39, 20, [{ x: 44, y: 30 }], "zone"),
    player("d-fs", "FS", "defense", 61, 18, [{ x: 56, y: 28 }], "zone"),
  ];

  if (target) {
    const normalizedTarget = target.trim().toLowerCase();
    const targetPlayer = offense.find((item) => normalizedTarget.includes(item.label.toLowerCase()));
    if (targetPlayer && targetPlayer.route.length > 0) {
      targetPlayer.route = targetPlayer.route.map((point, index) =>
        index === targetPlayer.route.length - 1 ? { ...point, y: Math.max(12, point.y - 5) } : point,
      );
    }
  }

  return [...offense, ...defense];
}

export function buildDefaultBallPath(players: TacticalTwinPlayer[], playType: TacticalTwinPlayType) {
  const quarterback = players.find((item) => item.label === "QB") ?? players[0];
  const preferredTarget = playType === "run"
    ? players.find((item) => item.label === "RB")
    : players.find((item) => ["Y", "Z", "X", "H"].includes(item.label) && item.route.length > 0);
  if (!quarterback || !preferredTarget) return [];
  const end = preferredTarget.route.at(-1) ?? { x: preferredTarget.x, y: preferredTarget.y };
  return [
    { x: quarterback.x, y: quarterback.y },
    { x: (quarterback.x + end.x) / 2, y: Math.max(8, Math.min(92, (quarterback.y + end.y) / 2 - 5)) },
    end,
  ];
}

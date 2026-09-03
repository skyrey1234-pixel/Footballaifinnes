export type TeamPhase = "offense" | "defense" | "special_teams" | "transition" | "unclear";

export type LiveProbability = {
  label: string;
  probability: number;
  reason: string;
};

export type LiveEvidence = {
  frameIndex: number;
  observation: string;
};

export type UnitInsights = {
  summary: string;
  tendencies: string[];
  strengths: string[];
  vulnerabilities: string[];
};

export type ImpactPlayerObservation = {
  playerLabel: string;
  unit: "offense" | "defense" | "special_teams" | "unclear";
  reason: string;
  evidenceFrameIndex: number;
  confidence: number;
};

export type LiveWindowResult = {
  visibleAction: string;
  teamPhase: TeamPhase;
  phaseReason: string;
  formation: string;
  personnel: string;
  defensiveLook: string;
  playCall: string;
  predictionSummary: string;
  nextPlayProbabilities: LiveProbability[];
  offenseInsights: UnitInsights;
  defenseInsights: UnitInsights;
  impactPlayers: ImpactPlayerObservation[];
  keyMatchups: string[];
  tendencyShift: string;
  counterCall: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  alerts: string[];
  evidence: LiveEvidence[];
  confidence: number;
};

export type UnitMemory = {
  windows: number;
  formations: Record<string, number>;
  personnel: Record<string, number>;
  calls: Record<string, number>;
  looks: Record<string, number>;
  tendencies: string[];
  strengths: string[];
  vulnerabilities: string[];
  latestSummary: string;
};

export type ImpactPlayerMemory = {
  playerLabel: string;
  unit: ImpactPlayerObservation["unit"];
  mentions: number;
  averageConfidence: number;
  reasons: string[];
  lastSeenWindow: number;
};

export type LiveGameMemory = {
  version: 1;
  totalWindows: number;
  phaseCounts: Record<TeamPhase, number>;
  offense: UnitMemory;
  defense: UnitMemory;
  impactPlayers: ImpactPlayerMemory[];
  lastUpdatedWindow: number;
};

function emptyUnitMemory(): UnitMemory {
  return {
    windows: 0,
    formations: {},
    personnel: {},
    calls: {},
    looks: {},
    tendencies: [],
    strengths: [],
    vulnerabilities: [],
    latestSummary: "No verified live windows yet.",
  };
}

export function emptyLiveGameMemory(): LiveGameMemory {
  return {
    version: 1,
    totalWindows: 0,
    phaseCounts: { offense: 0, defense: 0, special_teams: 0, transition: 0, unclear: 0 },
    offense: emptyUnitMemory(),
    defense: emptyUnitMemory(),
    impactPlayers: [],
    lastUpdatedWindow: -1,
  };
}

function cleanLabel(value: string | null | undefined) {
  const cleaned = String(value || "").trim();
  return cleaned && cleaned.toLowerCase() !== "unclear" ? cleaned.slice(0, 160) : "";
}

function increment(target: Record<string, number>, label: string) {
  if (!label) return;
  target[label] = (target[label] ?? 0) + 1;
}

function mergeUnique(previous: string[], incoming: string[], limit = 8) {
  return Array.from(new Set([...incoming.map((item) => item.trim()), ...previous].filter(Boolean))).slice(0, limit);
}

function cloneUnit(value: UnitMemory | undefined): UnitMemory {
  const base = value ?? emptyUnitMemory();
  return {
    ...base,
    formations: { ...(base.formations ?? {}) },
    personnel: { ...(base.personnel ?? {}) },
    calls: { ...(base.calls ?? {}) },
    looks: { ...(base.looks ?? {}) },
    tendencies: [...(base.tendencies ?? [])],
    strengths: [...(base.strengths ?? [])],
    vulnerabilities: [...(base.vulnerabilities ?? [])],
  };
}

export function normalizeLiveGameMemory(value: unknown): LiveGameMemory {
  if (!value || typeof value !== "object") return emptyLiveGameMemory();
  const candidate = value as Partial<LiveGameMemory>;
  return {
    version: 1,
    totalWindows: Math.max(0, Number(candidate.totalWindows) || 0),
    phaseCounts: {
      offense: Math.max(0, Number(candidate.phaseCounts?.offense) || 0),
      defense: Math.max(0, Number(candidate.phaseCounts?.defense) || 0),
      special_teams: Math.max(0, Number(candidate.phaseCounts?.special_teams) || 0),
      transition: Math.max(0, Number(candidate.phaseCounts?.transition) || 0),
      unclear: Math.max(0, Number(candidate.phaseCounts?.unclear) || 0),
    },
    offense: cloneUnit(candidate.offense),
    defense: cloneUnit(candidate.defense),
    impactPlayers: Array.isArray(candidate.impactPlayers) ? candidate.impactPlayers.slice(0, 12) : [],
    lastUpdatedWindow: Number.isInteger(candidate.lastUpdatedWindow) ? Number(candidate.lastUpdatedWindow) : -1,
  };
}

function mergePlayers(previous: ImpactPlayerMemory[], incoming: ImpactPlayerObservation[], windowIndex: number) {
  const merged = previous.map((player) => ({ ...player, reasons: [...player.reasons] }));
  for (const observation of incoming) {
    const playerLabel = cleanLabel(observation.playerLabel);
    if (!playerLabel) continue;
    const key = `${observation.unit}:${playerLabel.toLowerCase()}`;
    const existing = merged.find((player) => `${player.unit}:${player.playerLabel.toLowerCase()}` === key);
    if (existing) {
      const totalConfidence = existing.averageConfidence * existing.mentions + observation.confidence;
      existing.mentions += 1;
      existing.averageConfidence = Math.round(totalConfidence / existing.mentions);
      existing.reasons = mergeUnique(existing.reasons, [observation.reason], 4);
      existing.lastSeenWindow = windowIndex;
    } else {
      merged.push({
        playerLabel,
        unit: observation.unit,
        mentions: 1,
        averageConfidence: observation.confidence,
        reasons: [observation.reason].filter(Boolean),
        lastSeenWindow: windowIndex,
      });
    }
  }
  return merged
    .sort((a, b) => (b.mentions * b.averageConfidence) - (a.mentions * a.averageConfidence))
    .slice(0, 12);
}

export function mergeLiveGameMemory(
  previousValue: unknown,
  result: LiveWindowResult,
  windowIndex: number,
): LiveGameMemory {
  const previous = normalizeLiveGameMemory(previousValue);
  if (windowIndex <= previous.lastUpdatedWindow) return previous;

  const offense = cloneUnit(previous.offense);
  const defense = cloneUnit(previous.defense);
  offense.windows += 1;
  defense.windows += 1;
  increment(offense.formations, cleanLabel(result.formation));
  increment(offense.personnel, cleanLabel(result.personnel));
  increment(offense.calls, cleanLabel(result.playCall));
  increment(defense.looks, cleanLabel(result.defensiveLook));
  offense.tendencies = mergeUnique(offense.tendencies, result.offenseInsights.tendencies);
  offense.strengths = mergeUnique(offense.strengths, result.offenseInsights.strengths);
  offense.vulnerabilities = mergeUnique(offense.vulnerabilities, result.offenseInsights.vulnerabilities);
  offense.latestSummary = result.offenseInsights.summary;
  defense.tendencies = mergeUnique(defense.tendencies, result.defenseInsights.tendencies);
  defense.strengths = mergeUnique(defense.strengths, result.defenseInsights.strengths);
  defense.vulnerabilities = mergeUnique(defense.vulnerabilities, result.defenseInsights.vulnerabilities);
  defense.latestSummary = result.defenseInsights.summary;

  return {
    version: 1,
    totalWindows: previous.totalWindows + 1,
    phaseCounts: {
      ...previous.phaseCounts,
      [result.teamPhase]: previous.phaseCounts[result.teamPhase] + 1,
    },
    offense,
    defense,
    impactPlayers: mergePlayers(previous.impactPlayers, result.impactPlayers, windowIndex),
    lastUpdatedWindow: windowIndex,
  };
}

export function topMemoryCounts(values: Record<string, number>, limit = 5) {
  return Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

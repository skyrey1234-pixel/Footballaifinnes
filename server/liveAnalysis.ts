import { invokeLLM } from "./_core/llm";
import {
  emptyLiveGameMemory,
  type ImpactPlayerObservation,
  type LiveGameMemory,
  type LiveProbability,
  type LiveWindowResult,
  type TeamPhase,
  type UnitInsights,
} from "./liveMemory";

export const LIVE_VISION_MODEL = "gemini-3-flash-preview";
export const LIVE_WINDOW_SECONDS = 5;

export type LiveSituation = {
  quarter: string;
  clock: string;
  down: number;
  distance: number;
  yardLine: string;
  ourScore: number;
  opponentScore: number;
  possession: "us" | "opponent" | "unknown";
  notes?: string;
};

export { type LiveGameMemory, type LiveWindowResult } from "./liveMemory";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cleanList(value: unknown, limit: number, maxLength: number) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim().slice(0, maxLength)).filter(Boolean).slice(0, limit)
    : [];
}

function normalizeInsights(value: unknown, fallback: string): UnitInsights {
  const candidate = value && typeof value === "object" ? value as Partial<UnitInsights> : {};
  return {
    summary: String(candidate.summary || fallback).slice(0, 500),
    tendencies: cleanList(candidate.tendencies, 5, 220),
    strengths: cleanList(candidate.strengths, 4, 220),
    vulnerabilities: cleanList(candidate.vulnerabilities, 4, 220),
  };
}

function normalizeProbabilities(value: unknown): LiveProbability[] {
  const rows = Array.isArray(value) ? value.slice(0, 2).map((item) => {
    const row = item && typeof item === "object" ? item as Partial<LiveProbability> : {};
    return {
      label: String(row.label || "Unclear concept").slice(0, 96),
      probability: clamp(Number(row.probability) || 0, 0, 100),
      reason: String(row.reason || "Insufficient visible evidence.").slice(0, 320),
    };
  }) : [];

  while (rows.length < 2) {
    rows.push({
      label: rows.length === 0 ? "Primary concept unclear" : "Secondary concept unclear",
      probability: rows.length === 0 ? 50 : 50,
      reason: "Insufficient visible or cumulative evidence for a stronger prediction.",
    });
  }
  const total = rows.reduce((sum, row) => sum + row.probability, 0);
  const normalized = total > 0
    ? rows.map((row) => ({ ...row, probability: Math.round((row.probability / total) * 100) }))
    : rows.map((row) => ({ ...row, probability: 50 }));
  const drift = 100 - normalized.reduce((sum, row) => sum + row.probability, 0);
  normalized[0].probability = clamp(normalized[0].probability + drift, 0, 100);
  return normalized;
}

function normalizeImpactPlayers(value: unknown): ImpactPlayerObservation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((item) => {
    const row = item && typeof item === "object" ? item as Partial<ImpactPlayerObservation> : {};
    const unit = ["offense", "defense", "special_teams", "unclear"].includes(String(row.unit))
      ? row.unit as ImpactPlayerObservation["unit"]
      : "unclear";
    return {
      playerLabel: String(row.playerLabel || "Impact player — identity unclear").slice(0, 96),
      unit,
      reason: String(row.reason || "Visible impact requires coach verification.").slice(0, 320),
      evidenceFrameIndex: Math.max(0, Math.floor(Number(row.evidenceFrameIndex) || 0)),
      confidence: clamp(Math.round(Number(row.confidence) || 0), 0, 100),
    };
  });
}

export function parseLiveJson(raw: string): LiveWindowResult {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(),
  ];
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as LiveWindowResult;
    } catch {
      // Try the next safe extraction form.
    }
  }
  throw new Error(`Live vision model returned invalid JSON: ${trimmed.slice(0, 240)}`);
}

export function normalizeLiveResult(result: LiveWindowResult): LiveWindowResult {
  const rawConfidence = Number(result.confidence) || 0;
  const confidence = rawConfidence > 0 && rawConfidence <= 1
    ? Math.round(rawConfidence * 100)
    : Math.round(rawConfidence);
  const teamPhase: TeamPhase = ["offense", "defense", "special_teams", "transition", "unclear"].includes(result.teamPhase)
    ? result.teamPhase
    : "unclear";

  return {
    ...result,
    visibleAction: String(result.visibleAction || "No clear action visible.").slice(0, 700),
    teamPhase,
    phaseReason: String(result.phaseReason || "The filmed team’s phase is unclear from this window.").slice(0, 400),
    formation: String(result.formation || "Unclear").slice(0, 96),
    personnel: String(result.personnel || "Unclear").slice(0, 96),
    defensiveLook: String(result.defensiveLook || "Unclear").slice(0, 128),
    playCall: String(result.playCall || "Unclear").slice(0, 160),
    predictionSummary: String(result.predictionSummary || "Two concepts remain possible; evidence is limited.").slice(0, 700),
    nextPlayProbabilities: normalizeProbabilities(result.nextPlayProbabilities),
    offenseInsights: normalizeInsights(result.offenseInsights, "Offensive tendency is not yet clear."),
    defenseInsights: normalizeInsights(result.defenseInsights, "Defensive tendency is not yet clear."),
    impactPlayers: normalizeImpactPlayers(result.impactPlayers),
    keyMatchups: cleanList(result.keyMatchups, 5, 260),
    tendencyShift: String(result.tendencyShift || "No confirmed shift yet.").slice(0, 500),
    counterCall: String(result.counterCall || "Hold the current call and confirm the look.").slice(0, 500),
    riskLevel: ["low", "moderate", "high", "critical"].includes(result.riskLevel) ? result.riskLevel : "low",
    alerts: cleanList(result.alerts, 5, 240),
    evidence: Array.isArray(result.evidence) ? result.evidence
      .slice(0, 6)
      .filter((item) => Number.isInteger(item.frameIndex) && item.frameIndex >= 0)
      .map((item) => ({ frameIndex: item.frameIndex, observation: String(item.observation || "").slice(0, 360) })) : [],
    confidence: clamp(confidence, 0, 100),
  };
}

const unitInsightSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    tendencies: { type: "array", items: { type: "string" }, maxItems: 5 },
    strengths: { type: "array", items: { type: "string" }, maxItems: 4 },
    vulnerabilities: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
  required: ["summary", "tendencies", "strengths", "vulnerabilities"],
  additionalProperties: false,
} as const;

export async function analyzeLiveWindow(input: {
  opponentName: string;
  windowStartSeconds: number;
  windowEndSeconds: number;
  frames: string[];
  situation: LiveSituation;
  gameMemory?: LiveGameMemory | null;
}): Promise<LiveWindowResult> {
  const imageParts = input.frames.slice(0, 4).map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));
  const memory = input.gameMemory ?? emptyLiveGameMemory();

  const prompt = `Analyze this five-second football window using ONLY the supplied chronological frames, entered situation, and bounded prior-game memory.

Opponent/session label: ${input.opponentName}
Window: ${input.windowStartSeconds}s to ${input.windowEndSeconds}s
Situation: ${JSON.stringify(input.situation)}
Cumulative memory from earlier verified AI windows: ${JSON.stringify(memory)}

Frame 0 is earliest and frame ${Math.max(0, imageParts.length - 1)} is latest.

Tasks:
1. Determine whether the FILMED TEAM is on offense, defense, special teams, in transition, or unclear. Use entered possession when available and explain the classification.
2. Analyze BOTH units visible: offensive formation/personnel/call and defensive front/coverage/pressure. Use "Unclear" when unsupported.
3. Return EXACTLY TWO ranked predictions for the NEXT OFFENSIVE SNAP. The two probabilities must total 100. Each needs visible or cumulative evidence and must remain uncertain when evidence is weak.
4. Update concise offense and defense intelligence: tendencies, strengths, and vulnerabilities supported by this window plus prior memory.
5. Identify impactful players on either unit. Never invent a name or jersey number. If identity is unreadable, use a role such as "Boundary WR — identity unclear" or "Edge defender — identity unclear".
6. Identify key matchups, one practical counter call, tendency shifts, and urgent risks. Cite frame-index evidence.

Every output is an AI estimate for coach verification. Never claim a full-game percentage from partial windows. Return only the requested JSON.`;

  const response = await invokeLLM({
    model: LIVE_VISION_MODEL,
    maxTokens: 4_096,
    messages: [
      { role: "system", content: "You are a fast, evidence-first football analyst. Produce two next-snap possibilities, learn across the game, and never invent player identities or statistics." },
      { role: "user", content: [{ type: "text", text: prompt }, ...imageParts] },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "live_football_five_second_window",
        strict: true,
        schema: {
          type: "object",
          properties: {
            visibleAction: { type: "string" },
            teamPhase: { type: "string", enum: ["offense", "defense", "special_teams", "transition", "unclear"] },
            phaseReason: { type: "string" },
            formation: { type: "string" },
            personnel: { type: "string" },
            defensiveLook: { type: "string" },
            playCall: { type: "string" },
            predictionSummary: { type: "string" },
            nextPlayProbabilities: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  probability: { type: "number", minimum: 0, maximum: 100 },
                  reason: { type: "string" },
                },
                required: ["label", "probability", "reason"],
                additionalProperties: false,
              },
            },
            offenseInsights: unitInsightSchema,
            defenseInsights: unitInsightSchema,
            impactPlayers: {
              type: "array",
              maxItems: 6,
              items: {
                type: "object",
                properties: {
                  playerLabel: { type: "string" },
                  unit: { type: "string", enum: ["offense", "defense", "special_teams", "unclear"] },
                  reason: { type: "string" },
                  evidenceFrameIndex: { type: "integer", minimum: 0 },
                  confidence: { type: "integer", minimum: 0, maximum: 100 },
                },
                required: ["playerLabel", "unit", "reason", "evidenceFrameIndex", "confidence"],
                additionalProperties: false,
              },
            },
            keyMatchups: { type: "array", items: { type: "string" }, maxItems: 5 },
            tendencyShift: { type: "string" },
            counterCall: { type: "string" },
            riskLevel: { type: "string", enum: ["low", "moderate", "high", "critical"] },
            alerts: { type: "array", items: { type: "string" }, maxItems: 5 },
            evidence: {
              type: "array",
              maxItems: 6,
              items: {
                type: "object",
                properties: { frameIndex: { type: "integer", minimum: 0 }, observation: { type: "string" } },
                required: ["frameIndex", "observation"],
                additionalProperties: false,
              },
            },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["visibleAction", "teamPhase", "phaseReason", "formation", "personnel", "defensiveLook", "playCall", "predictionSummary", "nextPlayProbabilities", "offenseInsights", "defenseInsights", "impactPlayers", "keyMatchups", "tendencyShift", "counterCall", "riskLevel", "alerts", "evidence", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Live vision model returned no content");
  return normalizeLiveResult(parseLiveJson(raw));
}

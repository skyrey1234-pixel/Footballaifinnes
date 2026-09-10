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
export const LIVE_ANALYSIS_BUDGET_MS = 50_000;
export const LIVE_COMPACT_RETRY_BUDGET_MS = 18_000;

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

export function asLiveText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("");
  }
  return content ? JSON.stringify(content) : "";
}

export function shouldAttemptLiveStructuredRetry(
  elapsedMs: number,
  totalBudgetMs = LIVE_ANALYSIS_BUDGET_MS,
) {
  return Math.max(0, elapsedMs) + LIVE_COMPACT_RETRY_BUDGET_MS <= totalBudgetMs;
}

function topLabel(values: Record<string, number> | undefined) {
  return Object.entries(values ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unclear";
}

export function buildRecoveredLiveResult(input: {
  situation: LiveSituation;
  frames: string[];
  gameMemory?: LiveGameMemory | null;
}): LiveWindowResult {
  const memory = input.gameMemory ?? emptyLiveGameMemory();
  const teamPhase: TeamPhase = input.situation.possession === "us"
    ? "offense"
    : input.situation.possession === "opponent" ? "defense" : "unclear";
  const memoryCalls = Object.entries(memory.offense.calls ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const concepts = memoryCalls.length >= 2
    ? memoryCalls.map(([label, count]) => ({ label, count }))
    : [
        { label: memoryCalls[0]?.[0] || "Primary concept unclear", count: memoryCalls[0]?.[1] || 1 },
        { label: "Secondary concept unclear", count: 1 },
      ];
  const total = concepts.reduce((sum, item) => sum + item.count, 0);
  const firstProbability = Math.round((concepts[0].count / Math.max(1, total)) * 100);

  return normalizeLiveResult({
    visibleAction: "Frames were captured, but the AI response was incomplete. This window remains available for coach review while the next scan continues.",
    teamPhase,
    phaseReason: teamPhase === "unclear" ? "Entered possession is unknown and the incomplete model response could not safely classify the filmed team." : `Classification uses the coach-entered possession: ${input.situation.possession}.`,
    formation: topLabel(memory.offense.formations),
    personnel: topLabel(memory.offense.personnel),
    defensiveLook: topLabel(memory.defense.looks),
    playCall: "Window requires coach verification",
    predictionSummary: memory.totalWindows > 0 ? "Predictions are temporarily based on prior verified live-window memory while the next five-second scan continues." : "Current-frame predictions are unavailable; both concepts remain uncertain until the next completed scan.",
    nextPlayProbabilities: [
      { label: concepts[0].label, probability: firstProbability, reason: memory.totalWindows > 0 ? `Based only on ${memory.totalWindows} previously completed live window${memory.totalWindows === 1 ? "" : "s"}.` : "Insufficient completed live evidence." },
      { label: concepts[1].label, probability: 100 - firstProbability, reason: "Secondary possibility retained because the current structured response was incomplete." },
    ],
    offenseInsights: {
      summary: memory.offense.latestSummary || "Offensive tendency is not yet clear.",
      tendencies: memory.offense.tendencies ?? [],
      strengths: memory.offense.strengths ?? [],
      vulnerabilities: memory.offense.vulnerabilities ?? [],
    },
    defenseInsights: {
      summary: memory.defense.latestSummary || "Defensive tendency is not yet clear.",
      tendencies: memory.defense.tendencies ?? [],
      strengths: memory.defense.strengths ?? [],
      vulnerabilities: memory.defense.vulnerabilities ?? [],
    },
    impactPlayers: [],
    keyMatchups: [],
    tendencyShift: "No new shift is claimed from an incomplete scan.",
    counterCall: "Hold the current call and verify the look while TacticalEdge continues scanning.",
    riskLevel: "moderate",
    alerts: ["This window used automatic structured-response recovery; verify against the field."],
    evidence: input.frames.length > 0 ? [{ frameIndex: 0, observation: "Visual evidence was captured, but the model response was incomplete." }] : [],
    confidence: 0,
  });
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
  const analysisStartedAt = Date.now();
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

Every output is an AI estimate for coach verification. Never claim a full-game percentage from partial windows. Keep summaries to two short sentences, each list to three short items, impact players to four, matchups to three, alerts to three, and evidence to four observations. Return only the requested JSON.`;

  const messages = [
    { role: "system" as const, content: "You are a fast, evidence-first football analyst. Produce two next-snap possibilities, learn across the game, and never invent player identities or statistics." },
    { role: "user" as const, content: [{ type: "text" as const, text: prompt }, ...imageParts] },
  ];
  const request = {
    model: LIVE_VISION_MODEL,
    maxTokens: 6_144,
    messages,
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
  } as const;

  let response = await invokeLLM(request);
  try {
    const raw = asLiveText(response.choices?.[0]?.message?.content);
    if (!raw) throw new Error("Live vision model returned no content");
    return normalizeLiveResult(parseLiveJson(raw));
  } catch (firstError) {
    console.warn("[Live Intelligence] Retrying incomplete structured response", firstError);
    if (!shouldAttemptLiveStructuredRetry(Date.now() - analysisStartedAt)) {
      console.warn("[Live Intelligence] Structured retry skipped to preserve the live-window deadline");
      return buildRecoveredLiveResult({ situation: input.situation, frames: input.frames, gameMemory: memory });
    }
    try {
      response = await Promise.race([
        invokeLLM({
          ...request,
          maxTokens: 8_192,
          messages: [...messages, { role: "user" as const, content: "The prior JSON was incomplete. Return the exact same schema again, compactly: two predictions, at most three list items per section, four impact players, three matchups, three alerts, and four evidence observations. Output JSON only." }],
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Live compact structured retry timed out")), LIVE_COMPACT_RETRY_BUDGET_MS);
        }),
      ]);
      const raw = asLiveText(response.choices?.[0]?.message?.content);
      if (!raw) throw new Error("Live vision retry returned no content");
      return normalizeLiveResult(parseLiveJson(raw));
    } catch (retryError) {
      console.error("[Live Intelligence] Structured response recovery used", retryError);
      return buildRecoveredLiveResult({ situation: input.situation, frames: input.frames, gameMemory: memory });
    }
  }
}

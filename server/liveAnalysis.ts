import { invokeLLM } from "./_core/llm";

export const LIVE_VISION_MODEL = "gemini-3-flash-preview";

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

export type LiveProbability = {
  label: string;
  probability: number;
  reason: string;
};

export type LiveEvidence = {
  frameIndex: number;
  observation: string;
};

export type LiveWindowResult = {
  visibleAction: string;
  formation: string;
  personnel: string;
  defensiveLook: string;
  playCall: string;
  predictionSummary: string;
  nextPlayProbabilities: LiveProbability[];
  tendencyShift: string;
  counterCall: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  alerts: string[];
  evidence: LiveEvidence[];
  confidence: number;
};

export function parseLiveJson(raw: string): LiveWindowResult {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(),
  ];
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as LiveWindowResult;
    } catch {
      // Try the next safe extraction form.
    }
  }
  throw new Error(`Live vision model returned invalid JSON: ${trimmed.slice(0, 240)}`);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeLiveResult(result: LiveWindowResult): LiveWindowResult {
  const rawConfidence = Number(result.confidence) || 0;
  const confidence = rawConfidence > 0 && rawConfidence <= 1
    ? Math.round(rawConfidence * 100)
    : Math.round(rawConfidence);
  const rows = (result.nextPlayProbabilities || [])
    .slice(0, 5)
    .map((row) => ({
      label: String(row.label || "Unknown").slice(0, 80),
      probability: clamp(Number(row.probability) || 0, 0, 100),
      reason: String(row.reason || "Insufficient visible evidence.").slice(0, 280),
    }));
  const total = rows.reduce((sum, row) => sum + row.probability, 0);
  const normalized = total > 0
    ? rows.map((row) => ({ ...row, probability: Math.round((row.probability / total) * 100) }))
    : [];
  if (normalized.length > 0) {
    const drift = 100 - normalized.reduce((sum, row) => sum + row.probability, 0);
    normalized[0].probability = clamp(normalized[0].probability + drift, 0, 100);
  }

  return {
    ...result,
    visibleAction: String(result.visibleAction || "No clear action visible.").slice(0, 700),
    formation: String(result.formation || "Unclear").slice(0, 96),
    personnel: String(result.personnel || "Unclear").slice(0, 96),
    defensiveLook: String(result.defensiveLook || "Unclear").slice(0, 128),
    playCall: String(result.playCall || "Unclear").slice(0, 160),
    predictionSummary: String(result.predictionSummary || "Not enough evidence for a reliable prediction.").slice(0, 700),
    nextPlayProbabilities: normalized,
    tendencyShift: String(result.tendencyShift || "No confirmed shift yet.").slice(0, 500),
    counterCall: String(result.counterCall || "Hold the current call and confirm the look.").slice(0, 500),
    riskLevel: ["low", "moderate", "high", "critical"].includes(result.riskLevel)
      ? result.riskLevel
      : "low",
    alerts: (result.alerts || []).slice(0, 5).map((alert) => String(alert).slice(0, 240)),
    evidence: (result.evidence || [])
      .slice(0, 6)
      .filter((item) => Number.isInteger(item.frameIndex) && item.frameIndex >= 0)
      .map((item) => ({
        frameIndex: item.frameIndex,
        observation: String(item.observation || "").slice(0, 360),
      })),
    confidence: clamp(confidence, 0, 100),
  };
}

export async function analyzeLiveWindow(input: {
  opponentName: string;
  windowStartSeconds: number;
  windowEndSeconds: number;
  frames: string[];
  situation: LiveSituation;
  recentContext: Array<{
    windowIndex: number;
    formation: string | null;
    playCall: string | null;
    predictionSummary: string | null;
  }>;
}): Promise<LiveWindowResult> {
  const imageParts = input.frames.slice(0, 6).map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));

  const prompt = `Analyze this rolling football-game window using ONLY the supplied frames and situation data.

Opponent: ${input.opponentName}
Window: ${input.windowStartSeconds}s to ${input.windowEndSeconds}s
Situation: ${JSON.stringify(input.situation)}
Recent AI context (may be uncertain): ${JSON.stringify(input.recentContext.slice(0, 4))}

Frame order is chronological: frame 0 is earliest and frame ${Math.max(0, imageParts.length - 1)} is latest.

Tasks:
1. Describe the visible football action without inventing jersey numbers, scoreboard data, formation, or outcome.
2. Identify the most likely formation, personnel, defensive front/coverage look, and observed play call. Use "Unclear" when the frames do not support a label.
3. Predict the NEXT offensive play category/concept as a probability distribution totaling approximately 100. Base it on visible alignment, game situation, and repeated tendencies in recent context.
4. Identify a confirmed or emerging tendency shift, recommend one practical counter call, and flag urgent risks.
5. Cite visual evidence by frame index. Confidence must be an integer from 0 to 100 and reflect evidence quality, camera angle, and whether the play is visible.

Every result is an AI estimate for a coach to verify. Never claim certainty. Return only the requested JSON.`;

  const response = await invokeLLM({
    model: LIVE_VISION_MODEL,
    maxTokens: 4_096,
    messages: [
      {
        role: "system",
        content: "You are a fast, evidence-first football analyst supporting a live coaching staff. Be concise, visual, skeptical, and honest about uncertainty.",
      },
      {
        role: "user",
        content: [{ type: "text", text: prompt }, ...imageParts],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "live_football_window",
        strict: true,
        schema: {
          type: "object",
          properties: {
            visibleAction: { type: "string" },
            formation: { type: "string" },
            personnel: { type: "string" },
            defensiveLook: { type: "string" },
            playCall: { type: "string" },
            predictionSummary: { type: "string" },
            nextPlayProbabilities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  probability: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["label", "probability", "reason"],
                additionalProperties: false,
              },
            },
            tendencyShift: { type: "string" },
            counterCall: { type: "string" },
            riskLevel: { type: "string", enum: ["low", "moderate", "high", "critical"] },
            alerts: { type: "array", items: { type: "string" } },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  frameIndex: { type: "integer" },
                  observation: { type: "string" },
                },
                required: ["frameIndex", "observation"],
                additionalProperties: false,
              },
            },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: [
            "visibleAction",
            "formation",
            "personnel",
            "defensiveLook",
            "playCall",
            "predictionSummary",
            "nextPlayProbabilities",
            "tendencyShift",
            "counterCall",
            "riskLevel",
            "alerts",
            "evidence",
            "confidence",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Live vision model returned no content");
  return normalizeLiveResult(parseLiveJson(raw));
}

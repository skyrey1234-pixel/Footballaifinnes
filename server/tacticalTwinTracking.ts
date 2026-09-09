import { invokeLLM } from "./_core/llm";
import {
  clampTwinConfidence,
  clampTwinUnitPoint,
  type TwinFieldCalibration,
  type TwinTrackedBall,
  type TwinTrackedPlayer,
  type TwinTrackingFramePayload,
} from "../shared/tacticalTwinStage2";

export const TWIN_TRACKING_MODEL = "gemini-3-flash-preview";
export const TWIN_TRACKING_FALLBACK_MODEL = "gemini-3.1-pro-preview";
export const MAX_TWIN_TRACKING_BATCH = 3;

export interface TwinTrackingInputFrame {
  frameIndex: number;
  timestampMs: number;
  imageWidth: number;
  imageHeight: number;
  dataUrl: string;
}

type RawTrackingResult = {
  frames?: Array<{
    frameIndex?: number;
    players?: unknown[];
    ball?: unknown;
    frameConfidence?: number;
  }>;
  calibration?: Partial<TwinFieldCalibration>;
  limitations?: unknown[];
};

type CompactTrackingResult = {
  f?: Array<{
    i?: number;
    p?: Array<{ id?: string; u?: string; j?: string; b?: number[]; q?: number[]; g?: number[]; o?: boolean }>;
    a?: { v?: boolean; b?: number[]; q?: number[]; g?: number[]; h?: string };
    c?: number;
  }>;
  k?: { q?: string; c?: number; ip?: number[][]; fp?: number[][] };
  l?: string[];
};

function asText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("");
  }
  return content ? JSON.stringify(content) : "";
}

function emptyResponseSummary(response: unknown) {
  const row = response && typeof response === "object" ? response as Record<string, unknown> : {};
  const choices = Array.isArray(row.choices) ? row.choices as Array<Record<string, unknown>> : [];
  return {
    responseKeys: Object.keys(row),
    providerError: typeof row.error === "string"
      ? row.error.slice(0, 300)
      : row.error && typeof row.error === "object"
        ? JSON.stringify(row.error).slice(0, 300)
        : null,
    choicesCount: choices.length,
    finishReasons: choices.map((choice) => choice.finish_reason ?? null),
  };
}

function parseJson(raw: string): RawTrackingResult {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim(),
  ];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as RawTrackingResult;
    } catch {
      // Try the next safe extraction form.
    }
  }
  throw new Error(`Tracking model returned invalid JSON: ${trimmed.slice(0, 220)}`);
}

function compactPoint(value: unknown) {
  const row = Array.isArray(value) ? value : [];
  return { x: Number(row[0]) || 0, y: Number(row[1]) || 0, confidence: Number(row[2]) || 0 };
}

function compactBox(value: unknown) {
  const row = Array.isArray(value) ? value : [];
  return { x: Number(row[0]) || 0, y: Number(row[1]) || 0, width: Number(row[2]) || 0, height: Number(row[3]) || 0 };
}

function expandCompactTracking(raw: string): RawTrackingResult {
  const compact = parseJson(raw) as unknown as CompactTrackingResult;
  if (!Array.isArray(compact.f)) return compact as unknown as RawTrackingResult;
  return {
    frames: compact.f.map((frame) => ({
      frameIndex: Number(frame.i) || 0,
      frameConfidence: Number(frame.c) || 0,
      players: (frame.p ?? []).map((player) => ({
        trackId: player.id ?? "",
        unit: player.u ?? "unknown",
        label: `${player.u ?? "Player"} ${player.id ?? ""}`.trim(),
        jerseyNumber: player.j ?? "",
        bbox: compactBox(player.b),
        imagePoint: compactPoint(player.q),
        fieldPoint: compactPoint(player.g),
        occluded: Boolean(player.o),
      })),
      ball: {
        visible: Boolean(frame.a?.v),
        bbox: compactBox(frame.a?.b),
        imagePoint: compactPoint(frame.a?.q),
        fieldPoint: compactPoint(frame.a?.g),
        possessedByTrackId: frame.a?.h ?? "",
      },
    })),
    calibration: {
      quality: compact.k?.q as TwinFieldCalibration["quality"],
      confidence: Number(compact.k?.c) || 0,
      imagePoints: (compact.k?.ip ?? []).map((point) => ({ x: Number(point[0]) || 0, y: Number(point[1]) || 0 })),
      fieldPoints: (compact.k?.fp ?? []).map((point) => ({ x: Number(point[0]) || 0, y: Number(point[1]) || 0 })),
    },
    limitations: compact.l ?? [],
  };
}

function cleanLabel(value: unknown, fallback: string) {
  return String(value || fallback).trim().slice(0, 48) || fallback;
}

function normalizeBox(value: unknown) {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    x: clampTwinUnitPoint(Number(row.x) || 0),
    y: clampTwinUnitPoint(Number(row.y) || 0),
    width: clampTwinUnitPoint(Number(row.width) || 0),
    height: clampTwinUnitPoint(Number(row.height) || 0),
  };
}

function normalizePoint(value: unknown) {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    x: clampTwinUnitPoint(Number(row.x) || 0),
    y: clampTwinUnitPoint(Number(row.y) || 0),
    confidence: clampTwinConfidence(Number(row.confidence) || 0),
  };
}

function normalizePlayer(value: unknown, fallbackIndex: number): TwinTrackedPlayer {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const unit = ["offense", "defense", "official", "unknown"].includes(String(row.unit))
    ? String(row.unit) as TwinTrackedPlayer["unit"]
    : "unknown";
  const trackId = cleanLabel(row.trackId, `U${fallbackIndex + 1}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || `U${fallbackIndex + 1}`;
  const fallbackLabel = `${unit === "unknown" ? "Player" : unit} ${trackId}`;
  const candidateLabel = cleanLabel(row.label, fallbackLabel);
  const genericFootballLabel = /^(?:QB|RB|FB|WR|TE|OL|LT|LG|C|RG|RT|DL|DE|DT|NT|LB|CB|DB|S|FS|SS|REF|Player|Offense|Defense|Official|Unknown)(?:\s+[A-Za-z0-9_-]+)?$/i.test(candidateLabel);
  const jerseyNumber = row.jerseyNumber === null || row.jerseyNumber === undefined || row.jerseyNumber === ""
    ? null
    : String(row.jerseyNumber).slice(0, 4);
  const normalizedFieldPoint = row.fieldPoint ? normalizePoint(row.fieldPoint) : null;
  const fieldPoint = normalizedFieldPoint && normalizedFieldPoint.confidence > 0 ? normalizedFieldPoint : null;
  return {
    trackId,
    unit,
    label: genericFootballLabel ? candidateLabel : fallbackLabel,
    jerseyNumber,
    bbox: normalizeBox(row.bbox),
    imagePoint: normalizePoint(row.imagePoint),
    fieldPoint,
    occluded: Boolean(row.occluded),
    manuallyCorrected: false,
  };
}

function normalizeBall(value: unknown): TwinTrackedBall {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const visible = Boolean(row.visible);
  return {
    visible,
    bbox: visible && row.bbox ? normalizeBox(row.bbox) : null,
    imagePoint: visible && row.imagePoint ? normalizePoint(row.imagePoint) : null,
    fieldPoint: visible && row.fieldPoint ? normalizePoint(row.fieldPoint) : null,
    possessedByTrackId: row.possessedByTrackId ? String(row.possessedByTrackId).slice(0, 32) : null,
    manuallyCorrected: false,
  };
}

function normalizeCalibration(value: RawTrackingResult["calibration"], limitations: unknown[]): TwinFieldCalibration {
  const quality = ["unavailable", "low", "moderate", "high"].includes(String(value?.quality))
    ? value?.quality as TwinFieldCalibration["quality"]
    : "low";
  const cleanPoints = (items: unknown) => Array.isArray(items)
    ? items.slice(0, 8).map((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return { x: clampTwinUnitPoint(Number(row.x) || 0), y: clampTwinUnitPoint(Number(row.y) || 0) };
      })
    : [];
  return {
    quality,
    method: "ai_estimate",
    confidence: clampTwinConfidence(Number(value?.confidence) || 0),
    imagePoints: cleanPoints(value?.imagePoints),
    fieldPoints: cleanPoints(value?.fieldPoints),
    limitations: Array.isArray(limitations)
      ? limitations.map((item) => String(item || "").slice(0, 180)).filter(Boolean).slice(0, 6)
      : ["Field coordinates are AI estimates and require coach verification."],
  };
}

const pointSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["x", "y", "confidence"],
  additionalProperties: false,
} as const;

const boxSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
    width: { type: "number", minimum: 0, maximum: 1 },
    height: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["x", "y", "width", "height"],
  additionalProperties: false,
} as const;

export async function analyzeTwinFrameBatch(input: {
  frames: TwinTrackingInputFrame[];
  priorTracks?: Array<Pick<TwinTrackedPlayer, "trackId" | "unit" | "label" | "imagePoint">>;
}) {
  const frames = input.frames.slice(0, MAX_TWIN_TRACKING_BATCH);
  if (frames.length === 0) throw new Error("At least one source frame is required");

  const frameOrder = frames.map((frame) => ({ frameIndex: frame.frameIndex, timestampMs: frame.timestampMs }));
  const imageParts = frames.map((frame) => ({ type: "image_url" as const, image_url: { url: frame.dataUrl, detail: "low" as const } }));
  const prompt = `Track American-football players and the football across these chronological source frames.

Frame order: ${JSON.stringify(frameOrder)}
Prior anonymous tracks from the immediately previous batch: ${JSON.stringify(input.priorTracks ?? [])}

Rules:
1. Detect only visible humans participating in or officiating the play. Return normalized image bounding boxes and foot-center points from 0 to 1.
2. Assign anonymous stable track IDs such as O1, D1, U1, or REF1. Reuse prior track IDs only when position and appearance support the association. Never invent a name. A jersey number may be returned only when clearly readable; otherwise null.
3. Classify unit as offense, defense, official, or unknown. If possession/team is unclear, use unknown instead of guessing. Use an empty jerseyNumber string when unreadable.
4. Detect the football only when visible. When hidden or uncertain, visible=false, possessedByTrackId="", and return zero-confidence placeholder points/box. Never hallucinate a ball.
5. Estimate normalized field coordinates only when field lines support it. Use confidence=0 and x=0,y=0 when unavailable. Confidence must fall when perspective, occlusion, blur, or camera movement weakens the estimate.
6. Return one result for every supplied frame index. Include concise limitations. This is computer-vision assistance for coach review, not verified player identity or official tracking data.

Output only the requested JSON.`;

  const requestTracking = (model: string) => invokeLLM({
    model,
    maxTokens: 16_384,
    messages: [
      { role: "system", content: "You are an evidence-first American-football computer-vision tracker. Never invent player identities, jersey numbers, a ball, or precise field coordinates when the pixels do not support them." },
      { role: "user", content: [{ type: "text", text: prompt }, ...imageParts] },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "tactical_twin_tracking_batch",
        strict: true,
        schema: {
          type: "object",
          properties: {
            frames: {
              type: "array",
              minItems: frames.length,
              maxItems: frames.length,
              items: {
                type: "object",
                properties: {
                  frameIndex: { type: "integer", minimum: 0 },
                  players: {
                    type: "array",
                    maxItems: 24,
                    items: {
                      type: "object",
                      properties: {
                        trackId: { type: "string" },
                        unit: { type: "string", enum: ["offense", "defense", "official", "unknown"] },
                        label: { type: "string" },
                        jerseyNumber: { type: "string" },
                        bbox: boxSchema,
                        imagePoint: pointSchema,
                        fieldPoint: pointSchema,
                        occluded: { type: "boolean" },
                      },
                      required: ["trackId", "unit", "label", "jerseyNumber", "bbox", "imagePoint", "fieldPoint", "occluded"],
                      additionalProperties: false,
                    },
                  },
                  ball: {
                    type: "object",
                    properties: {
                      visible: { type: "boolean" },
                      bbox: boxSchema,
                      imagePoint: pointSchema,
                      fieldPoint: pointSchema,
                      possessedByTrackId: { type: "string" },
                    },
                    required: ["visible", "bbox", "imagePoint", "fieldPoint", "possessedByTrackId"],
                    additionalProperties: false,
                  },
                  frameConfidence: { type: "integer", minimum: 0, maximum: 100 },
                },
                required: ["frameIndex", "players", "ball", "frameConfidence"],
                additionalProperties: false,
              },
            },
            calibration: {
              type: "object",
              properties: {
                quality: { type: "string", enum: ["unavailable", "low", "moderate", "high"] },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
                imagePoints: { type: "array", maxItems: 8, items: { type: "object", properties: { x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 } }, required: ["x", "y"], additionalProperties: false } },
                fieldPoints: { type: "array", maxItems: 8, items: { type: "object", properties: { x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 } }, required: ["x", "y"], additionalProperties: false } },
              },
              required: ["quality", "confidence", "imagePoints", "fieldPoints"],
              additionalProperties: false,
            },
            limitations: { type: "array", maxItems: 6, items: { type: "string" } },
          },
          required: ["frames", "calibration", "limitations"],
          additionalProperties: false,
        },
      },
    },
  });

  const compactPrompt = `${prompt}\nReturn ONLY compact JSON in this exact shape: {"f":[{"i":FRAME_INDEX,"p":[{"id":"O1","u":"offense|defense|official|unknown","j":"","b":[x,y,width,height],"q":[footX,footY,confidence],"g":[fieldX,fieldY,confidence],"o":false}],"a":{"v":false,"b":[0,0,0,0],"q":[0,0,0],"g":[0,0,0],"h":""},"c":0}],"k":{"q":"unavailable|low|moderate|high","c":0,"ip":[],"fp":[]},"l":["limitation"]}. Include every supplied frame exactly once. Keep numbers to 2 decimals, omit prose, never use an entities key, and stay under 12000 output tokens.`;
  const requestCompactTracking = (model: string) => invokeLLM({
    model,
    maxTokens: 16_384,
    messages: [
      { role: "system", content: "You are an evidence-first American-football computer-vision tracker. Return one valid compact JSON object only. Never invent identities, jersey numbers, a ball, or field coordinates." },
      { role: "user", content: [{ type: "text", text: compactPrompt }, ...imageParts] },
    ],
  });

  let response = await requestCompactTracking(TWIN_TRACKING_MODEL);
  let raw = asText(response.choices?.[0]?.message?.content);
  let parsed: RawTrackingResult;
  try {
    if (!raw) throw new Error("Primary tracking model returned no content");
    parsed = raw.includes('"f"') ? expandCompactTracking(raw) : parseJson(raw);
  } catch (firstError) {
    console.warn("[TacticalTwinTracking] Primary compact response failed; retrying stronger model", {
      reason: firstError instanceof Error ? firstError.message.slice(0, 220) : "Unknown parse failure",
      response: emptyResponseSummary(response),
    });
    response = await requestCompactTracking(TWIN_TRACKING_FALLBACK_MODEL);
    raw = asText(response.choices?.[0]?.message?.content);
    if (!raw) {
      console.warn("[TacticalTwinTracking] Fallback model returned empty content", emptyResponseSummary(response));
      throw new Error("Tracking model returned no content");
    }
    parsed = raw.includes('"f"') ? expandCompactTracking(raw) : parseJson(raw);
  }
  const byFrame = new Map((parsed.frames ?? []).map((frame) => [Number(frame.frameIndex), frame]));
  const payloads: TwinTrackingFramePayload[] = frames.map((source) => {
    const result = byFrame.get(source.frameIndex) ?? {};
    return {
      frameIndex: source.frameIndex,
      timestampMs: source.timestampMs,
      imageWidth: source.imageWidth,
      imageHeight: source.imageHeight,
      players: Array.isArray(result.players) ? result.players.slice(0, 24).map(normalizePlayer) : [],
      ball: normalizeBall(result.ball),
      frameConfidence: clampTwinConfidence(Number(result.frameConfidence) || 0),
    };
  });

  return {
    frames: payloads,
    calibration: normalizeCalibration(parsed.calibration, parsed.limitations ?? []),
  };
}

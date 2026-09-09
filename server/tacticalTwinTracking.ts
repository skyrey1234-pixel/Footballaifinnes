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

function asText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("");
  }
  return content ? JSON.stringify(content) : "";
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
  const fieldPoint = row.fieldPoint ? normalizePoint(row.fieldPoint) : null;
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
  const imageParts = frames.map((frame) => ({ type: "image_url" as const, image_url: { url: frame.dataUrl, detail: "high" as const } }));
  const prompt = `Track American-football players and the football across these chronological source frames.

Frame order: ${JSON.stringify(frameOrder)}
Prior anonymous tracks from the immediately previous batch: ${JSON.stringify(input.priorTracks ?? [])}

Rules:
1. Detect only visible humans participating in or officiating the play. Return normalized image bounding boxes and foot-center points from 0 to 1.
2. Assign anonymous stable track IDs such as O1, D1, U1, or REF1. Reuse prior track IDs only when position and appearance support the association. Never invent a name. A jersey number may be returned only when clearly readable; otherwise null.
3. Classify unit as offense, defense, official, or unknown. If possession/team is unclear, use unknown instead of guessing.
4. Detect the football only when visible. When hidden or uncertain, visible=false and all ball points null. Never hallucinate a ball.
5. Estimate normalized field coordinates only when field lines support it. Confidence must fall when perspective, occlusion, blur, or camera movement weakens the estimate.
6. Return one result for every supplied frame index. Include concise limitations. This is computer-vision assistance for coach review, not verified player identity or official tracking data.

Output only the requested JSON.`;

  const response = await invokeLLM({
    model: TWIN_TRACKING_MODEL,
    maxTokens: 8_192,
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
                        jerseyNumber: { type: ["string", "null"] },
                        bbox: boxSchema,
                        imagePoint: pointSchema,
                        fieldPoint: { anyOf: [pointSchema, { type: "null" }] },
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
                      bbox: { anyOf: [boxSchema, { type: "null" }] },
                      imagePoint: { anyOf: [pointSchema, { type: "null" }] },
                      fieldPoint: { anyOf: [pointSchema, { type: "null" }] },
                      possessedByTrackId: { type: ["string", "null"] },
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

  const raw = asText(response.choices?.[0]?.message?.content);
  if (!raw) throw new Error("Tracking model returned no content");
  const parsed = parseJson(raw);
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

export type TwinTrackingStatus =
  | "queued"
  | "capturing"
  | "analyzing"
  | "review"
  | "approved"
  | "failed"
  | "canceled";

export type TwinTrackUnit = "offense" | "defense" | "official" | "unknown";

export interface TwinTrackPoint {
  x: number;
  y: number;
  confidence: number;
}

export interface TwinTrackedPlayer {
  trackId: string;
  unit: TwinTrackUnit;
  label: string;
  jerseyNumber?: string | null;
  bbox: { x: number; y: number; width: number; height: number };
  imagePoint: TwinTrackPoint;
  fieldPoint?: TwinTrackPoint | null;
  occluded: boolean;
  manuallyCorrected: boolean;
}

export interface TwinTrackedBall {
  visible: boolean;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  imagePoint?: TwinTrackPoint | null;
  fieldPoint?: TwinTrackPoint | null;
  possessedByTrackId?: string | null;
  manuallyCorrected: boolean;
}

export interface TwinTrackingFramePayload {
  frameIndex: number;
  timestampMs: number;
  imageWidth: number;
  imageHeight: number;
  players: TwinTrackedPlayer[];
  ball: TwinTrackedBall;
  frameConfidence: number;
}

export interface TwinFieldCalibration {
  quality: "unavailable" | "low" | "moderate" | "high";
  method: "ai_estimate" | "coach_points" | "homography" | "none";
  confidence: number;
  imagePoints: Array<{ x: number; y: number }>;
  fieldPoints: Array<{ x: number; y: number }>;
  limitations: string[];
}

export type TwinCinematicStatus =
  | "draft"
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "canceled";

export const TWIN_PLAYBACK_RATES = [0.25, 0.5, 0.75, 1] as const;
export type TwinPlaybackRate = (typeof TWIN_PLAYBACK_RATES)[number];

export const DEFAULT_TWIN_FRAME_RATE = 30;

export function clampTwinConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function clampTwinUnitPoint(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function frameToProgress(frameIndex: number, totalFrames: number) {
  if (totalFrames <= 1) return 0;
  return Math.max(0, Math.min(1, frameIndex / (totalFrames - 1)));
}

export function progressToFrame(progress: number, totalFrames: number) {
  if (totalFrames <= 1) return 0;
  return Math.round(Math.max(0, Math.min(1, progress)) * (totalFrames - 1));
}

export function stepFrame(frameIndex: number, direction: -1 | 1, totalFrames: number) {
  return Math.max(0, Math.min(Math.max(0, totalFrames - 1), frameIndex + direction));
}

export function millisecondsForFrame(frameIndex: number, frameRate: number) {
  const safeRate = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : DEFAULT_TWIN_FRAME_RATE;
  return Math.round((Math.max(0, frameIndex) / safeRate) * 1000);
}


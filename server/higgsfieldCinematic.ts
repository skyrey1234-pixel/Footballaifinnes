import { storageGetSignedUrl, storagePut } from "./storage";

const HIGGSFIELD_BASE_URL = "https://api.higgsfield.ai";
export const HIGGSFIELD_VIDEO_PATH = "wan-25-preview/image-to-video";
const TERMINAL_STATUSES = new Set(["completed", "failed", "nsfw", "canceled"]);

type HiggsfieldStatus = "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled";

export type HiggsfieldRequestStatus = {
  status: HiggsfieldStatus;
  request_id: string;
  status_url?: string;
  cancel_url?: string;
  error?: string | null;
  video?: { url: string; content_type?: string } | null;
  payload?: { video?: { url: string; content_type?: string } | null } | null;
};

function credentials() {
  const keyId = process.env.HF_API_KEY_ID?.trim();
  const keySecret = process.env.HF_API_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

function authorization() {
  const value = credentials();
  if (!value) throw new Error("Higgsfield API credentials are not configured");
  return `Key ${value.keyId}:${value.keySecret}`;
}

export function hasHiggsfieldCredentials() {
  return Boolean(credentials());
}

function safeRequestId(value: string) {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(value)) throw new Error("Invalid Higgsfield request ID");
  return value;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail = typeof body === "object" && body && "detail" in body ? String(body.detail) : String(body || response.statusText);
    throw new Error(`Higgsfield request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return body;
}

export async function submitHiggsfieldReplay(input: {
  sourceImageKey: string;
  prompt: string;
  durationSeconds: 5 | 10;
  webhookUrl?: string | null;
}) {
  const imageUrl = await storageGetSignedUrl(input.sourceImageKey);
  const endpoint = new URL(`${HIGGSFIELD_BASE_URL}/${HIGGSFIELD_VIDEO_PATH}`);
  if (input.webhookUrl) endpoint.searchParams.set("hf_webhook", input.webhookUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      seed: -1,
      prompt: input.prompt,
      negative_prompt: "new players, duplicated players, changing uniforms, changing team colors, changing jersey numbers, unreadable bodies, deformed anatomy, impossible football trajectory, text, watermark, logo, scoreboard",
      duration: input.durationSeconds,
      image_url: imageUrl,
      resolution: "720p",
    }),
  });
  const body = await parseResponse(response) as HiggsfieldRequestStatus;
  if (!body?.request_id) throw new Error("Higgsfield did not return a request ID");
  return body;
}

export async function getHiggsfieldReplayStatus(requestId: string) {
  const safeId = safeRequestId(requestId);
  const response = await fetch(`${HIGGSFIELD_BASE_URL}/requests/${encodeURIComponent(safeId)}/status`, {
    headers: { Authorization: authorization() },
  });
  return await parseResponse(response) as HiggsfieldRequestStatus;
}

export async function cancelHiggsfieldReplay(requestId: string) {
  const safeId = safeRequestId(requestId);
  const response = await fetch(`${HIGGSFIELD_BASE_URL}/requests/${encodeURIComponent(safeId)}/cancel`, {
    method: "POST",
    headers: { Authorization: authorization() },
  });
  if (response.status === 204) return;
  await parseResponse(response);
}

export function higgsfieldOutputUrl(result: HiggsfieldRequestStatus) {
  return result.video?.url ?? result.payload?.video?.url ?? null;
}

export function isHiggsfieldTerminal(status: string) {
  return TERMINAL_STATUSES.has(status);
}

export async function retainHiggsfieldVideo(input: { requestId: string; sourceUrl: string; reconstructionId: number }) {
  const source = new URL(input.sourceUrl);
  if (source.protocol !== "https:") throw new Error("Higgsfield output URL must use HTTPS");
  const response = await fetch(source, { redirect: "follow" });
  if (!response.ok) throw new Error(`Higgsfield output download failed (${response.status})`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > 80 * 1024 * 1024) throw new Error("Higgsfield output exceeded the 80 MB retention limit");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 80 * 1024 * 1024) throw new Error("Higgsfield output exceeded the 80 MB retention limit");
  const stored = await storagePut(
    `tactical-twin/${input.reconstructionId}/cinematic/${input.requestId}.mp4`,
    bytes,
    "video/mp4",
  );
  return stored;
}

export function buildHiggsfieldReplayPrompt(input: {
  style: "broadcast_cinematic" | "sideline_impact" | "all_22_orbit";
  coachPrompt?: string | null;
  evidenceContext?: string | null;
}) {
  const styleInstruction = input.style === "sideline_impact"
    ? "A grounded sideline tracking shot with a controlled speed ramp into the decisive football moment."
    : input.style === "all_22_orbit"
      ? "A restrained elevated all-22 camera orbit revealing spacing, leverage, and the ball path."
      : "A premium broadcast replay with a slow push-in, shallow parallax, and a clean dramatic finish.";
  return [
    styleInstruction,
    "Preserve the supplied American-football frame as the visual source of truth: same players, uniforms, team colors, field, formation, and lighting.",
    "Animate only a plausible continuation of the shown play. Keep bodies anatomically realistic and the football trajectory physically credible.",
    "Do not add names, statistics, logos, scoreboards, captions, or tactical claims. This output is a cinematic interpretation, not evidence.",
    input.evidenceContext ? `Use this coach-reviewed anonymous geometry only to preserve spacing and motion; do not render it as text: ${input.evidenceContext.slice(0, 3_500)}` : "No approved automatic tracking was attached; use only the source frame and saved reconstruction geometry.",
    input.coachPrompt?.trim().slice(0, 500) || "Emphasize spacing and the decisive matchup without inventing new action.",
  ].join(" ");
}

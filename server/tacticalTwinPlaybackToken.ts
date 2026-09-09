import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const TACTICAL_TWIN_PLAYBACK_TTL_MS = 6 * 60 * 60 * 1_000;

function signature(value: string) {
  if (!ENV.cookieSecret) throw new Error("Tactical Twin playback token secret is unavailable");
  return createHmac("sha256", ENV.cookieSecret).update(value).digest("base64url");
}

export function createTacticalTwinPlaybackToken(reconstructionId: number, userId: number, now = Date.now()) {
  const expiresAt = now + TACTICAL_TWIN_PLAYBACK_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ reconstructionId, userId, expiresAt }), "utf8").toString("base64url");
  return { token: `${payload}.${signature(payload)}`, expiresAt };
}

export function verifyTacticalTwinPlaybackToken(token: string, now = Date.now()) {
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const reconstructionId = Number(decoded.reconstructionId);
    const userId = Number(decoded.userId);
    const expiresAt = Number(decoded.expiresAt);
    if (!Number.isInteger(reconstructionId) || reconstructionId <= 0 || !Number.isInteger(userId) || userId <= 0) return null;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    return { reconstructionId, userId, expiresAt };
  } catch {
    return null;
  }
}

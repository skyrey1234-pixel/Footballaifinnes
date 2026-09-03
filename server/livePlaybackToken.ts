import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const PLAYBACK_TOKEN_TTL_MS = 6 * 60 * 60 * 1_000;

function signature(value: string) {
  if (!ENV.cookieSecret) throw new Error("Playback token secret is unavailable");
  return createHmac("sha256", ENV.cookieSecret).update(value).digest("base64url");
}

export function createLivePlaybackToken(sessionId: number, userId: number, now = Date.now()) {
  const expiresAt = now + PLAYBACK_TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ sessionId, userId, expiresAt }), "utf8").toString("base64url");
  return { token: `${payload}.${signature(payload)}`, expiresAt };
}

export function verifyLivePlaybackToken(token: string, now = Date.now()) {
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = signature(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const sessionId = Number(decoded.sessionId);
    const userId = Number(decoded.userId);
    const expiresAt = Number(decoded.expiresAt);
    if (!Number.isInteger(sessionId) || sessionId <= 0 || !Number.isInteger(userId) || userId <= 0) return null;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    return { sessionId, userId, expiresAt };
  } catch {
    return null;
  }
}

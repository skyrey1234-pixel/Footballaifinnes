import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

const TV_TOKEN_TTL_MS = 12 * 60 * 60 * 1_000;

function sign(value: string) {
  if (!ENV.cookieSecret) throw new Error("TV View token secret is unavailable");
  return createHmac("sha256", ENV.cookieSecret).update(value).digest("base64url");
}

export function createLiveTvToken(sessionId: number, userId: number, now = Date.now()) {
  const expiresAt = now + TV_TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ scope: "live-tv", sessionId, userId, expiresAt }), "utf8").toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyLiveTvToken(token: string, now = Date.now()) {
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = sign(payload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    const sessionId = Number(decoded.sessionId);
    const userId = Number(decoded.userId);
    const expiresAt = Number(decoded.expiresAt);
    if (decoded.scope !== "live-tv") return null;
    if (!Number.isInteger(sessionId) || sessionId <= 0 || !Number.isInteger(userId) || userId <= 0) return null;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    return { sessionId, userId, expiresAt };
  } catch {
    return null;
  }
}

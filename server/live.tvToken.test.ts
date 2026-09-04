import { describe, expect, it } from "vitest";
import { createLiveTvToken, verifyLiveTvToken } from "./liveTvToken";

describe("Live TV View tokens", () => {
  it("binds an expiring token to one session and owner", () => {
    const now = 1_800_000_000_000;
    const { token, expiresAt } = createLiveTvToken(55, 7, now);
    expect(verifyLiveTvToken(token, now + 1_000)).toEqual({ sessionId: 55, userId: 7, expiresAt });
    expect(verifyLiveTvToken(token, expiresAt)).toBeNull();
  });

  it("rejects tampered and malformed tokens", () => {
    const { token } = createLiveTvToken(55, 7, 1_800_000_000_000);
    expect(verifyLiveTvToken(`${token}x`, 1_800_000_000_100)).toBeNull();
    expect(verifyLiveTvToken("not-a-token", 1_800_000_000_100)).toBeNull();
  });
});

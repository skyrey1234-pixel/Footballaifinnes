import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "live-playback-test-secret" } }));

import { createLivePlaybackToken, verifyLivePlaybackToken } from "./livePlaybackToken";

describe("Live replay playback tokens", () => {
  it("round-trips an owner and session scoped token", () => {
    const issued = createLivePlaybackToken(55, 9, 1_000);
    expect(verifyLivePlaybackToken(issued.token, 2_000)).toEqual({ sessionId: 55, userId: 9, expiresAt: issued.expiresAt });
  });

  it("rejects modified signatures", () => {
    const { token } = createLivePlaybackToken(55, 9, 1_000);
    expect(verifyLivePlaybackToken(`${token.slice(0, -1)}x`, 2_000)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const issued = createLivePlaybackToken(55, 9, 1_000);
    expect(verifyLivePlaybackToken(issued.token, issued.expiresAt + 1)).toBeNull();
  });
});

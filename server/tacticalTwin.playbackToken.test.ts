import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "tactical-twin-playback-test-secret" } }));

import { createTacticalTwinPlaybackToken, verifyTacticalTwinPlaybackToken } from "./tacticalTwinPlaybackToken";

describe("Tactical Twin playback tokens", () => {
  it("round-trips an owner and reconstruction-scoped token", () => {
    const issued = createTacticalTwinPlaybackToken(77, 9, 1_000);
    expect(verifyTacticalTwinPlaybackToken(issued.token, 2_000)).toEqual({ reconstructionId: 77, userId: 9, expiresAt: issued.expiresAt });
  });

  it("rejects modified signatures", () => {
    const { token } = createTacticalTwinPlaybackToken(77, 9, 1_000);
    expect(verifyTacticalTwinPlaybackToken(`${token.slice(0, -1)}x`, 2_000)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const issued = createTacticalTwinPlaybackToken(77, 9, 1_000);
    expect(verifyTacticalTwinPlaybackToken(issued.token, issued.expiresAt + 1)).toBeNull();
  });
});

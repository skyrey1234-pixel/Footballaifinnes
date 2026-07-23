import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import { PLAYBOOK } from "./warRoomRouter";

function createAuthContext() {
  return {
    user: { id: 1, openId: "test-user", name: "Test Coach", email: "coach@test.com", role: "admin" as const, loginMethod: "manus", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as never,
    res: { clearCookie: () => {}, cookie: () => {} } as never,
  };
}

describe("warRoom router", () => {
  it("registers all 9 war room procedures", () => {
    const procedures = Object.keys((appRouter as any)._def.procedures).filter((k) => k.startsWith("warRoom."));
    const expected = ["councils", "opponentDna", "momentum", "askFilm", "predict", "counterPlay", "whatIf", "practicePlan", "scoutTeam", "quiz"];
    for (const p of expected) {
      expect(procedures).toContain(`warRoom.${p}`);
    }
  });

  it("ships a playbook with 6 concepts covering run/pass/rpo families", () => {
    expect(PLAYBOOK.length).toBe(6);
    const families = new Set(PLAYBOOK.map((p) => p.family));
    expect(families.has("run")).toBe(true);
    expect(families.has("pass")).toBe(true);
    expect(families.has("rpo")).toBe(true);
  });

  it("whatIf simulator is deterministic and bounded", async () => {
    const caller = appRouter.createCaller(createAuthContext() as any);
    const input = { sessionId: 999999, playFamily: "inside_run" as const, fitLocation: "a_gap" as const, aggression: 70 };
    const r1 = await caller.warRoom.whatIf(input);
    const r2 = await caller.warRoom.whatIf(input);
    expect(r1.stopProbability).toBe(r2.stopProbability);
    expect(r1.stopProbability).toBeGreaterThanOrEqual(5);
    expect(r1.stopProbability).toBeLessThanOrEqual(95);
    expect(r1.baseline).toBe(58);
    expect(typeof r1.explanation).toBe("string");
    expect(r1.explanation.length).toBeGreaterThan(20);
  });

  it("whatIf aggression shifts stop probability directionally", async () => {
    const caller = appRouter.createCaller(createAuthContext() as any);
    const low = await caller.warRoom.whatIf({ sessionId: 1, playFamily: "inside_run", fitLocation: "a_gap", aggression: 10 });
    const high = await caller.warRoom.whatIf({ sessionId: 1, playFamily: "inside_run", fitLocation: "a_gap", aggression: 90 });
    expect(high.stopProbability).toBeGreaterThan(low.stopProbability);
    // High aggression should carry a bigger play-action tradeoff warning
    expect(high.tradeoff).toContain("play-action");
  });

  it("whatIf wrong fit costs stop probability", async () => {
    const caller = appRouter.createCaller(createAuthContext() as any);
    const rightFit = await caller.warRoom.whatIf({ sessionId: 1, playFamily: "outside_run", fitLocation: "edge", aggression: 50 });
    const wrongFit = await caller.warRoom.whatIf({ sessionId: 1, playFamily: "outside_run", fitLocation: "a_gap", aggression: 50 });
    expect(rightFit.stopProbability).toBeGreaterThan(wrongFit.stopProbability);
  });
});

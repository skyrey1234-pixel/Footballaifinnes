import { emptyLiveGameMemory, mergeLiveGameMemory, normalizeLiveGameMemory, type LiveWindowResult } from "./liveMemory";
import { describe, expect, it } from "vitest";

function result(overrides: Partial<LiveWindowResult> = {}): LiveWindowResult {
  return {
    visibleAction: "Inside zone",
    teamPhase: "offense",
    phaseReason: "Possession and alignment indicate offense.",
    formation: "Shotgun trips",
    personnel: "11 personnel",
    defensiveLook: "4-2-5 nickel",
    playCall: "Inside zone",
    predictionSummary: "Run or quick pass next.",
    nextPlayProbabilities: [{ label: "Run", probability: 60, reason: "Light box" }, { label: "Quick pass", probability: 40, reason: "Corner leverage" }],
    offenseInsights: { summary: "Spread run game", tendencies: ["Trips into inside zone"], strengths: ["Spacing"], vulnerabilities: ["Interior pressure"] },
    defenseInsights: { summary: "Nickel structure", tendencies: ["Two-high shell"], strengths: ["Speed"], vulnerabilities: ["Light box"] },
    impactPlayers: [{ playerLabel: "Running back — identity unclear", unit: "offense", reason: "Created yards after contact", evidenceFrameIndex: 2, confidence: 80 }],
    keyMatchups: ["RB vs interior linebackers"],
    tendencyShift: "No confirmed shift",
    counterCall: "Fit the box with safety support",
    riskLevel: "moderate",
    alerts: [],
    evidence: [{ frameIndex: 2, observation: "Back crosses the line behind zone tracks" }],
    confidence: 80,
    ...overrides,
  };
}

describe("Live whole-game memory", () => {
  it("accumulates offense and defense intelligence across windows", () => {
    const first = mergeLiveGameMemory(emptyLiveGameMemory(), result(), 0);
    const second = mergeLiveGameMemory(first, result({ teamPhase: "defense", playCall: "Quick out", defensiveLook: "Cover 3" }), 1);
    expect(second.totalWindows).toBe(2);
    expect(second.phaseCounts.offense).toBe(1);
    expect(second.phaseCounts.defense).toBe(1);
    expect(second.offense.calls["Inside zone"]).toBe(1);
    expect(second.offense.calls["Quick out"]).toBe(1);
    expect(second.defense.looks["Cover 3"]).toBe(1);
  });

  it("does not double-count a retried or out-of-order window", () => {
    const first = mergeLiveGameMemory(emptyLiveGameMemory(), result(), 2);
    const duplicate = mergeLiveGameMemory(first, result(), 2);
    const stale = mergeLiveGameMemory(duplicate, result(), 1);
    expect(stale.totalWindows).toBe(1);
    expect(stale.impactPlayers[0]?.mentions).toBe(1);
  });

  it("ranks repeatedly visible impact players without fabricating identities", () => {
    const first = mergeLiveGameMemory(null, result(), 0);
    const second = mergeLiveGameMemory(first, result({ confidence: 90 }), 1);
    expect(second.impactPlayers[0]?.playerLabel).toContain("identity unclear");
    expect(second.impactPlayers[0]?.mentions).toBe(2);
    expect(second.impactPlayers[0]?.averageConfidence).toBe(80);
  });

  it("normalizes missing persisted memory after refresh", () => {
    const memory = normalizeLiveGameMemory({ totalWindows: 3, offense: { calls: { Run: 2 } } });
    expect(memory.totalWindows).toBe(3);
    expect(memory.offense.calls.Run).toBe(2);
    expect(memory.defense.looks).toEqual({});
  });
});

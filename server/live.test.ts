import { appRouter } from "./routers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as db from "./db";
import { normalizeLiveResult, parseLiveJson, type LiveWindowResult } from "./liveAnalysis";
import type { TrpcContext } from "./_core/context";

const adminContext = {
  user: {
    id: 1,
    openId: "live-admin-test",
    name: "Live Admin",
    email: "live-admin@example.invalid",
    loginMethod: "test",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: {} },
  res: {},
} as unknown as TrpcContext;

const viewerContext = {
  ...adminContext,
  user: { ...adminContext.user!, id: 2, role: "user" as const },
} as TrpcContext;

function liveResult(overrides: Partial<LiveWindowResult> = {}): LiveWindowResult {
  return {
    visibleAction: "Shotgun pre-snap alignment",
    teamPhase: "offense",
    phaseReason: "The entered possession and visible offensive alignment agree.",
    formation: "Trips right",
    personnel: "11 personnel",
    defensiveLook: "Nickel shell",
    playCall: "Pre-snap",
    predictionSummary: "Inside zone and quick game are the top two possibilities.",
    nextPlayProbabilities: [
      { label: "Inside zone", probability: 6, reason: "Light box." },
      { label: "Quick pass", probability: 4, reason: "Trips leverage." },
    ],
    offenseInsights: { summary: "Spread structure.", tendencies: ["Trips strength"], strengths: ["Spacing"], vulnerabilities: ["Interior pressure"] },
    defenseInsights: { summary: "Nickel shell.", tendencies: ["Two-high disguise"], strengths: ["Speed"], vulnerabilities: ["Light box"] },
    impactPlayers: [{ playerLabel: "Boundary WR — identity unclear", unit: "offense", reason: "Commands cushion.", evidenceFrameIndex: 0, confidence: 72 }],
    keyMatchups: ["Boundary WR vs off corner"],
    tendencyShift: "No confirmed shift.",
    counterCall: "Run at the light box.",
    riskLevel: "moderate",
    alerts: [],
    evidence: [{ frameIndex: 0, observation: "Trips alignment is visible." }],
    confidence: 82,
    ...overrides,
  };
}

describe("Live Game Intelligence", () => {
  let liveSessionId = 0;

  beforeAll(async () => {
    liveSessionId = await db.createLiveGameSession({
      userId: 1,
      name: "Live integration test",
      opponentName: "Test Opponent",
      sourceType: "camera",
      status: "ready",
      analysisIntervalSeconds: 5,
    });
  });

  afterAll(async () => {
    if (liveSessionId) await db.deleteLiveGameSession(liveSessionId, 1);
  });

  it("returns exactly two normalized next-play predictions and clamps confidence", () => {
    const normalized = normalizeLiveResult(liveResult({
      nextPlayProbabilities: [
        { label: "Pass", probability: 6, reason: "Detached receivers." },
        { label: "Run", probability: 3, reason: "Light box." },
        { label: "Screen", probability: 1, reason: "Pressure answer." },
      ],
      confidence: 112,
    }));
    expect(normalized.nextPlayProbabilities).toHaveLength(2);
    expect(normalized.nextPlayProbabilities.reduce((sum, item) => sum + item.probability, 0)).toBe(100);
    expect(normalized.nextPlayProbabilities.map((item) => item.probability)).toEqual([67, 33]);
    expect(normalized.confidence).toBe(100);
  });

  it("accepts a fenced structured response without weakening JSON parsing", () => {
    const parsed = parseLiveJson(`\`\`\`json\n${JSON.stringify(liveResult())}\n\`\`\``);
    expect(parsed.formation).toBe("Trips right");
    expect(parsed.teamPhase).toBe("offense");
  });

  it("converts zero-to-one confidence and preserves identity-safe player labels", () => {
    const normalized = normalizeLiveResult(liveResult({ confidence: 0.72 }));
    expect(normalized.confidence).toBe(72);
    expect(normalized.impactPlayers[0]?.playerLabel).toContain("identity unclear");
  });

  it("prevents viewers from creating a live session", async () => {
    const caller = appRouter.createCaller(viewerContext);
    await expect(caller.live.create({
      name: "Forbidden session",
      opponentName: "Opponent",
      sourceType: "camera",
      analysisIntervalSeconds: 5,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps live sessions owner scoped", async () => {
    const ownerSession = await db.getLiveGameSession(liveSessionId, 1);
    const otherUserSession = await db.getLiveGameSession(liveSessionId, 999_999);
    expect(ownerSession?.analysisIntervalSeconds).toBe(5);
    expect(otherUserSession).toBeUndefined();
  });

  it("upserts duplicate five-second windows instead of duplicating events", async () => {
    const result = liveResult();
    const base = {
      liveSessionId,
      userId: 1,
      windowIndex: 0,
      windowStartSeconds: 0,
      windowEndSeconds: 5,
      visibleAction: result.visibleAction,
      teamPhase: result.teamPhase,
      phaseReason: result.phaseReason,
      formation: result.formation,
      personnel: result.personnel,
      defensiveLook: result.defensiveLook,
      playCall: result.playCall,
      predictionSummary: result.predictionSummary,
      nextPlayProbabilities: result.nextPlayProbabilities,
      offenseInsights: result.offenseInsights,
      defenseInsights: result.defenseInsights,
      impactPlayers: result.impactPlayers,
      keyMatchups: result.keyMatchups,
      tendencyShift: result.tendencyShift,
      counterCall: result.counterCall,
      riskLevel: result.riskLevel,
      alerts: result.alerts,
      evidence: result.evidence,
      confidence: result.confidence,
      inputFrameCount: 4,
      latencyMs: 900,
    };
    await db.saveLiveAnalysisEvent(base);
    await db.saveLiveAnalysisEvent({ ...base, predictionSummary: "Updated estimate", confidence: 88 });

    const events = await db.listLiveAnalysisEvents(liveSessionId, 1);
    expect(events).toHaveLength(1);
    expect(events[0]?.windowEndSeconds).toBe(5);
    expect(events[0]?.predictionSummary).toBe("Updated estimate");
    expect(events[0]?.confidence).toBe(88);
  });
});

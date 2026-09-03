import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
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

describe("Live Game Intelligence", () => {
  let liveSessionId = 0;

  beforeAll(async () => {
    liveSessionId = await db.createLiveGameSession({
      userId: 1,
      name: "Live integration test",
      opponentName: "Test Opponent",
      sourceType: "camera",
      status: "ready",
      analysisIntervalSeconds: 15,
    });
  });

  afterAll(async () => {
    if (liveSessionId) await db.deleteLiveGameSession(liveSessionId, 1);
  });

  it("normalizes next-play probabilities and confidence", () => {
    const raw: LiveWindowResult = {
      visibleAction: "Shotgun pre-snap alignment",
      formation: "Trips right",
      personnel: "11 personnel",
      defensiveLook: "Nickel shell",
      playCall: "Pre-snap",
      predictionSummary: "Pass is the leading estimate.",
      nextPlayProbabilities: [
        { label: "Pass", probability: 6, reason: "Three detached receivers." },
        { label: "Run", probability: 3, reason: "Light box." },
        { label: "Screen", probability: 1, reason: "Pressure answer." },
      ],
      tendencyShift: "No confirmed shift.",
      counterCall: "Show pressure and bail.",
      riskLevel: "moderate",
      alerts: [],
      evidence: [{ frameIndex: 0, observation: "Trips alignment is visible." }],
      confidence: 112,
    };

    const normalized = normalizeLiveResult(raw);
    expect(normalized.nextPlayProbabilities.reduce((sum, item) => sum + item.probability, 0)).toBe(100);
    expect(normalized.nextPlayProbabilities.map((item) => item.probability)).toEqual([60, 30, 10]);
    expect(normalized.confidence).toBe(100);
  });

  it("accepts a fenced structured response without weakening JSON parsing", () => {
    const parsed = parseLiveJson('```json\n{"visibleAction":"Pre-snap","formation":"Spread","personnel":"11","defensiveLook":"Nickel","playCall":"Unclear","predictionSummary":"Pass lean","nextPlayProbabilities":[],"tendencyShift":"None","counterCall":"Hold","riskLevel":"low","alerts":[],"evidence":[],"confidence":50}\n```');
    expect(parsed.formation).toBe("Spread");
    expect(parsed.confidence).toBe(50);
  });

  it("converts a zero-to-one confidence response to the UI percentage scale", () => {
    const normalized = normalizeLiveResult({
      visibleAction: "Static pre-snap look",
      formation: "Unclear",
      personnel: "Unclear",
      defensiveLook: "Unclear",
      playCall: "Unclear",
      predictionSummary: "Low-evidence estimate",
      nextPlayProbabilities: [],
      tendencyShift: "None",
      counterCall: "Confirm the look",
      riskLevel: "low",
      alerts: [],
      evidence: [],
      confidence: 0.72,
    });
    expect(normalized.confidence).toBe(72);
  });

  it("prevents viewers from creating a live session", async () => {
    const caller = appRouter.createCaller(viewerContext);
    await expect(caller.live.create({
      name: "Forbidden session",
      opponentName: "Opponent",
      sourceType: "camera",
      analysisIntervalSeconds: 15,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps live sessions owner scoped", async () => {
    const ownerSession = await db.getLiveGameSession(liveSessionId, 1);
    const otherUserSession = await db.getLiveGameSession(liveSessionId, 999_999);
    expect(ownerSession?.name).toBe("Live integration test");
    expect(otherUserSession).toBeUndefined();
  });

  it("upserts duplicate 15-second windows instead of duplicating events", async () => {
    const base = {
      liveSessionId,
      userId: 1,
      windowIndex: 0,
      windowStartSeconds: 0,
      windowEndSeconds: 15,
      formation: "Trips right",
      playCall: "Inside zone",
      predictionSummary: "Initial estimate",
      nextPlayProbabilities: [{ label: "Run", probability: 60, reason: "Light box" }],
      riskLevel: "low" as const,
      confidence: 70,
      inputFrameCount: 4,
    };
    await db.saveLiveAnalysisEvent(base);
    await db.saveLiveAnalysisEvent({ ...base, predictionSummary: "Updated estimate", confidence: 82 });

    const events = await db.listLiveAnalysisEvents(liveSessionId, 1);
    expect(events).toHaveLength(1);
    expect(events[0]?.predictionSummary).toBe("Updated estimate");
    expect(events[0]?.confidence).toBe(82);
  });
});

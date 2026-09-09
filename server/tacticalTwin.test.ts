import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const signedUrlMock = vi.hoisted(() => vi.fn(async (key: string) => `https://storage.example/${key}?signed=1`));

vi.mock("./storage", () => ({
  storageGetSignedUrl: signedUrlMock,
  storageGet: vi.fn(),
  storagePut: vi.fn(),
}));

import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import { buildDefaultBallPath, buildDefaultTwinPlayers } from "../shared/tacticalTwin";

function context(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `twin-user-${userId}`,
      name: `Twin Coach ${userId}`,
      email: `twin-${userId}@example.invalid`,
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} },
    res: {},
  } as unknown as TrpcContext;
}

describe("Tactical Twin Stage 1", () => {
  let gameSessionId = 0;
  let liveSessionId = 0;
  let liveEventId = 0;
  let filmTwinId = 0;

  beforeAll(async () => {
    gameSessionId = await db.createGameSession({
      userId: 1,
      opponentName: "Twin Test Opponent",
      sourceType: "upload",
      videoUrl: "https://example.invalid/twin-test.mp4",
      videoFileKey: "videos/twin-test.mp4",
      status: "complete",
    });
    liveSessionId = await db.createLiveGameSession({
      userId: 1,
      name: "Twin Live Test",
      opponentName: "Live Twin Opponent",
      sourceType: "camera",
      status: "paused",
      analysisIntervalSeconds: 5,
    });
    await db.saveLiveAnalysisEvent({
      liveSessionId,
      userId: 1,
      windowIndex: 7,
      windowStartSeconds: 35,
      windowEndSeconds: 40,
      visibleAction: "Quarterback completes a boundary throw",
      teamPhase: "offense",
      phaseReason: "The offense is controlling the snap and route distribution.",
      formation: "Trips Right",
      personnel: "11 personnel",
      defensiveLook: "Nickel Cover 3",
      playCall: "Boundary flood concept",
      predictionSummary: "The offense attacked the outside third with a layered route.",
      nextPlayProbabilities: [
        { label: "Inside zone", probability: 55, reason: "Light box" },
        { label: "Quick out", probability: 45, reason: "Corner cushion" },
      ],
      offenseInsights: {},
      defenseInsights: {},
      impactPlayers: [],
      keyMatchups: [],
      tendencyShift: "No confirmed shift",
      counterCall: "Cloud the boundary corner",
      riskLevel: "moderate",
      alerts: [],
      evidence: [{ frameIndex: 0, observation: "Trips formation visible" }],
      confidence: 84,
      inputFrameCount: 3,
      latencyMs: 1200,
    });
    const event = await db.getLiveAnalysisEventByWindow(liveSessionId, 1, 7);
    liveEventId = event!.id;
  });

  afterAll(async () => {
    if (gameSessionId) await db.deleteGameSession(gameSessionId).catch(() => {});
    if (liveSessionId) await db.deleteLiveGameSession(liveSessionId, 1).catch(() => {});
  });

  it("builds a complete 22-player editable draft and ball path", () => {
    const players = buildDefaultTwinPlayers("Shotgun 2x2", "pass", "Y");
    expect(players).toHaveLength(22);
    expect(players.filter((player) => player.side === "offense")).toHaveLength(11);
    expect(players.filter((player) => player.side === "defense")).toHaveLength(11);
    expect(buildDefaultBallPath(players, "pass").length).toBeGreaterThanOrEqual(2);
    for (const player of players) {
      expect(player.x).toBeGreaterThanOrEqual(0);
      expect(player.x).toBeLessThanOrEqual(100);
      expect(player.y).toBeGreaterThanOrEqual(0);
      expect(player.y).toBeLessThanOrEqual(100);
    }
  });

  it("creates one idempotent owner-scoped film reconstruction", async () => {
    const caller = appRouter.createCaller(context(1));
    const input = {
      sessionId: gameSessionId,
      sourceKind: "film_highlight" as const,
      sourceIndex: 0,
      title: "Boundary completion",
      description: "Trips flood against Cover 3",
      startSeconds: 42,
      durationSeconds: 12,
      formation: "Trips Right",
      playType: "pass" as const,
      target: "Y",
      confidence: 76,
    };
    const first = await caller.tacticalTwin.createFromFilm(input);
    const repeated = await caller.tacticalTwin.createFromFilm(input);
    filmTwinId = first.id;
    expect(repeated.id).toBe(first.id);
    expect(first.userId).toBe(1);
    expect(first.sourceStartSeconds).toBe(42);
    expect(first.sourceEndSeconds).toBe(54);
    expect(first.players).toHaveLength(22);
  });

  it("does not expose another owner’s reconstruction or source session", async () => {
    const caller = appRouter.createCaller(context(2));
    await expect(caller.tacticalTwin.get({ id: filmTwinId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.tacticalTwin.createFromFilm({
      sessionId: gameSessionId,
      sourceKind: "film_highlight",
      sourceIndex: 1,
      title: "Forbidden reconstruction",
      startSeconds: 55,
      durationSeconds: 12,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns a fresh direct signed playback URL only for the owning coach", async () => {
    const owner = appRouter.createCaller(context(1));
    const playback = await owner.tacticalTwin.playbackUrl({ id: filmTwinId });
    expect(playback.url).toBe("https://storage.example/videos/twin-test.mp4?signed=1");
    expect(playback.expiresAt).toBeGreaterThan(Date.now());
    expect(signedUrlMock).toHaveBeenCalledWith("videos/twin-test.mp4");

    const otherCoach = appRouter.createCaller(context(2));
    await expect(otherCoach.tacticalTwin.playbackUrl({ id: filmTwinId })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("saves coach edits and promotes a verified Twin to reviewed status", async () => {
    const caller = appRouter.createCaller(context(1));
    const current = await caller.tacticalTwin.get({ id: filmTwinId });
    const players = current.players as ReturnType<typeof buildDefaultTwinPlayers>;
    const updated = await caller.tacticalTwin.update({
      id: filmTwinId,
      title: "Boundary completion — corrected",
      formation: "Trips Right",
      playType: "pass",
      target: "Y",
      defenseScheme: "Nickel Cover 3",
      players: players.map((player, index) => index === 0 ? { ...player, x: 36, route: [...player.route, { x: 42, y: 39 }] } : player),
      ballPath: [{ x: 50, y: 64 }, { x: 58, y: 42 }, { x: 70, y: 28 }],
      markers: [{ id: "fix-1", kind: "correction", label: "THROW WINDOW", x: 70, y: 28 }],
      coachingNotes: "Hold the hook defender, then layer the throw outside him.",
      confidence: 91,
      coachVerified: true,
    });
    expect(updated?.status).toBe("reviewed");
    expect(updated?.coachVerified).toBe(1);
    expect(updated?.markers).toHaveLength(1);
    expect(updated?.title).toContain("corrected");
  });

  it("rejects route coordinates outside the normalized field", async () => {
    const caller = appRouter.createCaller(context(1));
    const current = await caller.tacticalTwin.get({ id: filmTwinId });
    const players = current.players as ReturnType<typeof buildDefaultTwinPlayers>;
    await expect(caller.tacticalTwin.update({
      id: filmTwinId,
      title: current.title,
      formation: current.formation,
      playType: current.playType as "pass",
      target: current.target,
      defenseScheme: current.defenseScheme,
      players: [{ ...players[0], x: 140 }],
      ballPath: [],
      markers: [],
      coachingNotes: null,
      confidence: 50,
      coachVerified: false,
    })).rejects.toBeTruthy();
  });

  it("creates a Live evidence Twin without pretending local camera footage was stored", async () => {
    const caller = appRouter.createCaller(context(1));
    const twin = await caller.tacticalTwin.createFromLive({ liveSessionId, liveEventId });
    expect(twin.sourceKind).toBe("live_event");
    expect(twin.sourceType).toBe("camera");
    expect(twin.videoUrl).toBeNull();
    expect(twin.sourceStartSeconds).toBe(35);
    expect(twin.confidence).toBe(84);
    expect(twin.players).toHaveLength(22);
  });

  it("deleting a film session removes its linked Tactical Twins", async () => {
    const ownerId = filmTwinId;
    await db.deleteGameSession(gameSessionId);
    gameSessionId = 0;
    expect(await db.getPlayReconstruction(ownerId, 1)).toBeUndefined();
  });
});

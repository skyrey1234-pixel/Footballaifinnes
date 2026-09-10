import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  analyzeLiveWindow,
  buildRecoveredLiveResult,
  isRecoveredLiveResult,
  LIVE_WINDOW_SECONDS,
  type LiveSituation,
  type LiveWindowResult,
} from "./liveAnalysis";
import { mergeLiveGameMemory, normalizeLiveGameMemory } from "./liveMemory";
import { createLivePlaybackToken } from "./livePlaybackToken";
import { createLiveTvToken, verifyLiveTvToken } from "./liveTvToken";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const situationSchema = z.object({
  quarter: z.string().max(24).default("1st"),
  clock: z.string().max(16).default("15:00"),
  down: z.number().int().min(1).max(4).default(1),
  distance: z.number().int().min(0).max(99).default(10),
  yardLine: z.string().max(32).default("50"),
  ourScore: z.number().int().min(0).max(999).default(0),
  opponentScore: z.number().int().min(0).max(999).default(0),
  possession: z.enum(["us", "opponent", "unknown"]).default("unknown"),
  notes: z.string().max(500).optional(),
});

const statusSchema = z.enum(["setup", "ready", "live", "paused", "complete", "failed"]);

async function requireOwnedSession(id: number, userId: number) {
  const session = await db.getLiveGameSession(id, userId);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Live session not found" });
  return session;
}

export function getLiveAnalysisRecoveryMessage(error: unknown) {
  const technicalMessage = error instanceof Error ? error.message : "Live analysis failed";
  return technicalMessage.includes("timed out")
    ? "The AI read took too long. TacticalEdge saved a recovery window, kept the feed running, and will analyze the next five-second window automatically."
    : "The AI read was incomplete. TacticalEdge saved a recovery window, kept the feed running, and will analyze the next five-second window automatically.";
}

export async function persistLiveWindowResult(input: {
  sessionId: number;
  userId: number;
  windowIndex: number;
  windowStartSeconds: number;
  windowEndSeconds: number;
  inputFrameCount: number;
  situation: LiveSituation;
  result: LiveWindowResult;
  analysisStartedAt: number;
  recoveryMessage?: string | null;
}) {
  const currentSession = await db.getLiveGameSession(input.sessionId, input.userId);
  if (!currentSession) return { event: undefined, duplicate: false, canceled: true, recovered: Boolean(input.recoveryMessage) };

  const recovered = Boolean(input.recoveryMessage);
  const gameMemory = recovered
    ? normalizeLiveGameMemory(currentSession.gameMemory)
    : mergeLiveGameMemory(currentSession.gameMemory, input.result, input.windowIndex);

  await db.saveLiveAnalysisEvent({
    liveSessionId: input.sessionId,
    userId: input.userId,
    windowIndex: input.windowIndex,
    windowStartSeconds: input.windowStartSeconds,
    windowEndSeconds: input.windowEndSeconds,
    visibleAction: input.result.visibleAction,
    teamPhase: input.result.teamPhase,
    phaseReason: input.result.phaseReason,
    formation: input.result.formation,
    personnel: input.result.personnel,
    defensiveLook: input.result.defensiveLook,
    playCall: input.result.playCall,
    predictionSummary: input.result.predictionSummary,
    nextPlayProbabilities: input.result.nextPlayProbabilities,
    offenseInsights: input.result.offenseInsights,
    defenseInsights: input.result.defenseInsights,
    impactPlayers: input.result.impactPlayers,
    keyMatchups: input.result.keyMatchups,
    tendencyShift: input.result.tendencyShift,
    counterCall: input.result.counterCall,
    riskLevel: input.result.riskLevel,
    alerts: input.result.alerts,
    evidence: input.result.evidence,
    confidence: input.result.confidence,
    inputFrameCount: input.inputFrameCount,
    latencyMs: Date.now() - input.analysisStartedAt,
  });
  await db.updateLiveGameSession(input.sessionId, input.userId, {
    status: currentSession.status === "ready" ? "live" : currentSession.status,
    currentVideoSecond: Math.max(currentSession.currentVideoSecond, input.windowEndSeconds),
    situation: currentSession.status === "live" || currentSession.status === "ready"
      ? input.situation
      : currentSession.situation,
    gameMemory,
    latestSummary: input.result.predictionSummary,
    errorMessage: input.recoveryMessage ?? null,
    startedAt: currentSession.startedAt ?? new Date(),
  });
  const event = await db.getLiveAnalysisEventByWindow(input.sessionId, input.userId, input.windowIndex);
  return { event, duplicate: false, canceled: false, recovered };
}

export const liveRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listLiveGameSessions(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => requireOwnedSession(input.id, ctx.user.id)),

  playbackUrl: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const session = await requireOwnedSession(input.id, ctx.user.id);
      if (session.sourceType !== "upload" || !session.videoFileKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This live session does not have uploaded replay footage" });
      }
      const { token, expiresAt } = createLivePlaybackToken(session.id, ctx.user.id);
      return { url: `/api/live/video/${session.id}?access=${encodeURIComponent(token)}`, expiresAt };
    }),

  tvLink: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const session = await requireOwnedSession(input.id, ctx.user.id);
      const { token, expiresAt } = createLiveTvToken(session.id, ctx.user.id);
      return { path: `/live/tv/${session.id}#access=${encodeURIComponent(token)}`, expiresAt };
    }),

  tvSnapshot: publicProcedure
    .input(z.object({ id: z.number().int().positive(), access: z.string().min(20).max(4_000) }))
    .query(async ({ input }) => {
      const access = verifyLiveTvToken(input.access);
      if (!access || access.sessionId !== input.id) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "This TV View link is invalid or expired" });
      }
      const session = await db.getLiveGameSession(access.sessionId, access.userId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Live session not found" });
      const events = await db.listLiveAnalysisEvents(session.id, access.userId, 40);
      const playback = session.sourceType === "upload" && session.videoFileKey
        ? createLivePlaybackToken(session.id, access.userId)
        : null;
      return {
        session: {
          id: session.id,
          name: session.name,
          opponentName: session.opponentName,
          sourceType: session.sourceType,
          status: session.status,
          analysisIntervalSeconds: session.analysisIntervalSeconds,
          currentVideoSecond: session.currentVideoSecond,
          situation: session.situation,
          gameMemory: session.gameMemory,
          latestSummary: session.latestSummary,
          updatedAt: session.updatedAt,
        },
        events: events.map(({ userId: _userId, liveSessionId: _sessionId, ...event }) => event),
        playbackUrl: playback ? `/api/live/video/${session.id}?access=${encodeURIComponent(playback.token)}` : null,
        expiresAt: access.expiresAt,
      };
    }),

  events: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), limit: z.number().int().min(1).max(300).optional() }))
    .query(async ({ ctx, input }) => {
      await requireOwnedSession(input.id, ctx.user.id);
      return db.listLiveAnalysisEvents(input.id, ctx.user.id, input.limit ?? 120);
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().trim().min(1).max(160),
      opponentName: z.string().trim().min(1).max(255),
      sourceType: z.enum(["upload", "camera", "screen"]),
      videoFileKey: z.string().max(2_000).optional(),
      videoUrl: z.string().max(4_000).optional(),
      analysisIntervalSeconds: z.literal(5).default(5),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.sourceType === "upload" && !input.videoFileKey) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload footage before creating the live simulation" });
      }
      const id = await db.createLiveGameSession({
        userId: ctx.user.id,
        name: input.name,
        opponentName: input.opponentName,
        sourceType: input.sourceType,
        videoFileKey: input.videoFileKey ?? null,
        videoUrl: input.videoUrl ?? null,
        status: "ready",
        analysisIntervalSeconds: LIVE_WINDOW_SECONDS,
        situation: {
          quarter: "1st",
          clock: "15:00",
          down: 1,
          distance: 10,
          yardLine: "50",
          ourScore: 0,
          opponentScore: 0,
          possession: "unknown",
        },
      });
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      status: statusSchema.optional(),
      currentVideoSecond: z.number().int().min(0).optional(),
      situation: situationSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireOwnedSession(input.id, ctx.user.id);
      const patch: Parameters<typeof db.updateLiveGameSession>[2] = {};
      if (input.status) {
        patch.status = input.status;
        patch.errorMessage = null;
        if (input.status === "live" && !session.startedAt) patch.startedAt = new Date();
        if (input.status === "complete") patch.endedAt = new Date();
      }
      if (input.currentVideoSecond !== undefined) patch.currentVideoSecond = input.currentVideoSecond;
      if (input.situation) patch.situation = input.situation;
      await db.updateLiveGameSession(input.id, ctx.user.id, patch);
      return { success: true } as const;
    }),

  analyzeWindow: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      windowIndex: z.number().int().min(0),
      windowStartSeconds: z.number().int().min(0),
      windowEndSeconds: z.number().int().min(1),
      frames: z.array(
        z.string().max(750_000).refine((value) => /^data:image\/(jpeg|png|webp);base64,/.test(value), "Frames must be base64 images"),
      ).min(1).max(6),
      situation: situationSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireOwnedSession(input.id, ctx.user.id);
      if (session.status === "complete" || session.status === "failed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This live session is no longer running" });
      }
      if (input.windowEndSeconds <= input.windowStartSeconds) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Window end must be after window start" });
      }

      const existing = await db.getLiveAnalysisEventByWindow(input.id, ctx.user.id, input.windowIndex);
      if (existing) return { event: existing, duplicate: true };

      const analysisStartedAt = Date.now();
      let result: LiveWindowResult | null = null;
      let analysisError: unknown = null;
      try {
        result = await Promise.race([
          analyzeLiveWindow({
            opponentName: session.opponentName,
            windowStartSeconds: input.windowStartSeconds,
            windowEndSeconds: input.windowEndSeconds,
            frames: input.frames,
            situation: input.situation as LiveSituation,
            gameMemory: normalizeLiveGameMemory(session.gameMemory),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Live AI window timed out after 55 seconds")), 55_000);
          }),
        ]);
      } catch (error) {
        analysisError = error;
        console.error("[Live Intelligence] Window analysis failed", {
          liveSessionId: input.id,
          windowIndex: input.windowIndex,
          error,
        });
      }

      const recoveryMessage = analysisError
        ? getLiveAnalysisRecoveryMessage(analysisError)
        : result && isRecoveredLiveResult(result)
          ? getLiveAnalysisRecoveryMessage(new Error("Live structured response recovered"))
          : null;
      if (!result) {
        const latestSession = await db.getLiveGameSession(input.id, ctx.user.id);
        if (!latestSession) return { event: undefined, duplicate: false, canceled: true, recovered: true };
        result = buildRecoveredLiveResult({
          situation: input.situation as LiveSituation,
          frames: input.frames,
          gameMemory: normalizeLiveGameMemory(latestSession.gameMemory),
        });
      }

      return persistLiveWindowResult({
        sessionId: input.id,
        userId: ctx.user.id,
        windowIndex: input.windowIndex,
        windowStartSeconds: input.windowStartSeconds,
        windowEndSeconds: input.windowEndSeconds,
        inputFrameCount: input.frames.length,
        situation: input.situation as LiveSituation,
        result,
        analysisStartedAt,
        recoveryMessage,
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSession(input.id, ctx.user.id);
      await db.deleteLiveGameSession(input.id, ctx.user.id);
      return { success: true } as const;
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { analyzeLiveWindow, type LiveSituation } from "./liveAnalysis";

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

export const liveRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listLiveGameSessions(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => requireOwnedSession(input.id, ctx.user.id)),

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
      sourceType: z.enum(["upload", "camera"]),
      videoFileKey: z.string().max(2_000).optional(),
      videoUrl: z.string().max(4_000).optional(),
      analysisIntervalSeconds: z.literal(15).default(15),
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
        analysisIntervalSeconds: 15,
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

      const recent = await db.listLiveAnalysisEvents(input.id, ctx.user.id, 4);
      try {
        const result = await Promise.race([
          analyzeLiveWindow({
            opponentName: session.opponentName,
            windowStartSeconds: input.windowStartSeconds,
            windowEndSeconds: input.windowEndSeconds,
            frames: input.frames,
            situation: input.situation as LiveSituation,
            recentContext: recent.map((event) => ({
              windowIndex: event.windowIndex,
              formation: event.formation,
              playCall: event.playCall,
              predictionSummary: event.predictionSummary,
            })),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Live AI window timed out after 55 seconds")), 55_000);
          }),
        ]);

        // Re-read lifecycle state after the model returns. A coach may pause,
        // end, or delete the session while the request is in flight.
        const currentSession = await db.getLiveGameSession(input.id, ctx.user.id);
        if (!currentSession) return { event: undefined, duplicate: false, canceled: true };

        await db.saveLiveAnalysisEvent({
          liveSessionId: input.id,
          userId: ctx.user.id,
          windowIndex: input.windowIndex,
          windowStartSeconds: input.windowStartSeconds,
          windowEndSeconds: input.windowEndSeconds,
          visibleAction: result.visibleAction,
          formation: result.formation,
          personnel: result.personnel,
          defensiveLook: result.defensiveLook,
          playCall: result.playCall,
          predictionSummary: result.predictionSummary,
          nextPlayProbabilities: result.nextPlayProbabilities,
          tendencyShift: result.tendencyShift,
          counterCall: result.counterCall,
          riskLevel: result.riskLevel,
          alerts: result.alerts,
          evidence: result.evidence,
          confidence: result.confidence,
          inputFrameCount: input.frames.length,
        });
        await db.updateLiveGameSession(input.id, ctx.user.id, {
          status: currentSession.status === "ready" ? "live" : currentSession.status,
          currentVideoSecond: Math.max(currentSession.currentVideoSecond, input.windowEndSeconds),
          situation: currentSession.status === "live" || currentSession.status === "ready"
            ? input.situation
            : currentSession.situation,
          latestSummary: result.predictionSummary,
          errorMessage: null,
          startedAt: currentSession.startedAt ?? new Date(),
        });
        const event = await db.getLiveAnalysisEventByWindow(input.id, ctx.user.id, input.windowIndex);
        return { event, duplicate: false, canceled: false };
      } catch (error) {
        console.error("[Live Intelligence] Window analysis failed", {
          liveSessionId: input.id,
          windowIndex: input.windowIndex,
          error,
        });
        await db.updateLiveGameSession(input.id, ctx.user.id, {
          errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : "Live analysis failed",
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "This 15-second window could not be analyzed. Playback can continue and the next window will retry.",
        });
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedSession(input.id, ctx.user.id);
      await db.deleteLiveGameSession(input.id, ctx.user.id);
      return { success: true } as const;
    }),
});

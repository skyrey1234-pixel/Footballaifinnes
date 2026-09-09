import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  buildDefaultBallPath,
  buildDefaultTwinPlayers,
  type TacticalTwinPlayType,
} from "../shared/tacticalTwin";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storageGetSignedUrl } from "./storage";

const sourceKindSchema = z.enum(["film_highlight", "highlight_reel"]);
const playTypeSchema = z.enum(["pass", "run", "screen", "rpo", "special_teams", "unknown"]);
const pointSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
const playerSchema = pointSchema.extend({
  id: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(16),
  side: z.enum(["offense", "defense"]),
  routeType: z.enum(["route", "block", "blitz", "zone"]),
  route: z.array(pointSchema).max(16),
});
const markerSchema = pointSchema.extend({
  id: z.string().trim().min(1).max(64),
  kind: z.enum(["mistake", "correction", "key"]),
  label: z.string().trim().min(1).max(64),
});

function inferPlayType(text: string): TacticalTwinPlayType {
  const normalized = text.toLowerCase();
  if (/special|punt|kick|return|field goal/.test(normalized)) return "special_teams";
  if (/\brpo\b|option/.test(normalized)) return "rpo";
  if (/screen/.test(normalized)) return "screen";
  if (/run|rush|draw|sweep|counter|power|handoff|keeper/.test(normalized)) return "run";
  if (/pass|throw|completion|interception|sack|route|receiver/.test(normalized)) return "pass";
  return "unknown";
}

function defaultFormation(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= 96 ? trimmed : "Shotgun 2x2";
}

async function requireOwnedGameSession(sessionId: number, userId: number) {
  const session = await db.getGameSession(sessionId);
  if (!session || session.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Film session not found" });
  }
  return session;
}

function keyFromStorageUrl(value: string | null | undefined) {
  if (!value?.startsWith("/manus-storage/")) return null;
  return decodeURIComponent(value.slice("/manus-storage/".length));
}

async function resolveOwnedSourceVideoKey(reconstruction: Awaited<ReturnType<typeof db.getPlayReconstruction>>, userId: number) {
  if (!reconstruction || reconstruction.sourceType !== "upload") return null;
  if (reconstruction.gameSessionId) {
    const session = await requireOwnedGameSession(reconstruction.gameSessionId, userId);
    return session.videoFileKey || keyFromStorageUrl(session.videoUrl) || keyFromStorageUrl(reconstruction.videoUrl);
  }
  if (reconstruction.liveSessionId) {
    const session = await db.getLiveGameSession(reconstruction.liveSessionId, userId);
    if (!session || session.sourceType !== "upload") return null;
    return session.videoFileKey || keyFromStorageUrl(session.videoUrl) || keyFromStorageUrl(reconstruction.videoUrl);
  }
  return keyFromStorageUrl(reconstruction.videoUrl);
}

async function returnCreatedOrExisting(userId: number, sourceKey: string, insert: () => Promise<number>) {
  const existing = await db.getPlayReconstructionBySourceKey(userId, sourceKey);
  if (existing) return existing;
  try {
    const id = await insert();
    const created = await db.getPlayReconstruction(id, userId);
    if (!created) throw new Error("Reconstruction was not persisted");
    return created;
  } catch (error) {
    const concurrent = await db.getPlayReconstructionBySourceKey(userId, sourceKey);
    if (concurrent) return concurrent;
    throw error;
  }
}

export const tacticalTwinRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listPlayReconstructions(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const reconstruction = await db.getPlayReconstruction(input.id, ctx.user.id);
      if (!reconstruction) throw new TRPCError({ code: "NOT_FOUND", message: "Tactical Twin not found" });
      return reconstruction;
    }),

  playbackUrl: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const reconstruction = await db.getPlayReconstruction(input.id, ctx.user.id);
      if (!reconstruction) throw new TRPCError({ code: "NOT_FOUND", message: "Tactical Twin not found" });
      if (reconstruction.sourceType !== "upload") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This Tactical Twin does not have stored source film" });
      }
      const videoFileKey = await resolveOwnedSourceVideoKey(reconstruction, ctx.user.id);
      if (!videoFileKey) throw new TRPCError({ code: "NOT_FOUND", message: "Tactical Twin source film not found" });
      const url = await storageGetSignedUrl(videoFileKey);
      return { url, expiresAt: Date.now() + 50 * 60 * 1_000 };
    }),

  createFromFilm: protectedProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      sourceKind: sourceKindSchema,
      sourceIndex: z.number().int().min(0).max(999),
      title: z.string().trim().min(1).max(255),
      description: z.string().trim().max(4_000).optional(),
      startSeconds: z.number().int().min(0),
      durationSeconds: z.number().int().min(5).max(30).default(12),
      formation: z.string().trim().max(96).optional(),
      playType: playTypeSchema.optional(),
      target: z.string().trim().max(96).optional(),
      confidence: z.number().int().min(0).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await requireOwnedGameSession(input.sessionId, ctx.user.id);
      const sourceKey = `${input.sourceKind}:${input.sessionId}:${input.sourceIndex}:${input.startSeconds}`;
      const playType = input.playType ?? inferPlayType(`${input.title} ${input.description ?? ""}`);
      const formation = defaultFormation(input.formation);
      const players = buildDefaultTwinPlayers(formation, playType, input.target);
      const now = Date.now();
      return returnCreatedOrExisting(ctx.user.id, sourceKey, () => db.createPlayReconstruction({
        userId: ctx.user.id,
        sourceKind: input.sourceKind,
        sourceKey,
        gameSessionId: session.id,
        liveSessionId: null,
        liveEventId: null,
        sourceType: session.sourceType,
        sourceTitle: input.title,
        sourceDescription: input.description ?? null,
        sourceStartSeconds: input.startSeconds,
        sourceEndSeconds: input.startSeconds + input.durationSeconds,
        youtubeVideoId: session.youtubeVideoId,
        videoUrl: session.videoUrl,
        title: input.title,
        formation,
        playType,
        target: input.target ?? null,
        defenseScheme: "4-3",
        players,
        ballPath: buildDefaultBallPath(players, playType),
        markers: [],
        coachingNotes: input.description ?? null,
        confidence: input.confidence ?? 35,
        status: "draft",
        coachVerified: 0,
        createdAt: now,
        updatedAt: now,
      }));
    }),

  createFromLive: protectedProcedure
    .input(z.object({
      liveSessionId: z.number().int().positive(),
      liveEventId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const liveSession = await db.getLiveGameSession(input.liveSessionId, ctx.user.id);
      if (!liveSession) throw new TRPCError({ code: "NOT_FOUND", message: "Live session not found" });
      const event = await db.getLiveAnalysisEvent(input.liveEventId, input.liveSessionId, ctx.user.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Live evidence window not found" });

      const sourceKey = `live_event:${input.liveSessionId}:${input.liveEventId}`;
      const sourceTitle = event.playCall || event.visibleAction || `Live window ${event.windowIndex + 1}`;
      const playType = inferPlayType(`${sourceTitle} ${event.visibleAction ?? ""}`);
      const formation = defaultFormation(event.formation);
      const players = buildDefaultTwinPlayers(formation, playType, null);
      const now = Date.now();
      return returnCreatedOrExisting(ctx.user.id, sourceKey, () => db.createPlayReconstruction({
        userId: ctx.user.id,
        sourceKind: "live_event",
        sourceKey,
        gameSessionId: null,
        liveSessionId: liveSession.id,
        liveEventId: event.id,
        sourceType: liveSession.sourceType,
        sourceTitle,
        sourceDescription: event.predictionSummary,
        sourceStartSeconds: event.windowStartSeconds,
        sourceEndSeconds: event.windowEndSeconds,
        youtubeVideoId: null,
        videoUrl: liveSession.sourceType === "upload" ? liveSession.videoUrl : null,
        title: sourceTitle,
        formation,
        playType,
        target: null,
        defenseScheme: event.defensiveLook || "4-3",
        players,
        ballPath: buildDefaultBallPath(players, playType),
        markers: [],
        coachingNotes: [event.visibleAction, event.phaseReason, event.counterCall].filter(Boolean).join("\n\n") || null,
        confidence: event.confidence,
        status: "draft",
        coachVerified: 0,
        createdAt: now,
        updatedAt: now,
      }));
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(1).max(255),
      formation: z.string().trim().min(1).max(96),
      playType: playTypeSchema,
      target: z.string().trim().max(96).nullable(),
      defenseScheme: z.string().trim().min(1).max(96),
      players: z.array(playerSchema).min(1).max(30),
      ballPath: z.array(pointSchema).max(16),
      markers: z.array(markerSchema).max(16),
      coachingNotes: z.string().max(8_000).nullable(),
      confidence: z.number().int().min(0).max(100),
      coachVerified: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getPlayReconstruction(input.id, ctx.user.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Tactical Twin not found" });
      await db.updatePlayReconstruction(input.id, ctx.user.id, {
        title: input.title,
        formation: input.formation,
        playType: input.playType,
        target: input.target,
        defenseScheme: input.defenseScheme,
        players: input.players,
        ballPath: input.ballPath,
        markers: input.markers,
        coachingNotes: input.coachingNotes,
        confidence: input.confidence,
        coachVerified: input.coachVerified ? 1 : 0,
        status: input.coachVerified ? "reviewed" : "draft",
        updatedAt: Date.now(),
      });
      return db.getPlayReconstruction(input.id, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getPlayReconstruction(input.id, ctx.user.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Tactical Twin not found" });
      await db.deletePlayReconstruction(input.id, ctx.user.id);
      return { success: true } as const;
    }),
});

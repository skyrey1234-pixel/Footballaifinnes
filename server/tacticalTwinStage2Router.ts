import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import { protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { analyzeTwinFrameBatch, MAX_TWIN_TRACKING_BATCH } from "./tacticalTwinTracking";
import { storageGetSignedUrl, storagePut } from "./storage";
import {
  buildHiggsfieldReplayPrompt,
  cancelHiggsfieldReplay,
  getHiggsfieldReplayStatus,
  hasHiggsfieldCredentials,
  HIGGSFIELD_VIDEO_PATH,
  higgsfieldOutputUrl,
  retainHiggsfieldVideo,
  submitHiggsfieldReplay,
} from "./higgsfieldCinematic";
import {
  clampTwinConfidence,
  clampTwinUnitPoint,
  type TwinFieldCalibration,
  type TwinTrackedBall,
  type TwinTrackedPlayer,
} from "../shared/tacticalTwinStage2";
import { extractTwinTrackingFrameBatch } from "./tacticalTwinFrameExtraction";
import {
  cancelManusHiggsfieldReplay,
  getManusHiggsfieldReplayStatus,
  hasManusHiggsfieldBridge,
  MANUS_HIGGSFIELD_MODEL,
  submitManusHiggsfieldReplay,
  submitManusHiggsfieldStatusRecovery,
} from "./manusHiggsfieldBridge";

const unitPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  confidence: z.number().int().min(0).max(100),
});

const boxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const playerSchema = z.object({
  trackId: z.string().min(1).max(32),
  unit: z.enum(["offense", "defense", "official", "unknown"]),
  label: z.string().min(1).max(48),
  jerseyNumber: z.string().max(4).nullable().optional(),
  bbox: boxSchema,
  imagePoint: unitPointSchema,
  fieldPoint: unitPointSchema.nullable().optional(),
  occluded: z.boolean(),
  manuallyCorrected: z.boolean(),
});
const SERVER_TRACKING_BATCH_SIZE = 1;

const ballSchema = z.object({
  visible: z.boolean(),
  bbox: boxSchema.nullable().optional(),
  imagePoint: unitPointSchema.nullable().optional(),
  fieldPoint: unitPointSchema.nullable().optional(),
  possessedByTrackId: z.string().max(32).nullable().optional(),
  manuallyCorrected: z.boolean(),
});

const captureFrameSchema = z.object({
  frameIndex: z.number().int().min(0).max(600),
  timestampMs: z.number().int().min(0).max(3_600_000),
  imageWidth: z.number().int().min(160).max(4096),
  imageHeight: z.number().int().min(90).max(2160),
  dataUrl: z.string().min(100).max(1_500_000).refine((value) => /^data:image\/(jpeg|jpg|webp);base64,/i.test(value), "A JPEG or WebP frame is required"),
});

async function requireReconstruction(reconstructionId: number, userId: number) {
  const reconstruction = await db.getPlayReconstruction(reconstructionId, userId);
  if (!reconstruction) throw new TRPCError({ code: "NOT_FOUND", message: "Tactical Twin not found" });
  return reconstruction;
}

async function requireJob(jobId: number, userId: number) {
  const job = await db.getTwinTrackingJob(jobId, userId);
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Tracking job not found" });
  return job;
}

async function requireExport(exportId: number, userId: number) {
  const cinematicExport = await db.getTwinCinematicExport(exportId, userId);
  if (!cinematicExport) throw new TRPCError({ code: "NOT_FOUND", message: "Cinematic export not found" });
  return cinematicExport;
}

function externalBaseUrl(req: { protocol: string; get(name: string): string | undefined; headers: Record<string, unknown> }) {
  const forwardedProtocol = typeof req.headers["x-forwarded-proto"] === "string" ? req.headers["x-forwarded-proto"].split(",")[0].trim() : "";
  const forwardedHost = typeof req.headers["x-forwarded-host"] === "string" ? req.headers["x-forwarded-host"].split(",")[0].trim() : "";
  const protocol = forwardedProtocol === "https" ? "https" : req.protocol === "https" ? "https" : "http";
  const host = forwardedHost || req.get("host") || "";
  if (!host || !/^[A-Za-z0-9.:-]+$/.test(host)) return null;
  return `${protocol}://${host}`;
}

function decodeSourceFrame(dataUrl: string) {
  const match = /^data:image\/(jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "A JPEG or WebP source frame is required" });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 1_000 || bytes.length > 3 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Source frame must be between 1 KB and 3 MB" });
  }
  return { bytes, contentType: match[1].toLowerCase() === "webp" ? "image/webp" : "image/jpeg" };
}

function bestCalibration(current: unknown, incoming: TwinFieldCalibration) {
  const prior = current && typeof current === "object" ? current as Partial<TwinFieldCalibration> : null;
  return Number(prior?.confidence ?? -1) > incoming.confidence ? prior : incoming;
}

export const tacticalTwinStage2Router = router({
  startTracking: protectedProcedure
    .input(z.object({
      reconstructionId: z.number().int().positive(),
      samplingFps: z.number().int().min(1).max(3).default(2),
      sourceFps: z.number().int().min(12).max(120).default(30),
      forceRestart: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const reconstruction = await requireReconstruction(input.reconstructionId, ctx.user.id);
      if (!reconstruction.videoUrl && !reconstruction.youtubeVideoId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Automatic tracking needs stored source film. Local camera and Screen Share frames are not retained." });
      }
      if (!input.forceRestart) {
        const existing = await db.listTwinTrackingJobs(input.reconstructionId, ctx.user.id);
        const resumable = existing.find((job) => ["queued", "capturing", "analyzing", "review"].includes(job.status));
        if (resumable) return resumable;
      }

      const clipDurationSeconds = Math.max(1, reconstruction.sourceEndSeconds - reconstruction.sourceStartSeconds);
      const totalFrames = Math.min(90, Math.max(1, Math.ceil(clipDurationSeconds * input.samplingFps)));
      const now = Date.now();
      const id = await db.createTwinTrackingJob({
        reconstructionId: input.reconstructionId,
        userId: ctx.user.id,
        status: "capturing",
        stage: "waiting_for_server_frames",
        samplingFps: input.samplingFps,
        sourceFps: input.sourceFps,
        totalFrames,
        processedFrames: 0,
        provider: "gemini-3-flash-preview",
        calibration: null,
        summary: {
          sourceStartSeconds: reconstruction.sourceStartSeconds,
          sourceEndSeconds: reconstruction.sourceEndSeconds,
          evidencePolicy: "Anonymous AI-assisted tracks; coach verification required.",
        },
        errorMessage: null,
        retryCount: 0,
        createdAt: now,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
      });
      return requireJob(id, ctx.user.id);
    }),

  listTracking: protectedProcedure
    .input(z.object({ reconstructionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireReconstruction(input.reconstructionId, ctx.user.id);
      return db.listTwinTrackingJobs(input.reconstructionId, ctx.user.id);
    }),

  libraryStatus: protectedProcedure
    .input(z.object({ reconstructionIds: z.array(z.number().int().positive()).max(50) }))
    .query(async ({ input, ctx }) => {
      const uniqueIds = Array.from(new Set(input.reconstructionIds));
      const rows = await Promise.all(uniqueIds.map(async (reconstructionId) => {
        const reconstruction = await db.getPlayReconstruction(reconstructionId, ctx.user.id);
        if (!reconstruction) return null;
        const [trackingJobs, exports] = await Promise.all([
          db.listTwinTrackingJobs(reconstructionId, ctx.user.id),
          db.listTwinCinematicExports(reconstructionId, ctx.user.id),
        ]);
        return {
          reconstructionId,
          trackingEligible: reconstruction.sourceType === "upload" && Boolean(reconstruction.videoUrl),
          trackingStatus: trackingJobs[0]?.status ?? null,
          exportStatus: exports[0]?.status ?? null,
        };
      }));
      return rows.filter((row): row is NonNullable<typeof row> => row !== null);
    }),

  tracking: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const job = await requireJob(input.jobId, ctx.user.id);
      const frames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
      return { job, frames };
    }),

  analyzeFrameBatch: protectedProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      frames: z.array(captureFrameSchema).min(1).max(MAX_TWIN_TRACKING_BATCH),
    }))
    .mutation(async ({ input, ctx }) => {
      const job = await requireJob(input.jobId, ctx.user.id);
      await requireReconstruction(job.reconstructionId, ctx.user.id);
      if (["approved", "canceled"].includes(job.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Tracking job is ${job.status}` });
      }

      await db.updateTwinTrackingJob(job.id, ctx.user.id, {
        status: "analyzing",
        stage: `analyzing_frames_${input.frames[0].frameIndex}_${input.frames.at(-1)?.frameIndex ?? input.frames[0].frameIndex}`,
        errorMessage: null,
        updatedAt: Date.now(),
      });

      try {
        const existingFrames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
        const priorPlayers = existingFrames.at(-1)?.players;
        const priorTracks = Array.isArray(priorPlayers)
          ? (priorPlayers as TwinTrackedPlayer[]).map(({ trackId, unit, label, imagePoint }) => ({ trackId, unit, label, imagePoint }))
          : [];
        const result = await analyzeTwinFrameBatch({ frames: input.frames, priorTracks });
        const now = Date.now();
        for (const frame of result.frames) {
          await db.upsertTwinTrackingFrame({
            trackingJobId: job.id,
            reconstructionId: job.reconstructionId,
            userId: ctx.user.id,
            frameIndex: frame.frameIndex,
            timestampMs: frame.timestampMs,
            imageWidth: frame.imageWidth,
            imageHeight: frame.imageHeight,
            players: frame.players,
            ball: frame.ball,
            frameConfidence: frame.frameConfidence,
            createdAt: now,
            updatedAt: now,
          });
        }
        const persistedFrames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
        const complete = persistedFrames.length >= job.totalFrames;
        await db.updateTwinTrackingJob(job.id, ctx.user.id, {
          status: complete ? "review" : "capturing",
          stage: complete ? "coach_review" : "waiting_for_browser_frames",
          processedFrames: persistedFrames.length,
          calibration: bestCalibration(job.calibration, result.calibration),
          completedAt: complete ? now : null,
          updatedAt: now,
        });
        return { job: await requireJob(job.id, ctx.user.id), frames: result.frames };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Automatic tracking failed";
        await db.updateTwinTrackingJob(job.id, ctx.user.id, {
          status: "failed",
          stage: "analysis_failed",
          errorMessage: message.slice(0, 500),
          updatedAt: Date.now(),
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "This tracking batch failed. Retry keeps all previously completed frames." });
      }
    }),

  analyzeServerBatch: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const job = await requireJob(input.jobId, ctx.user.id);
      const reconstruction = await requireReconstruction(job.reconstructionId, ctx.user.id);
      if (reconstruction.sourceType !== "upload") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Automatic tracking needs stored uploaded film." });
      }
      if (["approved", "canceled"].includes(job.status)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Tracking job is ${job.status}` });
      }

      const existingFrames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
      const completedIndexes = new Set(existingFrames.map((frame) => frame.frameIndex));
      let startFrameIndex = 0;
      while (startFrameIndex < job.totalFrames && completedIndexes.has(startFrameIndex)) startFrameIndex += 1;
      if (startFrameIndex >= job.totalFrames) {
        const now = Date.now();
        await db.updateTwinTrackingJob(job.id, ctx.user.id, {
          status: "review",
          stage: "coach_review",
          processedFrames: existingFrames.length,
          completedAt: now,
          updatedAt: now,
        });
        return { job: await requireJob(job.id, ctx.user.id), frames: [] };
      }

      const frameCount = Math.min(SERVER_TRACKING_BATCH_SIZE, job.totalFrames - startFrameIndex);
      await db.updateTwinTrackingJob(job.id, ctx.user.id, {
        status: "analyzing",
        stage: `extracting_frames_${startFrameIndex}_${startFrameIndex + frameCount - 1}`,
        errorMessage: null,
        updatedAt: Date.now(),
      });

      try {
        const capturedFrames = await extractTwinTrackingFrameBatch({
          reconstructionId: reconstruction.id,
          userId: ctx.user.id,
          sourceStartSeconds: reconstruction.sourceStartSeconds,
          samplingFps: job.samplingFps,
          startFrameIndex,
          frameCount,
        });
        const priorPlayers = existingFrames.at(-1)?.players;
        const priorTracks = Array.isArray(priorPlayers)
          ? (priorPlayers as TwinTrackedPlayer[]).map(({ trackId, unit, label, imagePoint }) => ({ trackId, unit, label, imagePoint }))
          : [];
        const result = await analyzeTwinFrameBatch({ frames: capturedFrames, priorTracks });
        const now = Date.now();
        for (const frame of result.frames) {
          await db.upsertTwinTrackingFrame({
            trackingJobId: job.id,
            reconstructionId: job.reconstructionId,
            userId: ctx.user.id,
            frameIndex: frame.frameIndex,
            timestampMs: frame.timestampMs,
            imageWidth: frame.imageWidth,
            imageHeight: frame.imageHeight,
            players: frame.players,
            ball: frame.ball,
            frameConfidence: frame.frameConfidence,
            createdAt: now,
            updatedAt: now,
          });
        }
        const persistedFrames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
        const complete = persistedFrames.length >= job.totalFrames;
        await db.updateTwinTrackingJob(job.id, ctx.user.id, {
          status: complete ? "review" : "capturing",
          stage: complete ? "coach_review" : "waiting_for_server_frames",
          processedFrames: persistedFrames.length,
          calibration: bestCalibration(job.calibration, result.calibration),
          completedAt: complete ? now : null,
          updatedAt: now,
        });
        return { job: await requireJob(job.id, ctx.user.id), frames: result.frames };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Automatic tracking failed";
        await db.updateTwinTrackingJob(job.id, ctx.user.id, {
          status: "failed",
          stage: "server_frame_analysis_failed",
          errorMessage: message.slice(0, 500),
          updatedAt: Date.now(),
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `This tracking batch failed: ${message.slice(0, 220)}` });
      }
    }),

  updateTrackedFrame: protectedProcedure
    .input(z.object({
      jobId: z.number().int().positive(),
      frameId: z.number().int().positive(),
      players: z.array(playerSchema).max(24),
      ball: ballSchema,
      frameConfidence: z.number().int().min(0).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const job = await requireJob(input.jobId, ctx.user.id);
      const players = input.players.map((player) => ({
        ...player,
        bbox: {
          x: clampTwinUnitPoint(player.bbox.x),
          y: clampTwinUnitPoint(player.bbox.y),
          width: clampTwinUnitPoint(player.bbox.width),
          height: clampTwinUnitPoint(player.bbox.height),
        },
        imagePoint: { ...player.imagePoint, confidence: clampTwinConfidence(player.imagePoint.confidence) },
        fieldPoint: player.fieldPoint ? { ...player.fieldPoint, confidence: clampTwinConfidence(player.fieldPoint.confidence) } : null,
        manuallyCorrected: true,
      }));
      const ball: TwinTrackedBall = { ...input.ball, manuallyCorrected: true };
      await db.updateTwinTrackingFrame(input.frameId, job.id, ctx.user.id, {
        players,
        ball,
        frameConfidence: clampTwinConfidence(input.frameConfidence),
        updatedAt: Date.now(),
      });
      return { success: true };
    }),

  approveTracking: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const job = await requireJob(input.jobId, ctx.user.id);
      const frames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
      if (frames.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No tracked evidence is available to approve" });
      await db.updateTwinTrackingJob(job.id, ctx.user.id, {
        status: "approved",
        stage: "approved_by_coach",
        processedFrames: frames.length,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return requireJob(job.id, ctx.user.id);
    }),

  retryTracking: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const job = await requireJob(input.jobId, ctx.user.id);
      await db.updateTwinTrackingJob(job.id, ctx.user.id, {
        status: "capturing",
        stage: "waiting_for_server_frames",
        errorMessage: null,
        retryCount: job.retryCount + 1,
        updatedAt: Date.now(),
      });
      return requireJob(job.id, ctx.user.id);
    }),

  deleteTracking: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireJob(input.jobId, ctx.user.id);
      await db.deleteTwinTrackingJob(input.jobId, ctx.user.id);
      return { success: true };
    }),

  exportConfiguration: protectedProcedure.query(() => ({
    configured: hasHiggsfieldCredentials() || hasManusHiggsfieldBridge(),
    provider: "Higgsfield",
    model: hasHiggsfieldCredentials() ? HIGGSFIELD_VIDEO_PATH : MANUS_HIGGSFIELD_MODEL,
    integrationMode: hasHiggsfieldCredentials() ? "app_api_credentials" as const : "manus_connector_bridge" as const,
    connectorEnabledNotice: hasManusHiggsfieldBridge()
      ? "The secure TacticalEdge connector bridge is ready. Generate launches one private Higgsfield task and retains the completed MP4 in this Twin."
      : "Your Manus Higgsfield connector remains enabled for agent work. Add the server-side Manus bridge key to enable one-click exports without copying the connector OAuth token.",
    durations: [5, 10] as const,
    outputNotice: "Cinematic outputs are generative interpretations and are retained in TacticalEdge storage after completion.",
  })),

  listExports: protectedProcedure
    .input(z.object({ reconstructionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireReconstruction(input.reconstructionId, ctx.user.id);
      return db.listTwinCinematicExports(input.reconstructionId, ctx.user.id);
    }),

  createExport: protectedProcedure
    .input(z.object({
      reconstructionId: z.number().int().positive(),
      trackingJobId: z.number().int().positive().nullable().optional(),
      style: z.enum(["broadcast_cinematic", "sideline_impact", "all_22_orbit"]).default("broadcast_cinematic"),
      aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
      durationSeconds: z.union([z.literal(5), z.literal(10)]).default(5),
      coachPrompt: z.string().trim().max(500).optional(),
      sourceImageDataUrl: z.string().min(1_000).max(4_200_000).optional(),
      sourceFrameTimestampSeconds: z.number().min(0).max(86_400).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const reconstruction = await requireReconstruction(input.reconstructionId, ctx.user.id);
      if (reconstruction.sourceType !== "upload") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cinematic export requires stored uploaded source film." });
      }
      const directHiggsfield = hasHiggsfieldCredentials();
      const manusBridge = hasManusHiggsfieldBridge();
      if (!directHiggsfield && !manusBridge) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Connect the TacticalEdge Higgsfield bridge to create cinematic replays." });
      }
      let approvedTrackingSummary: Record<string, unknown> | null = null;
      if (input.trackingJobId) {
        const job = await requireJob(input.trackingJobId, ctx.user.id);
        if (job.reconstructionId !== reconstruction.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (job.status !== "approved") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Approve the automatic tracks before attaching them to a cinematic export." });
        }
        const frames = await db.listTwinTrackingFrames(job.id, ctx.user.id);
        if (frames.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Approved tracking has no persisted frame evidence." });
        const counts = { offense: 0, defense: 0, official: 0, unknown: 0 };
        let visibleBallFrames = 0;
        let confidenceTotal = 0;
        for (const frame of frames) {
          const players = Array.isArray(frame.players) ? frame.players as TwinTrackedPlayer[] : [];
          for (const player of players) counts[player.unit] += 1;
          const ball = frame.ball as TwinTrackedBall | null;
          if (ball?.visible) visibleBallFrames += 1;
          confidenceTotal += frame.frameConfidence;
        }
        approvedTrackingSummary = {
          coachApproved: true,
          frameCount: frames.length,
          averageFrameConfidence: Math.round(confidenceTotal / frames.length),
          averageDetectionsPerUnit: Object.fromEntries(Object.entries(counts).map(([unit, count]) => [unit, Number((count / frames.length).toFixed(1))])),
          visibleBallFrames,
          calibration: job.calibration,
        };
      }

      const sourceFrameTimestampSeconds = Math.min(
        Math.max(input.sourceFrameTimestampSeconds ?? reconstruction.sourceStartSeconds, reconstruction.sourceStartSeconds),
        Math.max(reconstruction.sourceStartSeconds, reconstruction.sourceEndSeconds - (1 / 30)),
      );
      let sourceImageDataUrl = input.sourceImageDataUrl;
      if (!sourceImageDataUrl) {
        const [sourceFrame] = await extractTwinTrackingFrameBatch({
          reconstructionId: reconstruction.id,
          userId: ctx.user.id,
          sourceStartSeconds: sourceFrameTimestampSeconds,
          samplingFps: 1,
          startFrameIndex: 0,
          frameCount: 1,
        });
        sourceImageDataUrl = sourceFrame?.dataUrl;
      }
      if (!sourceImageDataUrl) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The selected source frame could not be extracted from the uploaded film." });
      }
      const decoded = decodeSourceFrame(sourceImageDataUrl);
      const sourceImage = await storagePut(
        `tactical-twin/${reconstruction.id}/cinematic/source-${Date.now()}.${decoded.contentType === "image/webp" ? "webp" : "jpg"}`,
        decoded.bytes,
        decoded.contentType,
      );
      const twinPlayers = Array.isArray(reconstruction.players) ? reconstruction.players as Array<Record<string, unknown>> : [];
      const savedGeometry = {
        formation: reconstruction.formation,
        playType: reconstruction.playType,
        target: reconstruction.target,
        defenseScheme: reconstruction.defenseScheme,
        players: twinPlayers.slice(0, 24).map((player, index) => ({
          id: `${player.side === "defense" ? "D" : "O"}${index + 1}`,
          side: player.side,
          x: player.x,
          y: player.y,
          routeType: player.routeType,
          route: Array.isArray(player.route) ? player.route : [],
        })),
        ballPath: reconstruction.ballPath,
        markers: reconstruction.markers,
      };
      const evidenceContext = JSON.stringify({ approvedTracking: approvedTrackingSummary, savedTwinGeometry: savedGeometry });
      const prompt = buildHiggsfieldReplayPrompt({ style: input.style, coachPrompt: input.coachPrompt, evidenceContext });
      const now = Date.now();
      const exportId = await db.createTwinCinematicExport({
        reconstructionId: reconstruction.id,
        trackingJobId: input.trackingJobId ?? null,
        userId: ctx.user.id,
        provider: "higgsfield",
        providerRequestId: null,
        statusUrl: null,
        cancelUrl: null,
        status: "draft",
        model: directHiggsfield ? HIGGSFIELD_VIDEO_PATH : MANUS_HIGGSFIELD_MODEL,
        prompt,
        style: input.style,
        aspectRatio: input.aspectRatio,
        durationSeconds: input.durationSeconds,
        sourceImageKey: sourceImage.key,
        outputFileKey: null,
        outputUrl: null,
        thumbnailFileKey: sourceImage.key,
        provenance: {
          sourceFrameTimestampSeconds,
          sourceReconstructionId: reconstruction.id,
          sourceTrackingJobId: input.trackingJobId ?? null,
          approvedTrackingSummary,
          savedTwinGeometry: savedGeometry,
          label: "AI cinematic interpretation — not scouting evidence",
        },
        errorMessage: null,
        retryCount: 0,
        createdAt: now,
        submittedAt: null,
        completedAt: null,
        updatedAt: now,
      });

      try {
        if (directHiggsfield) {
          const baseUrl = externalBaseUrl(ctx.req);
          const result = await submitHiggsfieldReplay({ sourceImageKey: sourceImage.key, prompt, durationSeconds: input.durationSeconds, webhookUrl: baseUrl ? `${baseUrl}/api/webhooks/higgsfield` : null });
          await db.updateTwinCinematicExport(exportId, ctx.user.id, { providerRequestId: result.request_id, statusUrl: result.status_url ?? null, cancelUrl: result.cancel_url ?? null, status: result.status === "in_progress" ? "in_progress" : "queued", submittedAt: Date.now(), updatedAt: Date.now() });
        } else {
          const result = await submitManusHiggsfieldReplay({ exportId, sourceImageKey: sourceImage.key, prompt, durationSeconds: input.durationSeconds, aspectRatio: input.aspectRatio });
          await db.updateTwinCinematicExport(exportId, ctx.user.id, { providerRequestId: result.taskId, statusUrl: result.taskUrl, cancelUrl: null, status: "queued", submittedAt: Date.now(), updatedAt: Date.now() });
        }
        return requireExport(exportId, ctx.user.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Higgsfield export submission failed";
        await db.updateTwinCinematicExport(exportId, ctx.user.id, { status: "failed", errorMessage: message.slice(0, 600), updatedAt: Date.now() });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  refreshExport: protectedProcedure
    .input(z.object({ exportId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const cinematicExport = await requireExport(input.exportId, ctx.user.id);
      if (!cinematicExport.providerRequestId) return cinematicExport;
      if (cinematicExport.status === "completed" && cinematicExport.outputFileKey) return cinematicExport;
      const viaManus = cinematicExport.model === MANUS_HIGGSFIELD_MODEL;
      if (!viaManus && !hasHiggsfieldCredentials()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Higgsfield credentials are not configured" });

      let providerOutput: string | null = null;
      let terminalStatus: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" = "queued";
      let statusUrl = cinematicExport.statusUrl;
      let cancelUrl = cinematicExport.cancelUrl;
      let errorMessage: string | null = null;
      let retainedRequestId = cinematicExport.providerRequestId;
      if (viaManus) {
        const result = await getManusHiggsfieldReplayStatus(cinematicExport.providerRequestId);
        if (result.recoveryNeeded && result.providerJobId) {
          const recovery = await submitManusHiggsfieldStatusRecovery({
            exportId: cinematicExport.id,
            providerJobId: result.providerJobId,
          });
          const currentProvenance = cinematicExport.provenance && typeof cinematicExport.provenance === "object" && !Array.isArray(cinematicExport.provenance)
            ? cinematicExport.provenance as Record<string, unknown>
            : {};
          await db.updateTwinCinematicExport(cinematicExport.id, ctx.user.id, {
            providerRequestId: recovery.taskId,
            statusUrl: recovery.taskUrl,
            cancelUrl: null,
            status: "in_progress",
            errorMessage: null,
            completedAt: null,
            provenance: {
              ...currentProvenance,
              recoveredProviderJobId: result.providerJobId,
              recoveryMode: "read_only_job_status",
            },
            updatedAt: Date.now(),
          });
          return requireExport(cinematicExport.id, ctx.user.id);
        }
        providerOutput = result.outputUrl ?? null;
        terminalStatus = result.status;
        errorMessage = result.error?.slice(0, 600) ?? null;
        retainedRequestId = result.providerJobId || cinematicExport.providerRequestId;
        cancelUrl = null;
      } else {
        const result = await getHiggsfieldReplayStatus(cinematicExport.providerRequestId);
        providerOutput = higgsfieldOutputUrl(result);
        terminalStatus = ["completed", "failed", "nsfw", "canceled"].includes(result.status) ? result.status : result.status === "in_progress" ? "in_progress" : "queued";
        statusUrl = result.status_url ?? cinematicExport.statusUrl;
        cancelUrl = result.cancel_url ?? cinematicExport.cancelUrl;
        errorMessage = result.error?.slice(0, 600) ?? null;
      }
      const update: Parameters<typeof db.updateTwinCinematicExport>[2] = {
        status: terminalStatus,
        statusUrl,
        cancelUrl,
        outputUrl: providerOutput ?? cinematicExport.outputUrl,
        errorMessage,
        completedAt: ["completed", "failed", "nsfw", "canceled"].includes(terminalStatus) ? Date.now() : null,
        updatedAt: Date.now(),
      };
      if (terminalStatus === "completed" && providerOutput && !cinematicExport.outputFileKey) {
        const stored = await retainHiggsfieldVideo({ requestId: retainedRequestId, sourceUrl: providerOutput, reconstructionId: cinematicExport.reconstructionId });
        update.outputFileKey = stored.key;
        update.outputUrl = stored.url;
      }
      await db.updateTwinCinematicExport(cinematicExport.id, ctx.user.id, update);
      return requireExport(cinematicExport.id, ctx.user.id);
    }),

  cancelExport: protectedProcedure
    .input(z.object({ exportId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const cinematicExport = await requireExport(input.exportId, ctx.user.id);
      if (cinematicExport.providerRequestId && ["queued", "in_progress"].includes(cinematicExport.status)) {
        if (cinematicExport.model === MANUS_HIGGSFIELD_MODEL) await cancelManusHiggsfieldReplay(cinematicExport.providerRequestId);
        else await cancelHiggsfieldReplay(cinematicExport.providerRequestId);
      }
      await db.updateTwinCinematicExport(cinematicExport.id, ctx.user.id, { status: "canceled", completedAt: Date.now(), updatedAt: Date.now() });
      return requireExport(cinematicExport.id, ctx.user.id);
    }),

  exportPlayback: protectedProcedure
    .input(z.object({ exportId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const cinematicExport = await requireExport(input.exportId, ctx.user.id);
      if (!cinematicExport.outputFileKey || cinematicExport.status !== "completed") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Cinematic export is not complete" });
      }
      return {
        url: await storageGetSignedUrl(cinematicExport.outputFileKey),
        posterUrl: cinematicExport.thumbnailFileKey ? await storageGetSignedUrl(cinematicExport.thumbnailFileKey) : null,
        expiresAt: Date.now() + 50 * 60 * 1_000,
      };
    }),

  deleteExport: protectedProcedure
    .input(z.object({ exportId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireExport(input.exportId, ctx.user.id);
      await db.deleteTwinCinematicExport(input.exportId, ctx.user.id);
      return { success: true };
    }),

  createExportShare: protectedProcedure
    .input(z.object({
      exportId: z.number().int().positive(),
      expiresInHours: z.union([z.literal(24), z.literal(72), z.literal(168), z.literal(720)]).default(168),
    }))
    .mutation(async ({ input, ctx }) => {
      const cinematicExport = await requireExport(input.exportId, ctx.user.id);
      if (cinematicExport.status !== "completed" || !cinematicExport.outputFileKey) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only completed retained exports can be shared" });
      }
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const now = Date.now();
      const id = await db.createTwinExportShare({
        exportId: cinematicExport.id,
        reconstructionId: cinematicExport.reconstructionId,
        userId: ctx.user.id,
        tokenHash,
        expiresAt: now + input.expiresInHours * 60 * 60 * 1_000,
        revokedAt: null,
        viewCount: 0,
        lastViewedAt: null,
        createdAt: now,
      });
      return { id, exportId: cinematicExport.id, token, url: `/share/twin-cinematic/${token}`, expiresAt: now + input.expiresInHours * 60 * 60 * 1_000 };
    }),

  listExportShares: protectedProcedure
    .input(z.object({ exportId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      await requireExport(input.exportId, ctx.user.id);
      return db.listTwinExportShares(input.exportId, ctx.user.id);
    }),

  revokeExportShares: protectedProcedure
    .input(z.object({ exportId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await requireExport(input.exportId, ctx.user.id);
      await db.revokeTwinExportShares(input.exportId, ctx.user.id, Date.now());
      return { success: true };
    }),
});

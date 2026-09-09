import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";

const analyzeMock = vi.hoisted(() => vi.fn());
const submitMock = vi.hoisted(() => vi.fn());
const statusMock = vi.hoisted(() => vi.fn());
const retainMock = vi.hoisted(() => vi.fn());
const cancelMock = vi.hoisted(() => vi.fn());
const signedUrlMock = vi.hoisted(() => vi.fn(async (key: string) => `https://storage.example/${key}?signed=1`));
const storagePutMock = vi.hoisted(() => vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })));
const extractFramesMock = vi.hoisted(() => vi.fn());

vi.mock("./tacticalTwinTracking", () => ({
  MAX_TWIN_TRACKING_BATCH: 3,
  analyzeTwinFrameBatch: analyzeMock,
}));

vi.mock("./higgsfieldCinematic", () => ({
  HIGGSFIELD_VIDEO_PATH: "wan-25-preview/image-to-video",
  hasHiggsfieldCredentials: () => true,
  buildHiggsfieldReplayPrompt: ({ style, coachPrompt, evidenceContext }: { style: string; coachPrompt?: string; evidenceContext?: string }) => `INTERPRETATION NOT EVIDENCE ${style} ${coachPrompt ?? ""} ${evidenceContext ?? ""}`,
  submitHiggsfieldReplay: submitMock,
  getHiggsfieldReplayStatus: statusMock,
  higgsfieldOutputUrl: (result: { video?: { url?: string } }) => result.video?.url ?? null,
  retainHiggsfieldVideo: retainMock,
  cancelHiggsfieldReplay: cancelMock,
}));

vi.mock("./storage", () => ({
  storagePut: storagePutMock,
  storageGet: vi.fn(async (key: string) => ({ key, url: `/manus-storage/${key}` })),
  storageGetSignedUrl: signedUrlMock,
}));

vi.mock("./tacticalTwinFrameExtraction", () => ({
  extractTwinTrackingFrameBatch: extractFramesMock,
  resolveOwnedTwinVideoKey: vi.fn(),
}));

import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";
import { DEFAULT_TWIN_FRAME_RATE, frameToProgress, millisecondsForFrame, progressToFrame, stepFrame } from "../shared/tacticalTwinStage2";

function context(userId: number | null): TrpcContext {
  return {
    user: userId ? {
      id: userId,
      openId: `stage2-user-${userId}`,
      name: `Stage 2 Coach ${userId}`,
      email: `stage2-${userId}@example.invalid`,
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { headers: { host: "tacticaledge.example", "x-forwarded-proto": "https" }, protocol: "https", get: (name: string) => name.toLowerCase() === "host" ? "tacticaledge.example" : undefined },
    res: {},
  } as unknown as TrpcContext;
}

function capturedFrame(frameIndex: number) {
  return {
    frameIndex,
    timestampMs: frameIndex * 1_000,
    imageWidth: 640,
    imageHeight: 360,
    dataUrl: `data:image/jpeg;base64,${Buffer.alloc(200, frameIndex + 1).toString("base64")}`,
  };
}

describe("Tactical Twin Stage 2", () => {
  let gameSessionId = 0;
  let reconstructionId = 0;
  let trackingJobId = 0;
  let exportId = 0;

  beforeAll(async () => {
    gameSessionId = await db.createGameSession({
      userId: 41,
      opponentName: "Stage 2 Test Opponent",
      sourceType: "upload",
      videoUrl: "/manus-storage/videos/stage2-test.mp4",
      videoFileKey: "videos/stage2-test.mp4",
      status: "complete",
    });
    const caller = appRouter.createCaller(context(41));
    const twin = await caller.tacticalTwin.createFromFilm({
      sessionId: gameSessionId,
      sourceKind: "film_highlight",
      sourceIndex: 2,
      title: "Stage 2 boundary concept",
      description: "Five-second evidence clip",
      startSeconds: 10,
      durationSeconds: 5,
      formation: "Trips Right",
      playType: "pass",
      target: "Y",
      confidence: 82,
    });
    reconstructionId = twin.id;
  });

  beforeEach(() => {
    extractFramesMock.mockImplementation(async ({ startFrameIndex, frameCount }: { startFrameIndex: number; frameCount: number }) =>
      Array.from({ length: frameCount }, (_, offset) => capturedFrame(startFrameIndex + offset))
    );
    analyzeMock.mockImplementation(async ({ frames }: { frames: ReturnType<typeof capturedFrame>[] }) => ({
      calibration: { quality: "moderate", method: "ai_estimate", confidence: 73, imagePoints: [], fieldPoints: [], limitations: ["Broadcast angle"] },
      frames: frames.map((frame) => ({
        frameIndex: frame.frameIndex,
        timestampMs: frame.timestampMs,
        imageWidth: frame.imageWidth,
        imageHeight: frame.imageHeight,
        frameConfidence: 79,
        players: [{
          trackId: "O1",
          unit: "offense",
          label: "Offense O1",
          jerseyNumber: null,
          bbox: { x: 0.4, y: 0.3, width: 0.08, height: 0.24 },
          imagePoint: { x: 0.44, y: 0.54, confidence: 80 },
          fieldPoint: { x: 0.51, y: 0.61, confidence: 68 },
          occluded: false,
          manuallyCorrected: false,
        }],
        ball: { visible: true, imagePoint: { x: 0.5, y: 0.5, confidence: 62 }, fieldPoint: null, possessedByTrackId: "O1", manuallyCorrected: false },
      })),
    }));
    submitMock.mockResolvedValue({ request_id: "stage2-request-1234", status: "queued", status_url: "https://api.higgsfield.ai/requests/stage2-request-1234/status", cancel_url: "https://api.higgsfield.ai/requests/stage2-request-1234/cancel" });
    statusMock.mockResolvedValue({ request_id: "stage2-request-1234", status: "completed", video: { url: "https://cdn.higgsfield.ai/stage2-result.mp4" } });
    retainMock.mockResolvedValue({ key: "tactical-twin/stage2-result.mp4", url: "/manus-storage/tactical-twin/stage2-result.mp4" });
  });

  afterAll(async () => {
    if (gameSessionId) await db.deleteGameSession(gameSessionId).catch(() => undefined);
  });

  it("keeps slow motion and frame stepping bounded and reversible", () => {
    const totalFrames = DEFAULT_TWIN_FRAME_RATE * 5 + 1;
    expect(progressToFrame(0.5, totalFrames)).toBe(75);
    expect(frameToProgress(75, totalFrames)).toBe(0.5);
    expect(stepFrame(0, -1, totalFrames)).toBe(0);
    expect(stepFrame(totalFrames - 1, 1, totalFrames)).toBe(totalFrames - 1);
    expect(millisecondsForFrame(75, DEFAULT_TWIN_FRAME_RATE)).toBe(2_500);
  });

  it("creates one resumable owner-scoped tracking job and rejects another coach", async () => {
    const owner = appRouter.createCaller(context(41));
    const first = await owner.tacticalTwinStage2.startTracking({ reconstructionId, samplingFps: 1, sourceFps: 30 });
    const repeated = await owner.tacticalTwinStage2.startTracking({ reconstructionId, samplingFps: 1, sourceFps: 30 });
    trackingJobId = first.id;
    expect(repeated.id).toBe(first.id);
    expect(first.totalFrames).toBe(5);
    await expect(appRouter.createCaller(context(42)).tacticalTwinStage2.tracking({ jobId: first.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("persists bounded frame batches, preserves anonymous identities, and requires coach approval", async () => {
    const owner = appRouter.createCaller(context(41));
    await owner.tacticalTwinStage2.analyzeFrameBatch({ jobId: trackingJobId, frames: [capturedFrame(0), capturedFrame(1), capturedFrame(2)] });
    const result = await owner.tacticalTwinStage2.analyzeFrameBatch({ jobId: trackingJobId, frames: [capturedFrame(3), capturedFrame(4)] });
    expect(result.job.status).toBe("review");
    expect(result.job.processedFrames).toBe(5);
    const detail = await owner.tacticalTwinStage2.tracking({ jobId: trackingJobId });
    expect(detail.frames).toHaveLength(5);
    expect((detail.frames[0].players as Array<{ trackId: string; jerseyNumber: string | null }>)[0]).toMatchObject({ trackId: "O1", jerseyNumber: null });
    expect(detail.job.calibration).toMatchObject({ quality: "moderate", confidence: 73 });
    const approved = await owner.tacticalTwinStage2.approveTracking({ jobId: trackingJobId });
    expect(approved.status).toBe("approved");
  });

  it("extracts and analyzes resumable server batches without browser video metadata", async () => {
    const owner = appRouter.createCaller(context(41));
    const serverJob = await owner.tacticalTwinStage2.startTracking({ reconstructionId, samplingFps: 1, sourceFps: 30 });
    expect(serverJob.stage).toBe("waiting_for_server_frames");
    const first = await owner.tacticalTwinStage2.analyzeServerBatch({ jobId: serverJob.id });
    expect(first.job.processedFrames).toBe(1);
    expect(first.job.status).toBe("capturing");
    let result = first;
    for (let index = 1; index < 5; index += 1) result = await owner.tacticalTwinStage2.analyzeServerBatch({ jobId: serverJob.id });
    expect(result.job.processedFrames).toBe(5);
    expect(result.job.status).toBe("review");
    expect(extractFramesMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ reconstructionId, sourceStartSeconds: 10, startFrameIndex: 0, frameCount: 1 }));
    expect(extractFramesMock).toHaveBeenNthCalledWith(5, expect.objectContaining({ reconstructionId, sourceStartSeconds: 10, startFrameIndex: 4, frameCount: 1 }));
    await db.deleteTwinTrackingJob(serverJob.id, 41);
  });

  it("rejects an unapproved tracking job before sending any cinematic provider request", async () => {
    const now = Date.now();
    const unapprovedJobId = await db.createTwinTrackingJob({
      reconstructionId,
      userId: 41,
      status: "review",
      stage: "coach_review",
      samplingFps: 1,
      sourceFps: 30,
      totalFrames: 1,
      processedFrames: 1,
      provider: "gemini-3-flash-preview",
      calibration: null,
      summary: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: now,
      startedAt: now,
      completedAt: now,
      updatedAt: now,
    });
    const sourceImageDataUrl = `data:image/jpeg;base64,${Buffer.alloc(2_000, 7).toString("base64")}`;
    await expect(appRouter.createCaller(context(41)).tacticalTwinStage2.createExport({
      reconstructionId,
      trackingJobId: unapprovedJobId,
      style: "broadcast_cinematic",
      aspectRatio: "16:9",
      durationSeconds: 5,
      sourceImageDataUrl,
    })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(submitMock).not.toHaveBeenCalled();
    await db.deleteTwinTrackingJob(unapprovedJobId, 41);
  });

  it("submits a labeled cinematic interpretation, recovers completion, and retains the MP4", async () => {
    const owner = appRouter.createCaller(context(41));
    const sourceImageDataUrl = `data:image/jpeg;base64,${Buffer.alloc(2_000, 8).toString("base64")}`;
    const cinematicExport = await owner.tacticalTwinStage2.createExport({
      reconstructionId,
      trackingJobId,
      style: "broadcast_cinematic",
      aspectRatio: "16:9",
      durationSeconds: 5,
      coachPrompt: "Emphasize receiver separation",
      sourceImageDataUrl,
    });
    exportId = cinematicExport.id;
    expect(cinematicExport.status).toBe("queued");
    expect(cinematicExport.prompt).toContain("INTERPRETATION NOT EVIDENCE");
    expect(cinematicExport.prompt).toContain('"coachApproved":true');
    expect(cinematicExport.prompt).toContain('"savedTwinGeometry"');
    expect(submitMock).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: 5, webhookUrl: "https://tacticaledge.example/api/webhooks/higgsfield" }));

    const completed = await owner.tacticalTwinStage2.refreshExport({ exportId });
    expect(completed.status).toBe("completed");
    expect(completed.outputFileKey).toBe("tactical-twin/stage2-result.mp4");
    expect(retainMock).toHaveBeenCalledWith(expect.objectContaining({ reconstructionId }));
    const playback = await owner.tacticalTwinStage2.exportPlayback({ exportId });
    expect(playback.url).toContain("stage2-result.mp4?signed=1");
  });

  it("shares only a narrow generated-replay projection and revokes it immediately", async () => {
    const owner = appRouter.createCaller(context(41));
    const share = await owner.tacticalTwinStage2.createExportShare({ exportId, expiresInHours: 24 });
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    const publicCaller = appRouter.createCaller(context(null));
    const projection = await publicCaller.tacticalTwinShare.cinematic({ token: share.token });
    expect(projection.videoUrl).toContain("stage2-result.mp4?signed=1");
    expect(projection.provenanceLabel).toContain("Not verified game-film evidence");
    expect(projection).not.toHaveProperty("players");
    expect(projection).not.toHaveProperty("trackingFrames");
    expect(projection).not.toHaveProperty("sourceVideoUrl");

    await owner.tacticalTwinStage2.revokeExportShares({ exportId });
    await expect(publicCaller.tacticalTwinShare.cinematic({ token: share.token })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns live Stage 2 tracking and export status only to the owning coach", async () => {
    const ownerStatus = await appRouter.createCaller(context(41)).tacticalTwinStage2.libraryStatus({ reconstructionIds: [reconstructionId] });
    expect(ownerStatus).toEqual([expect.objectContaining({ reconstructionId, trackingEligible: true, trackingStatus: "approved", exportStatus: "completed" })]);
    const otherCoachStatus = await appRouter.createCaller(context(42)).tacticalTwinStage2.libraryStatus({ reconstructionIds: [reconstructionId] });
    expect(otherCoachStatus).toEqual([]);
  });

  it("rejects expired share tokens even when the hash exists", async () => {
    const token = randomBytes(24).toString("base64url");
    await db.createTwinExportShare({
      exportId,
      reconstructionId,
      userId: 41,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: Date.now() - 1,
      revokedAt: null,
      viewCount: 0,
      lastViewedAt: null,
      createdAt: Date.now() - 2_000,
    });
    await expect(appRouter.createCaller(context(null)).tacticalTwinShare.cinematic({ token })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

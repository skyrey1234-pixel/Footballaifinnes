import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getGameSession, getLiveGameSession, getPlayReconstruction } from "./db";
import { storageGetSignedUrl } from "./storage";

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 540;

function keyFromStorageUrl(value: string | null | undefined) {
  if (!value?.startsWith("/manus-storage/")) return null;
  return decodeURIComponent(value.slice("/manus-storage/".length));
}

export async function resolveOwnedTwinVideoKey(reconstructionId: number, userId: number) {
  const reconstruction = await getPlayReconstruction(reconstructionId, userId);
  if (!reconstruction || reconstruction.sourceType !== "upload") return null;

  if (reconstruction.gameSessionId) {
    const session = await getGameSession(reconstruction.gameSessionId);
    if (!session || session.userId !== userId) return null;
    return session.videoFileKey || keyFromStorageUrl(session.videoUrl) || keyFromStorageUrl(reconstruction.videoUrl);
  }
  if (reconstruction.liveSessionId) {
    const session = await getLiveGameSession(reconstruction.liveSessionId, userId);
    if (!session || session.sourceType !== "upload") return null;
    return session.videoFileKey || keyFromStorageUrl(session.videoUrl) || keyFromStorageUrl(reconstruction.videoUrl);
  }
  return keyFromStorageUrl(reconstruction.videoUrl);
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    execFile(FFMPEG_PATH, args, { timeout: 45_000, maxBuffer: 5 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }
      reject(new Error(`Frame extraction failed: ${(stderr || error.message).slice(-500)}`));
    });
  });
}

export function buildTwinTrackingFfmpegArgs(input: {
  signedUrl: string;
  extractStartSeconds: number;
  samplingFps: number;
  frameCount: number;
  outputPattern: string;
}) {
  return [
    "-hide_banner",
    "-loglevel", "error",
    "-ss", input.extractStartSeconds.toFixed(3),
    "-i", input.signedUrl,
    "-vf", `fps=${input.samplingFps},scale=${FRAME_WIDTH}:${FRAME_HEIGHT}:force_original_aspect_ratio=decrease,pad=${FRAME_WIDTH}:${FRAME_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
    "-frames:v", String(input.frameCount),
    "-q:v", "5",
    "-y",
    input.outputPattern,
  ];
}

export async function extractTwinTrackingFrameBatch(input: {
  reconstructionId: number;
  userId: number;
  sourceStartSeconds: number;
  samplingFps: number;
  startFrameIndex: number;
  frameCount: number;
}) {
  const videoFileKey = await resolveOwnedTwinVideoKey(input.reconstructionId, input.userId);
  if (!videoFileKey) throw new Error("Stored source film is unavailable for automatic tracking.");
  const signedUrl = await storageGetSignedUrl(videoFileKey);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "tactical-twin-track-"));
  try {
    const relativeStartSeconds = input.startFrameIndex / input.samplingFps;
    const extractStartSeconds = input.sourceStartSeconds + relativeStartSeconds;
    const outputPattern = path.join(workDir, "frame-%03d.jpg");
    await runFfmpeg(buildTwinTrackingFfmpegArgs({
      signedUrl,
      extractStartSeconds,
      samplingFps: input.samplingFps,
      frameCount: input.frameCount,
      outputPattern,
    }));

    const names = (await fs.readdir(workDir)).filter((name) => name.endsWith(".jpg")).sort();
    if (names.length !== input.frameCount) {
      throw new Error(`Expected ${input.frameCount} extracted frames but received ${names.length}.`);
    }
    return Promise.all(names.map(async (name, offset) => {
      const bytes = await fs.readFile(path.join(workDir, name));
      const frameIndex = input.startFrameIndex + offset;
      return {
        frameIndex,
        timestampMs: Math.round((frameIndex / input.samplingFps) * 1000),
        imageWidth: FRAME_WIDTH,
        imageHeight: FRAME_HEIGHT,
        dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
      };
    }));
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

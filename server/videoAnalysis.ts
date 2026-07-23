/**
 * Real film-analysis pipeline for TacticalEdge AI.
 *
 * The old generateReport() fabricated a scouting report from the opponent's
 * NAME alone — it never looked at the footage. This module closes that gap:
 *
 *   1. Resolve the actual video (uploaded file via signed S3 URL, or a YouTube
 *      download via yt-dlp).
 *   2. Use ffmpeg to extract N evenly-spaced frames across the real duration.
 *   3. Send those frames to a VISION-capable model and ask it what it actually
 *      sees (formations, jersey colors, scoreboard, key plays, etc.).
 *   4. Return structured observations + candidate highlights that are anchored
 *      to real frame timestamps, so the report and the "key moments" sidebar
 *      point at plays that genuinely exist in the uploaded film.
 *
 * Every step degrades gracefully: if ffmpeg is missing, the URL can't be
 * fetched, or the vision call fails, analyzeFootballVideo() throws and the
 * caller falls back to the previous name-only behavior (so the product still
 * works). Nothing here is required for the app to boot.
 */

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { invokeLLM } from "./_core/llm";
import { storageGetSignedUrl } from "./storage";

// ---- Config (all optional; sane defaults) -------------------------------

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FRAME_COUNT = Math.max(1, parseInt(process.env.ANALYSIS_FRAME_COUNT || "10", 10));
// Set VISION_MODEL to a vision-capable model on the forge endpoint
// (e.g. gpt-4o, gemini-2.0-flash, etc.). Falls back to the endpoint default.
const VISION_MODEL = process.env.VISION_MODEL || undefined;
const FRAME_WIDTH = parseInt(process.env.ANALYSIS_FRAME_WIDTH || "640", 10);

// ---- Types ---------------------------------------------------------------

export type AnalysisHighlight = {
  timestamp: string; // MM:SS
  seconds: number; // exact second in the video
  title: string;
  note: string;
  category: "offense" | "defense" | "special" | "mistake";
  verdict: "good" | "bad";
};

export type VideoAnalysis = {
  visualSummary: string;
  observations: string[];
  highlights: AnalysisHighlight[];
  frameCount: number;
  method: "vision" | "fallback";
};

// ---- Helpers -------------------------------------------------------------

const execFileAsync = (cmd: string, args: string[]) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const e = err as Error & { stderr?: string };
        reject(new Error(`${cmd} failed: ${e.message} ${stderr || ""}`.trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

/** Resolve a video to a local file path. Returns null if it can't be obtained. */
async function resolveVideoLocalPath(input: {
  videoFileKey?: string | null;
  youtubeVideoId?: string | null;
}): Promise<string | null> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "tacticaledge-"));
  const outPath = path.join(workDir, "source.mp4");

  // 1) Uploaded file -> signed S3 URL -> download bytes.
  if (input.videoFileKey) {
    try {
      const signed = await storageGetSignedUrl(input.videoFileKey);
      const resp = await fetch(signed);
      if (!resp.ok) throw new Error(`signed URL fetch ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      await fs.writeFile(outPath, buf);
      return outPath;
    } catch (err) {
      console.warn("[VideoAnalysis] Could not fetch uploaded video:", (err as Error).message);
      return null;
    }
  }

  // 2) YouTube -> yt-dlp download (requires yt-dlp on PATH).
  if (input.youtubeVideoId) {
    try {
      // Probe for yt-dlp first so we fail loudly+early with a useful message.
      await execFileAsync("yt-dlp", ["--version"]);
    } catch {
      console.warn(
        "[VideoAnalysis] yt-dlp not installed — cannot analyze YouTube footage. " +
          "Install with `pip install yt-dlp` (or brew install yt-dlp) to enable YouTube analysis."
      );
      return null;
    }
    try {
      await execFileAsync("yt-dlp", [
        "-f",
        "best[ext=mp4]/best",
        "-o",
        outPath,
        `https://www.youtube.com/watch?v=${input.youtubeVideoId}`,
      ]);
      return outPath;
    } catch (err) {
      console.warn("[VideoAnalysis] YouTube download failed:", (err as Error).message);
      return null;
    }
  }

  return null;
}

/** Parse "Duration: HH:MM:SS.ss" from ffmpeg's stderr probe. */
async function getVideoDurationSeconds(videoPath: string): Promise<number> {
  // NOTE: `ffmpeg -i` exits non-zero by design (no output file specified), so
  // we run it without treating a non-zero exit as failure — we only need stderr.
  const stderr = await new Promise<string>((resolve) => {
    execFile(
      FFMPEG_PATH,
      ["-i", videoPath],
      { maxBuffer: 50 * 1024 * 1024 },
      (_err, _stdout, errStderr) => resolve(errStderr || "")
    );
  });
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) throw new Error("Could not determine video duration");
  const hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const secs = parseFloat(m[3]);
  return hours * 3600 + mins * 60 + secs;
}

/** Extract one JPEG frame at the given second. */
async function extractFrameAt(
  videoPath: string,
  timeSec: number,
  outPath: string
): Promise<void> {
  await execFileAsync(FFMPEG_PATH, [
    "-ss",
    timeSec.toFixed(2),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${FRAME_WIDTH}:-1`,
    "-q:v",
    "5",
    outPath,
  ]);
}

function secondsToTimestamp(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// ---- Core ----------------------------------------------------------------

/**
 * Analyze the real footage for a session. Throws on any unrecoverable
 * problem so the caller can fall back to the name-only report.
 */
export async function analyzeFootballVideo(input: {
  opponentName: string;
  videoFileKey?: string | null;
  youtubeVideoId?: string | null;
}): Promise<VideoAnalysis> {
  const videoPath = await resolveVideoLocalPath(input);
  if (!videoPath) throw new Error("No analyzable video source available");

  const workDir = path.dirname(videoPath);
  let duration = 0;
  try {
    duration = await getVideoDurationSeconds(videoPath);
  } catch (err) {
    throw new Error(`Duration probe failed: ${(err as Error).message}`);
  }
  if (duration <= 0) throw new Error("Video has zero duration");

  // Evenly spaced timestamps across the real duration (skip the very edges).
  const timestamps: number[] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    // spread from 5% to 95% of the video so we avoid dead intros/outros
    const frac = FRAME_COUNT === 1 ? 0.5 : 0.05 + (0.9 * i) / (FRAME_COUNT - 1);
    timestamps.push(frac * duration);
  }

  const framePaths: string[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const fp = path.join(workDir, `frame_${String(i).padStart(2, "0")}.jpg`);
    await extractFrameAt(videoPath, timestamps[i], fp);
    framePaths.push(fp);
  }

  // Build base64 data-URIs (self-contained; no external fetch needed by the model).
  const imageParts = await Promise.all(
    framePaths.map(async (fp) => {
      const buf = await fs.readFile(fp);
      const b64 = buf.toString("base64");
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${b64}`,
          detail: "low" as const,
        },
      };
    })
  );

  const frameTimeLegend = timestamps
    .map((t, i) => `frame ${i} = ${secondsToTimestamp(t)} (${t.toFixed(1)}s)`)
    .join(", ");

  const visionPrompt = `You are an expert football film analyst watching ACTUAL game footage (${imageParts.length} frames sampled evenly across the game, legends below). Describe ONLY what you can see in these images — do not invent plays you cannot observe.

FRAME TIMELINE: ${frameTimeLegend}

For each frame, note: scoreboard/readable text (score, quarter, down & distance, time), jersey colors/numbers, offensive/defensive alignment, whether the ball is being thrown/run, and any obvious scheme (spread, I-formation, 4-3 box, nickel, blitz look, etc.).

Return JSON:
{
  "visual_summary": "2-4 sentence overview of what the footage actually shows",
  "observations": ["concrete observation 1", "concrete observation 2", ... 6-12 items, each tied to a frame when possible],
  "detected_plays": [
    {
      "frameIndex": <integer index of the frame where this play occurs>,
      "title": "short title of the play",
      "description": "what is happening in that frame",
      "category": "offense" | "defense" | "special" | "mistake",
      "verdict": "good" | "bad"
    }
  ]
}

Only include detected_plays you can actually support from a frame. Set frameIndex to the exact frame number from the timeline. Return ONLY valid JSON.`;

  const response = await invokeLLM({
    model: VISION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an elite football film analyst. You describe only what is visible in provided frames. Return only valid JSON, no markdown.",
      },
      {
        role: "user",
        content: [{ type: "text", text: visionPrompt }, ...imageParts],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "film_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            visual_summary: { type: "string" },
            observations: { type: "array", items: { type: "string" } },
            detected_plays: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  frameIndex: { type: "number" },
                  title: { type: "string" },
                  description: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["offense", "defense", "special", "mistake"],
                  },
                  verdict: { type: "string", enum: ["good", "bad"] },
                },
                required: ["frameIndex", "title", "description", "category", "verdict"],
                additionalProperties: false,
              },
            },
          },
          required: ["visual_summary", "observations", "detected_plays"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("Vision model returned no content");
  const parsed = JSON.parse(raw) as {
    visual_summary: string;
    observations: string[];
    detected_plays: Array<{
      frameIndex: number;
      title: string;
      description: string;
      category: "offense" | "defense" | "special" | "mistake";
      verdict: "good" | "bad";
    }>;
  };

  // Anchor highlights to REAL frame timestamps (no more fabricated MM:SS).
  const highlights: AnalysisHighlight[] = parsed.detected_plays
    .filter((p) => Number.isInteger(p.frameIndex) && p.frameIndex >= 0 && p.frameIndex < timestamps.length)
    .map((p) => {
      const secs = timestamps[p.frameIndex];
      return {
        timestamp: secondsToTimestamp(secs),
        seconds: Math.round(secs),
        title: p.title,
        note: p.description,
        category: p.category,
        verdict: p.verdict,
      };
    })
    // de-dupe by seconds, keep first
    .filter((h, idx, arr) => arr.findIndex((x) => x.seconds === h.seconds) === idx);

  // Stash the local path on the returned object so the caller can clean up
  // temp files afterward (the property is read via a cast in routers.ts).
  const result: VideoAnalysis & { localPath?: string } = {
    visualSummary: parsed.visual_summary,
    observations: parsed.observations || [],
    highlights,
    frameCount: imageParts.length,
    method: "vision",
  };
  Object.defineProperty(result, "localPath", { value: videoPath, enumerable: false });
  return result;
}

/** Clean up any temp files we created for a session's analysis. */
export async function cleanupAnalysisTemp(videoPath: string | null): Promise<void> {
  if (!videoPath) return;
  try {
    await fs.rm(path.dirname(videoPath), { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

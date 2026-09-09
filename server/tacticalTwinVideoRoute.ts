import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { sdk } from "./_core/sdk";
import { getGameSession, getLiveGameSession, getPlayReconstruction } from "./db";
import { normalizeLiveReplayRange } from "./liveVideoRoute";
import { storageGetSignedUrl } from "./storage";
import { verifyTacticalTwinPlaybackToken } from "./tacticalTwinPlaybackToken";

export const tacticalTwinVideoRouter = Router();

const FORWARDED_RESPONSE_HEADERS = [
  "accept-ranges",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

function keyFromStorageUrl(value: string | null | undefined) {
  if (!value?.startsWith("/manus-storage/")) return null;
  return decodeURIComponent(value.slice("/manus-storage/".length));
}

async function resolveOwnedVideoKey(reconstructionId: number, userId: number) {
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

async function streamTacticalTwinVideo(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid Tactical Twin" });
      return;
    }

    const accessToken = typeof req.query.access === "string" ? req.query.access : "";
    const playbackAccess = accessToken ? verifyTacticalTwinPlaybackToken(accessToken) : null;
    if (accessToken && (!playbackAccess || playbackAccess.reconstructionId !== id)) {
      res.status(401).json({ error: "Source-film access expired. Refresh Tactical Twin to continue." });
      return;
    }
    const userId = playbackAccess?.userId ?? (await sdk.authenticateRequest(req)).id;
    const videoFileKey = await resolveOwnedVideoKey(id, userId);
    if (!videoFileKey) {
      res.status(404).json({ error: "Tactical Twin source film not found" });
      return;
    }

    const signedUrl = await storageGetSignedUrl(videoFileKey);
    const abortController = new AbortController();
    res.on("close", () => abortController.abort());

    const headers: Record<string, string> = { "Accept-Encoding": "identity" };
    if (typeof req.headers.range === "string") headers.Range = normalizeLiveReplayRange(req.headers.range) ?? req.headers.range;
    if (typeof req.headers["if-range"] === "string") headers["If-Range"] = req.headers["if-range"];

    const upstream = await fetch(signedUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers,
      signal: abortController.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: "Tactical Twin source storage unavailable" });
      return;
    }

    res.status(upstream.status);
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("Content-Disposition", "inline");
    if (req.method === "HEAD" || !upstream.body) {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(upstream.body as never);
    stream.on("error", (streamError) => {
      if (streamError instanceof Error && streamError.name === "AbortError") return;
      console.error("[TacticalTwinVideo] Upstream stream failed", streamError);
      if (!res.headersSent) res.status(502).json({ error: "Tactical Twin source stream interrupted" });
      else if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown source-film error";
    if (message.toLowerCase().includes("auth") || message.toLowerCase().includes("login")) {
      res.status(401).json({ error: "Please sign in to view this source film" });
      return;
    }
    console.error("[TacticalTwinVideo] Stream failed", error);
    res.status(502).json({ error: "Could not load Tactical Twin source film" });
  }
}

tacticalTwinVideoRouter.get("/api/tactical-twin/video/:id", streamTacticalTwinVideo);
tacticalTwinVideoRouter.head("/api/tactical-twin/video/:id", streamTacticalTwinVideo);

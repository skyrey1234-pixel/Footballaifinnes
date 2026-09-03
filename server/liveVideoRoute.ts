import { Router, type Request, type Response } from "express";
import { Readable } from "node:stream";
import { getLiveGameSession } from "./db";
import { sdk } from "./_core/sdk";
import { storageGetSignedUrl } from "./storage";

export const liveVideoRouter = Router();

const FORWARDED_RESPONSE_HEADERS = [
  "accept-ranges",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

async function streamLiveReplay(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid live session" });
      return;
    }

    const session = await getLiveGameSession(id, user.id);
    if (!session || session.sourceType !== "upload" || !session.videoFileKey) {
      res.status(404).json({ error: "Replay not found" });
      return;
    }

    const signedUrl = await storageGetSignedUrl(session.videoFileKey);
    const abortController = new AbortController();
    // `req.close` can fire once the request body is consumed, before a streamed
    // response finishes. Tie cancellation to the response/client connection.
    res.on("close", () => abortController.abort());

    const headers: Record<string, string> = { "Accept-Encoding": "identity" };
    if (typeof req.headers.range === "string") headers.Range = req.headers.range;
    if (typeof req.headers["if-range"] === "string") headers["If-Range"] = req.headers["if-range"];

    const upstream = await fetch(signedUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers,
      signal: abortController.signal,
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({ error: "Replay storage unavailable" });
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
      console.error("[LiveReplay] Upstream stream failed", streamError);
      if (!res.headersSent) res.status(502).json({ error: "Replay stream interrupted" });
      else if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown replay error";
    if (message.toLowerCase().includes("auth") || message.toLowerCase().includes("login")) {
      res.status(401).json({ error: "Please sign in to view this replay" });
      return;
    }
    console.error("[LiveReplay] Stream failed", error);
    res.status(502).json({ error: "Could not load replay video" });
  }
}

liveVideoRouter.get("/api/live/video/:id", streamLiveReplay);
liveVideoRouter.head("/api/live/video/:id", streamLiveReplay);

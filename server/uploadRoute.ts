import { Router, type Request } from "express";
import Busboy from "busboy";
import { Readable } from "stream";

// ---------------------------------------------------------------------------
// Video upload — chunked to work around the production infrastructure's hard
// ~32MB per-request body limit (the load balancer returns 413 for anything
// larger, before the request ever reaches this code).
//
// Flow:
//   1. Client slices the file into CHUNK_SIZE pieces (well under 32MB).
//   2. POST /api/upload/chunk?uploadId=..&index=N  (raw body) — each chunk is
//      streamed straight to S3 as videos/tmp/{uploadId}/{index} (no buffering).
//   3. POST /api/upload/complete — the server streams every chunk back out of
//      S3, in order, through a single presigned PUT into the final object.
//      Server<->S3 bandwidth is fast in both directions and nothing is held
//      in memory beyond one small pipe buffer.
//
// The legacy single-request path (POST /api/upload) is kept for small files.
// ---------------------------------------------------------------------------
const uploadRouter = Router();

const MAX_FILE_SIZE = 6 * 1024 * 1024 * 1024; // 6GB — 28+ min game film friendly
const MAX_CHUNK_SIZE = 30 * 1024 * 1024; // must stay under the ~32MB LB gate
const MAX_CHUNKS = 400; // 400 × 25MB ≈ 10GB addressable

function forgeConfig() {
  const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
  if (!forgeUrl || !forgeKey) throw new Error("Storage is not configured");
  return { forgeUrl, forgeKey };
}

async function presign(kind: "put" | "get", fileKey: string): Promise<string> {
  const { forgeUrl, forgeKey } = forgeConfig();
  const u = new URL(`v1/storage/presign/${kind}`, forgeUrl + "/");
  u.searchParams.set("path", fileKey);
  const resp = await fetch(u, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage presign failed (${resp.status}): ${msg}`);
  }
  const { url } = (await resp.json()) as { url: string };
  if (!url) throw new Error("Forge returned empty presign URL");
  return url;
}

function sanitizeId(raw: unknown): string | null {
  const s = String(raw ?? "");
  return /^[a-zA-Z0-9_-]{8,64}$/.test(s) ? s : null;
}

// --- Status endpoint: which chunks already exist (resume support) ----------
// HEADs each tmp chunk via a presigned GET so an interrupted upload can skip
// chunks that already landed in storage.
uploadRouter.get("/api/upload/status", async (req: Request, res) => {
  try {
    const uploadId = sanitizeId(req.query.uploadId);
    const totalChunks = Number(req.query.totalChunks);
    if (!uploadId || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
      res.status(400).json({ error: "Invalid uploadId or totalChunks" });
      return;
    }
    const indexes = Array.from({ length: totalChunks }, (_, i) => i);
    const results: boolean[] = new Array(totalChunks).fill(false);
    const CONC = 10;
    for (let start = 0; start < indexes.length; start += CONC) {
      await Promise.all(
        indexes.slice(start, start + CONC).map(async (i) => {
          try {
            const key = `videos/tmp/${uploadId}/${String(i).padStart(4, "0")}`;
            const url = await presign("get", key);
            const r = await fetch(url, { method: "HEAD" });
            results[i] = r.ok;
          } catch {
            results[i] = false;
          }
        }),
      );
    }
    res.json({ have: indexes.filter((i) => results[i]) });
  } catch (err: any) {
    console.error("[Upload] status error:", err);
    res.status(500).json({ error: err?.message || "Status check failed" });
  }
});

// --- Chunk endpoint: raw body streamed straight to S3 ----------------------
uploadRouter.post("/api/upload/chunk", async (req: Request, res) => {
  try {
    const uploadId = sanitizeId(req.query.uploadId);
    const index = Number(req.query.index);
    const chunkSize = Number(req.headers["content-length"]);
    if (!uploadId || !Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) {
      res.status(400).json({ error: "Invalid uploadId or index" });
      return;
    }
    if (!Number.isFinite(chunkSize) || chunkSize <= 0 || chunkSize > MAX_CHUNK_SIZE) {
      res.status(400).json({ error: "Invalid chunk size" });
      return;
    }
    const chunkKey = `videos/tmp/${uploadId}/${String(index).padStart(4, "0")}`;
    const s3Url = await presign("put", chunkKey);
    const putResp = await fetch(s3Url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(chunkSize),
      },
      body: Readable.toWeb(req) as unknown as BodyInit,
      // @ts-expect-error - duplex is required by Node fetch for streaming bodies
      duplex: "half",
    });
    if (!putResp.ok) {
      console.error("[Upload] chunk S3 PUT failed:", putResp.status);
      res.status(502).json({ error: "Storage upload failed. Please retry this chunk." });
      return;
    }
    res.json({ ok: true, index });
  } catch (err: any) {
    console.error("[Upload] chunk error:", err);
    res.status(500).json({ error: err?.message || "Chunk upload failed" });
  }
});

// --- Complete endpoint: reassemble chunks into the final object ------------
uploadRouter.post("/api/upload/complete", async (req, res) => {
  try {
    const uploadId = sanitizeId(req.query.uploadId);
    const totalChunks = Number(req.query.totalChunks);
    const totalSize = Number(req.query.totalSize);
    const rawName = String(req.query.filename || "video.mp4");
    const contentType = String(req.query.contentType || "video/mp4");
    if (!uploadId || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS) {
      res.status(400).json({ error: "Invalid uploadId or totalChunks" });
      return;
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_FILE_SIZE) {
      res.status(400).json({ error: "Invalid total size (max 6GB)" });
      return;
    }
    const filename = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileKey = `videos/${Date.now()}-${filename}`;

    // Presign GETs for all chunks up front.
    const chunkKeys = Array.from({ length: totalChunks }, (_, i) =>
      `videos/tmp/${uploadId}/${String(i).padStart(4, "0")}`,
    );
    const getUrls = await Promise.all(chunkKeys.map((k) => presign("get", k)));

    // Build one continuous stream that plays the chunks back in order.
    const concatChunks = async function* () {
      for (let i = 0; i < getUrls.length; i++) {
        const r = await fetch(getUrls[i]);
        if (!r.ok || !r.body) throw new Error(`Chunk ${i} missing from storage (${r.status})`);
        const reader = r.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      }
    };

    const putUrl = await presign("put", fileKey);
    const putResp = await fetch(putUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
      },
      body: Readable.toWeb(Readable.from(concatChunks())) as unknown as BodyInit,
      // @ts-expect-error - duplex is required by Node fetch for streaming bodies
      duplex: "half",
    });
    if (!putResp.ok) {
      console.error("[Upload] assemble S3 PUT failed:", putResp.status);
      res.status(502).json({ error: "Failed to assemble video in storage." });
      return;
    }
    res.json({ fileKey, url: `/manus-storage/${fileKey}` });
  } catch (err: any) {
    console.error("[Upload] complete error:", err);
    res.status(500).json({ error: err?.message || "Failed to finalize upload" });
  }
});

// --- Legacy single-request path for small files (< chunk size) -------------
uploadRouter.post("/api/upload", (req, res) => {
  let responded = false;
  const fail = (status: number, error: string) => {
    if (responded) return;
    responded = true;
    res.status(status).json({ error });
  };

  const fileSizeHeader = req.headers["x-file-size"];
  const fileSize = Number(Array.isArray(fileSizeHeader) ? fileSizeHeader[0] : fileSizeHeader);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    fail(400, "Missing or invalid X-File-Size header");
    return;
  }
  if (fileSize > MAX_FILE_SIZE) {
    fail(413, "Video is too large (max 6GB)");
    return;
  }

  try {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    });

    let handled = false;

    busboy.on("file", (_name, fileStream, info) => {
      handled = true;
      const filename = (info.filename || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
      const contentType = info.mimeType || "video/mp4";
      const fileKey = `videos/${Date.now()}-${filename}`;

      fileStream.on("limit", () => {
        fileStream.resume();
        fail(413, "Video is too large (max 6GB)");
      });

      (async () => {
        try {
          const s3Url = await presign("put", fileKey);
          const uploadResp = await fetch(s3Url, {
            method: "PUT",
            headers: {
              "Content-Type": contentType,
              "Content-Length": String(fileSize),
            },
            body: Readable.toWeb(fileStream) as unknown as BodyInit,
            // @ts-expect-error - duplex is required by Node fetch for streaming bodies
            duplex: "half",
          });
          if (!uploadResp.ok) {
            console.error("[Upload] S3 PUT failed:", uploadResp.status);
            fail(502, "Storage upload failed. Please try again.");
            return;
          }
          if (!responded) {
            responded = true;
            res.json({ fileKey, url: `/manus-storage/${fileKey}` });
          }
        } catch (err: any) {
          console.error("[Upload] Error:", err);
          fail(500, err?.message || "Upload failed");
        }
      })();
    });

    busboy.on("error", (err: any) => {
      console.error("[Upload] Busboy error:", err);
      fail(400, "Malformed upload request");
    });

    busboy.on("finish", () => {
      if (!handled) fail(400, "No file provided");
    });

    req.pipe(busboy);
  } catch (err: any) {
    console.error("[Upload] Error:", err);
    fail(500, err?.message || "Upload failed");
  }
});

export { uploadRouter };

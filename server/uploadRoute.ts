import { Router } from "express";
import Busboy from "busboy";
import { Readable } from "stream";

// Streams the uploaded file straight through to S3 via a presigned PUT URL.
// The file is never fully buffered in memory, so this works within the
// production container's 512MB memory limit even for large videos.
const uploadRouter = Router();

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

async function getPresignedPutUrl(fileKey: string): Promise<string> {
  const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
  if (!forgeUrl || !forgeKey) throw new Error("Storage is not configured");
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", fileKey);
  const resp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage presign failed (${resp.status}): ${msg}`);
  }
  const { url } = (await resp.json()) as { url: string };
  if (!url) throw new Error("Forge returned empty presign URL");
  return url;
}

uploadRouter.post("/api/upload", (req, res) => {
  let responded = false;
  const fail = (status: number, error: string) => {
    if (responded) return;
    responded = true;
    res.status(status).json({ error });
  };

  // S3 presigned PUTs require an explicit Content-Length (chunked transfer
  // returns 501). The client sends the exact file size in this header.
  const fileSizeHeader = req.headers["x-file-size"];
  const fileSize = Number(Array.isArray(fileSizeHeader) ? fileSizeHeader[0] : fileSizeHeader);
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    fail(400, "Missing or invalid X-File-Size header");
    return;
  }
  if (fileSize > MAX_FILE_SIZE) {
    fail(413, "Video is too large (max 2GB)");
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
        fail(413, "Video is too large (max 2GB)");
      });

      (async () => {
        try {
          const s3Url = await getPresignedPutUrl(fileKey);
          // Stream the request body straight to S3 (chunked, no buffering).
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

import { Router } from "express";
import multer from "multer";
import { storagePut } from "./storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const uploadRouter = Router();

uploadRouter.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const filename = req.file.originalname || "video.mp4";
    const fileKey = `videos/${Date.now()}-${filename}`;
    const result = await storagePut(fileKey, req.file.buffer, req.file.mimetype);
    res.json({ fileKey: result.key, url: result.url });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

export { uploadRouter };

import { Router } from "express";
import { z } from "zod";
import * as db from "./db";

const webhookSchema = z.object({
  request_id: z.string().min(8).max(80),
  status: z.enum(["completed", "failed", "nsfw", "canceled"]),
  error: z.string().max(1_000).nullable().optional(),
  payload: z.object({
    video: z.object({
      url: z.string().url(),
      content_type: z.string().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
});

export const higgsfieldWebhookRouter = Router();

higgsfieldWebhookRouter.post("/api/webhooks/higgsfield", async (req, res) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid Higgsfield webhook payload" });
    return;
  }

  try {
    const cinematicExport = await db.getTwinCinematicExportByProviderRequest(parsed.data.request_id);
    if (!cinematicExport) {
      // Acknowledge unknown-but-valid request IDs so provider retries do not create noise.
      res.status(202).json({ accepted: true });
      return;
    }
    const outputUrl = parsed.data.payload?.video?.url ?? cinematicExport.outputUrl;
    await db.updateTwinCinematicExport(cinematicExport.id, cinematicExport.userId, {
      status: parsed.data.status,
      outputUrl,
      errorMessage: parsed.data.error?.slice(0, 600) ?? null,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
    res.status(202).json({ accepted: true });
  } catch (error) {
    console.error("[HiggsfieldWebhook] Could not persist terminal export state", error);
    res.status(500).json({ error: "Webhook persistence failed" });
  }
});


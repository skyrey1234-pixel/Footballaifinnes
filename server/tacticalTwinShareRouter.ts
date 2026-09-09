import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { storageGetSignedUrl } from "./storage";

function shareHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const tacticalTwinShareRouter = router({
  cinematic: publicProcedure
    .input(z.object({ token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/) }))
    .query(async ({ input }) => {
      const share = await db.getTwinExportShareByHash(shareHash(input.token));
      if (!share || share.revokedAt || share.expiresAt <= Date.now()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This cinematic replay link is unavailable or expired" });
      }
      const cinematicExport = await db.getTwinCinematicExport(share.exportId, share.userId);
      if (!cinematicExport || cinematicExport.status !== "completed" || !cinematicExport.outputFileKey) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This cinematic replay is unavailable" });
      }
      const reconstruction = await db.getPlayReconstruction(share.reconstructionId, share.userId);
      if (!reconstruction) throw new TRPCError({ code: "NOT_FOUND", message: "This cinematic replay is unavailable" });
      await db.updateTwinExportShare(share.id, { viewCount: share.viewCount + 1, lastViewedAt: Date.now() });
      return {
        title: reconstruction.title,
        sourceTitle: reconstruction.sourceTitle,
        style: cinematicExport.style,
        aspectRatio: cinematicExport.aspectRatio,
        durationSeconds: cinematicExport.durationSeconds,
        videoUrl: await storageGetSignedUrl(cinematicExport.outputFileKey),
        expiresAt: share.expiresAt,
        provenanceLabel: "AI cinematic interpretation created from a Tactical Twin source frame. Not verified game-film evidence.",
      };
    }),
});


import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/routers";
import { sdk } from "../server/_core/sdk";

const token = await sdk.createSessionToken("cF75iUpUE4C3c4ofZdZ6CT", {
  name: "skyler rey Trinidad",
  expiresInMs: 5 * 60 * 1000,
});

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "https://tacticalai-yt2mojug.manus.space/api/trpc",
      transformer: superjson,
      headers: { Authorization: `Bearer ${token}` },
    }),
  ],
});

const startedAt = Date.now();
const result = await client.live.analyzeWindow.mutate({
  id: 2_310_001,
  windowIndex: 9,
  windowStartSeconds: 45,
  windowEndSeconds: 50,
  frames: ["data:image/jpeg;base64,not-a-real-jpeg-frame-000000000000000000000000"],
  situation: {
    quarter: "1st",
    clock: "11:50",
    down: 1,
    distance: 10,
    yardLine: "50",
    ourScore: 0,
    opponentScore: 0,
    possession: "unknown",
    notes: "Production recovery verification for the previously failed five-second window.",
  },
});

console.log(JSON.stringify({
  recovered: result.recovered,
  canceled: result.canceled,
  windowIndex: result.event?.windowIndex,
  confidence: result.event?.confidence,
  predictionCount: result.event?.nextPlayProbabilities?.length,
  elapsedMs: Date.now() - startedAt,
}));

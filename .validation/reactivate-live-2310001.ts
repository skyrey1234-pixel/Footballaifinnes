import { appRouter } from "../server/routers";
import * as db from "../server/db";
import type { TrpcContext } from "../server/_core/context";

const session = await db.getLiveGameSession(2_310_001, 1);
if (!session) throw new Error("Live session 2310001 not found for owner 1");

const caller = appRouter.createCaller({
  user: {
    id: 1,
    openId: "cF75iUpUE4C3c4ofZdZ6CT",
    name: "skyler rey Trinidad",
    email: "skyrey1234@gmail.com",
    loginMethod: "google",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { headers: {} },
  res: {},
} as unknown as TrpcContext);

await caller.live.update({
  id: session.id,
  status: "ready",
  currentVideoSecond: 45,
  situation: session.situation as {
    quarter: string;
    clock: string;
    down: number;
    distance: number;
    yardLine: string;
    ourScore: number;
    opponentScore: number;
    possession: "us" | "opponent" | "unknown";
    notes?: string;
  },
});

console.log(JSON.stringify({ id: session.id, status: "ready", currentVideoSecond: 45 }));

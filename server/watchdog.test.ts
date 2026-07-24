/**
 * Watchdog test: sessions stuck in "analyzing" for >10 minutes must be
 * flipped to "failed" when read via sessions.get / sessions.list, so the UI
 * shows the Retry path instead of an infinite spinner.
 */
import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";

function makeCtx(role: "admin" | "user" = "admin") {
  return {
    user: { id: 1, openId: "test-open-id", name: "Test", role },
    req: { headers: {} },
    res: { clearCookie: () => {}, cookie: () => {} },
  } as never;
}

describe("stuck-analyzing watchdog", () => {
  let sessionId: number;

  afterAll(async () => {
    if (sessionId) await db.deleteGameSession(sessionId).catch(() => {});
  });

  it("flips a session stuck in analyzing >10min to failed on get", async () => {
    sessionId = await db.createGameSession({
      userId: 1,
      opponentName: "Watchdog Test Opponent",
      gameDate: null,
      sourceType: "upload",
      youtubeVideoId: null,
      videoFileKey: null,
      videoUrl: null,
      status: "analyzing",
    });

    // Backdate updatedAt to 20 minutes ago via raw update
    const { getDb } = await import("./db");
    const { gameSessions } = await import("../drizzle/schema");
    const { eq, sql } = await import("drizzle-orm");
    const dbi = await getDb();
    await dbi
      .update(gameSessions)
      .set({ updatedAt: sql`NOW() - INTERVAL 20 MINUTE` })
      .where(eq(gameSessions.id, sessionId));

    const caller = appRouter.createCaller(makeCtx());
    const session = await caller.sessions.get({ id: sessionId });
    expect(session.status).toBe("failed");

    // And it must be persisted, not just mutated in the response
    const persisted = await db.getGameSession(sessionId);
    expect(persisted?.status).toBe("failed");
  });

  it("leaves a fresh analyzing session untouched", async () => {
    await db.updateGameSessionStatus(sessionId, "analyzing");
    const caller = appRouter.createCaller(makeCtx());
    const session = await caller.sessions.get({ id: sessionId });
    expect(session.status).toBe("analyzing");
  });
});

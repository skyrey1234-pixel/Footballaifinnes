import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createViewerContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "viewer-user",
      email: "viewer@example.com",
      name: "Viewer User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("sessions router", () => {
  it("admin can list sessions", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const sessions = await caller.sessions.list();
    expect(Array.isArray(sessions)).toBe(true);
  });

  it("viewer cannot create sessions (FORBIDDEN)", async () => {
    const ctx = createViewerContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.sessions.create({
        opponentName: "Test Team",
        sourceType: "youtube",
        youtubeVideoId: "abc123",
      })
    ).rejects.toThrow();
  });

  it("viewer can list sessions", async () => {
    const ctx = createViewerContext();
    const caller = appRouter.createCaller(ctx);
    const sessions = await caller.sessions.list();
    expect(Array.isArray(sessions)).toBe(true);
  });
});

describe("reports router", () => {
  it("returns null for non-existent session report", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const report = await caller.reports.getBySession({ sessionId: 99999 });
    expect(report).toBeNull();
  });
});

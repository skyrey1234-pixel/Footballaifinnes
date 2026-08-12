import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getUserById: vi.fn(),
  updateUserBranding: vi.fn(),
}));

import * as db from "./db";
import { appRouter } from "./routers";

const user = {
  id: 12,
  openId: "branding-test-user",
  email: "coach@example.com",
  name: "Coach Test",
  loginMethod: "manus",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createCaller() {
  return appRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

describe("branding router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the TacticalEdge blue-and-gold defaults when a coach has not chosen colors", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ ...user, schoolName: null, schoolPrimaryColor: null, schoolSecondaryColor: null });

    await expect(createCaller().branding.get()).resolves.toEqual({
      schoolName: null,
      schoolPrimaryColor: "#006778",
      schoolSecondaryColor: "#D7A22A",
    });
  });

  it("saves a coach's school branding and normalizes colors to uppercase", async () => {
    vi.mocked(db.updateUserBranding).mockResolvedValue({
      ...user,
      schoolName: "Riverside Eagles",
      schoolPrimaryColor: "#0B5ED7",
      schoolSecondaryColor: "#FFD700",
    });

    await expect(createCaller().branding.update({
      schoolName: " Riverside Eagles ",
      schoolPrimaryColor: "#0b5ed7",
      schoolSecondaryColor: "#ffd700",
    })).resolves.toEqual({
      schoolName: "Riverside Eagles",
      schoolPrimaryColor: "#0B5ED7",
      schoolSecondaryColor: "#FFD700",
    });

    expect(db.updateUserBranding).toHaveBeenCalledWith(12, {
      schoolName: "Riverside Eagles",
      schoolPrimaryColor: "#0B5ED7",
      schoolSecondaryColor: "#FFD700",
    });
  });

  it("rejects malformed school colors", async () => {
    await expect(createCaller().branding.update({
      schoolName: "Bad Hex High",
      schoolPrimaryColor: "blue",
      schoolSecondaryColor: "#FFD700",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

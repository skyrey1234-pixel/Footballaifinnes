import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { getDb, upsertUser } from "./db";

describe("OAuth user schema compatibility", () => {
  it("upserts and reads a user with the complete current users schema", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();

    const openId = `oauth-schema-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      await expect(
        upsertUser({
          openId,
          name: "OAuth Schema Test",
          email: `${openId}@example.invalid`,
          loginMethod: "test",
          role: "user",
          lastSignedIn: new Date(),
        }),
      ).resolves.toBeUndefined();

      const result = await db!
        .select({
          openId: users.openId,
          role: users.role,
          schoolName: users.schoolName,
          schoolPrimaryColor: users.schoolPrimaryColor,
          schoolSecondaryColor: users.schoolSecondaryColor,
        })
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);

      expect(result).toEqual([
        {
          openId,
          role: "user",
          schoolName: null,
          schoolPrimaryColor: null,
          schoolSecondaryColor: null,
        },
      ]);
    } finally {
      await db!.delete(users).where(eq(users.openId, openId));
    }
  }, 15_000);
});

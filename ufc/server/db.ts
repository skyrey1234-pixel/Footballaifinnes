import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, fightSessions, fightReports, weaponProfiles,
  type InsertFightSession, type InsertFightReport, type InsertWeaponProfile,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== Subscription Helpers =====

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSubscription(userId: number, data: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionTier?: "free" | "cornerman" | "headcoach" | "gym";
  subscriptionStatus?: "active" | "past_due" | "canceled" | "unpaid";
  subscriptionEndsAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserByStripeCustomerId(customerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== Fight Sessions =====

export async function createFightSession(data: InsertFightSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fightSessions).values(data);
  return result[0].insertId;
}

export async function listFightSessions(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select().from(fightSessions).orderBy(desc(fightSessions.createdAt));
  return results;
}

export async function getFightSession(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fightSessions).where(eq(fightSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateFightSessionStatus(id: number, status: "analyzing" | "complete" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(fightSessions).set({ status }).where(eq(fightSessions.id, id));
}

export async function deleteFightSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fightReports).where(eq(fightReports.sessionId, id));
  await db.delete(fightSessions).where(eq(fightSessions.id, id));
}

// ===== Fight Reports =====

export async function createFightReport(data: InsertFightReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fightReports).values(data);
  return result[0].insertId;
}

export async function getReportBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fightReports).where(eq(fightReports.sessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteReportBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fightReports).where(eq(fightReports.sessionId, sessionId));
}

// ===== Division Dashboard Queries =====

export async function getDivisionStats() {
  const db = await getDb();
  if (!db) return { totalFights: 0, completed: 0, fighters: [] };

  const sessions = await db.select().from(fightSessions).orderBy(desc(fightSessions.createdAt));
  const completed = sessions.filter(s => s.status === "complete");

  // Group by fighter
  const fighterMap = new Map<string, { name: string; fights: number; lastScouted: Date }>();
  for (const s of sessions) {
    const existing = fighterMap.get(s.fighterName);
    if (existing) {
      existing.fights++;
      if (s.createdAt > existing.lastScouted) existing.lastScouted = s.createdAt;
    } else {
      fighterMap.set(s.fighterName, { name: s.fighterName, fights: 1, lastScouted: s.createdAt });
    }
  }

  return {
    totalFights: sessions.length,
    completed: completed.length,
    fighters: Array.from(fighterMap.values()),
  };
}

export async function getFighterTrends(fighterName: string) {
  const db = await getDb();
  if (!db) return [];

  const sessions = await db.select().from(fightSessions)
    .where(eq(fightSessions.fighterName, fighterName))
    .orderBy(desc(fightSessions.createdAt));

  const results = [];
  for (const session of sessions) {
    const report = await db.select().from(fightReports).where(eq(fightReports.sessionId, session.id)).limit(1);
    results.push({
      session,
      report: report.length > 0 ? report[0] : null,
    });
  }
  return results;
}

// ===== Weapon Profiles =====

export async function createWeaponProfile(data: InsertWeaponProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weaponProfiles).values(data);
  return result[0].insertId;
}

export async function getWeaponProfilesBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weaponProfiles).where(eq(weaponProfiles.sessionId, sessionId));
}

export async function getWeaponProfilesByFighter(fighterName: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weaponProfiles)
    .where(eq(weaponProfiles.fighterName, fighterName))
    .orderBy(desc(weaponProfiles.createdAt));
}

export async function deleteWeaponProfile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(weaponProfiles).where(eq(weaponProfiles.id, id));
}

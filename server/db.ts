import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, fightSessions, fightBreakdowns, fighterProfiles, type InsertFightSession, type InsertFightBreakdown, type InsertFighterProfile } from "../drizzle/schema";
import { ENV } from './_core/env';

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
      values.role = 'admin';
      updateSet.role = 'admin';
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
  subscriptionTier?: "free" | "scout" | "strategist" | "program";
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
  await db.delete(fightBreakdowns).where(eq(fightBreakdowns.sessionId, id));
  await db.delete(fightSessions).where(eq(fightSessions.id, id));
}

// ===== Fight Breakdowns =====

export async function createFightBreakdown(data: InsertFightBreakdown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fightBreakdowns).values(data);
  return result[0].insertId;
}

export async function getBreakdownBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fightBreakdowns).where(eq(fightBreakdowns.sessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteBreakdownBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fightBreakdowns).where(eq(fightBreakdowns.sessionId, sessionId));
}

// ===== Fight Record Dashboard Queries =====

export async function getRecordStats() {
  const db = await getDb();
  if (!db) return { totalFights: 0, completed: 0, opponents: [] };
  
  const sessions = await db.select().from(fightSessions).orderBy(desc(fightSessions.createdAt));
  const completed = sessions.filter(s => s.status === "complete");
  
  // Group by opponent fighter
  const opponentMap = new Map<string, { name: string; fights: number; lastScouted: Date }>();
  for (const s of sessions) {
    const existing = opponentMap.get(s.opponentFighter);
    if (existing) {
      existing.fights++;
      if (s.createdAt > existing.lastScouted) existing.lastScouted = s.createdAt;
    } else {
      opponentMap.set(s.opponentFighter, { name: s.opponentFighter, fights: 1, lastScouted: s.createdAt });
    }
  }
  
  return {
    totalFights: sessions.length,
    completed: completed.length,
    opponents: Array.from(opponentMap.values()),
  };
}

export async function getOpponentTrends(opponentFighter: string) {
  const db = await getDb();
  if (!db) return [];
  
  const sessions = await db.select().from(fightSessions)
    .where(eq(fightSessions.opponentFighter, opponentFighter))
    .orderBy(desc(fightSessions.createdAt));
  
  const results = [];
  for (const session of sessions) {
    const breakdown = await db.select().from(fightBreakdowns).where(eq(fightBreakdowns.sessionId, session.id)).limit(1);
    results.push({
      session,
      breakdown: breakdown.length > 0 ? breakdown[0] : null,
    });
  }
  return results;
}

// ===== Fighter Profiles =====

export async function createFighterProfile(data: InsertFighterProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fighterProfiles).values(data);
  return result[0].insertId;
}

export async function getFighterProfilesBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fighterProfiles).where(eq(fighterProfiles.sessionId, sessionId));
}

export async function getFighterProfilesByOpponent(opponentFighter: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(fighterProfiles)
    .where(eq(fighterProfiles.opponentFighter, opponentFighter))
    .orderBy(desc(fighterProfiles.createdAt));
}

export async function deleteFighterProfile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(fighterProfiles).where(eq(fighterProfiles.id, id));
}

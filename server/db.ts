import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, gameSessions, scoutingReports, type InsertGameSession, type InsertScoutingReport } from "../drizzle/schema";
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

// ===== Game Sessions =====

export async function createGameSession(data: InsertGameSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(gameSessions).values(data);
  return result[0].insertId;
}

export async function listGameSessions(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select().from(gameSessions).orderBy(desc(gameSessions.createdAt));
  return results;
}

export async function getGameSession(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateGameSessionStatus(id: number, status: "analyzing" | "complete" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(gameSessions).set({ status }).where(eq(gameSessions.id, id));
}

export async function deleteGameSession(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(scoutingReports).where(eq(scoutingReports.sessionId, id));
  await db.delete(gameSessions).where(eq(gameSessions.id, id));
}

// ===== Scouting Reports =====

export async function createScoutingReport(data: InsertScoutingReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scoutingReports).values(data);
  return result[0].insertId;
}

export async function getReportBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scoutingReports).where(eq(scoutingReports.sessionId, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

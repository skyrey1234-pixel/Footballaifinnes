import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, gameSessions, scoutingReports, playerProfiles, type InsertGameSession, type InsertScoutingReport, type InsertPlayerProfile } from "../drizzle/schema";
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

// ===== Season Dashboard Queries =====

export async function getSeasonStats() {
  const db = await getDb();
  if (!db) return { totalGames: 0, completed: 0, opponents: [] };
  
  const sessions = await db.select().from(gameSessions).orderBy(desc(gameSessions.createdAt));
  const completed = sessions.filter(s => s.status === "complete");
  
  // Group by opponent
  const opponentMap = new Map<string, { name: string; games: number; lastScouted: Date }>();
  for (const s of sessions) {
    const existing = opponentMap.get(s.opponentName);
    if (existing) {
      existing.games++;
      if (s.createdAt > existing.lastScouted) existing.lastScouted = s.createdAt;
    } else {
      opponentMap.set(s.opponentName, { name: s.opponentName, games: 1, lastScouted: s.createdAt });
    }
  }
  
  return {
    totalGames: sessions.length,
    completed: completed.length,
    opponents: Array.from(opponentMap.values()),
  };
}

export async function getOpponentTrends(opponentName: string) {
  const db = await getDb();
  if (!db) return [];
  
  const sessions = await db.select().from(gameSessions)
    .where(eq(gameSessions.opponentName, opponentName))
    .orderBy(desc(gameSessions.createdAt));
  
  const results = [];
  for (const session of sessions) {
    const report = await db.select().from(scoutingReports).where(eq(scoutingReports.sessionId, session.id)).limit(1);
    results.push({
      session,
      report: report.length > 0 ? report[0] : null,
    });
  }
  return results;
}

// ===== Player Profiles =====

export async function createPlayerProfile(data: InsertPlayerProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(playerProfiles).values(data);
  return result[0].insertId;
}

export async function getPlayerProfilesBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(playerProfiles).where(eq(playerProfiles.sessionId, sessionId));
}

export async function getPlayerProfilesByOpponent(opponentName: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(playerProfiles)
    .where(eq(playerProfiles.opponentName, opponentName))
    .orderBy(desc(playerProfiles.createdAt));
}

export async function deletePlayerProfile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(playerProfiles).where(eq(playerProfiles.id, id));
}

import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, gameSessions, scoutingReports, playerProfiles, mistakeAnalyses, highlightReels, formationAnalytics, presnapsReads, turnoverPredictors, type InsertGameSession, type InsertScoutingReport, type InsertPlayerProfile } from "../drizzle/schema";
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

/** Persist the real analysis pipeline stage so the client progress bar reflects actual work. */
export async function setAnalysisStage(id: number, stage: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(gameSessions).set({ analysisStage: stage }).where(eq(gameSessions.id, id));
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

export async function deleteReportBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(scoutingReports).where(eq(scoutingReports.sessionId, sessionId));
}

// ===== Mistake Analyses =====
export async function saveMistakeAnalysis(sessionId: number, plays: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mistakeAnalyses).where(eq(mistakeAnalyses.sessionId, sessionId));
  await db.insert(mistakeAnalyses).values({ sessionId, plays });
}

export async function getMistakeAnalysisBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(mistakeAnalyses).where(eq(mistakeAnalyses.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteMistakeAnalysisBySession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mistakeAnalyses).where(eq(mistakeAnalyses.sessionId, sessionId));
}

// ===== Highlight Reels =====
export async function saveHighlightReel(sessionId: number, clips: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(highlightReels).where(eq(highlightReels.sessionId, sessionId));
  await db.insert(highlightReels).values({ sessionId, clips });
}

export async function getHighlightReelBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(highlightReels).where(eq(highlightReels.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteHighlightReelBySession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(highlightReels).where(eq(highlightReels.sessionId, sessionId));
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

// ===== WAVE 1: Advanced Video Analytics =====

// ===== Formation Analytics =====
export async function saveFormationAnalytics(sessionId: number, data: {
  formations?: unknown;
  offensiveFormations?: unknown;
  defensiveFormations?: unknown;
  predictions?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(formationAnalytics).where(eq(formationAnalytics.sessionId, sessionId));
  await db.insert(formationAnalytics).values({ sessionId, ...data });
}

export async function getFormationAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(formationAnalytics).where(eq(formationAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteFormationAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(formationAnalytics).where(eq(formationAnalytics.sessionId, sessionId));
}

// ===== Pre-Snap Reads =====
export async function savePreSnapReads(sessionId: number, data: {
  reads?: unknown;
  coverageTypes?: unknown;
  blitzTendencies?: unknown;
  drilQuestions?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(presnapsReads).where(eq(presnapsReads.sessionId, sessionId));
  await db.insert(presnapsReads).values({ sessionId, ...data });
}

export async function getPreSnapReadsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(presnapsReads).where(eq(presnapsReads.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function deletePreSnapReadsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(presnapsReads).where(eq(presnapsReads.sessionId, sessionId));
}

// ===== Turnover Predictors =====
export async function saveTurnoverPredictors(sessionId: number, data: {
  plays?: unknown;
  riskSummary?: unknown;
  historicalData?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(turnoverPredictors).where(eq(turnoverPredictors.sessionId, sessionId));
  await db.insert(turnoverPredictors).values({ sessionId, ...data });
}

export async function getTurnoverPredictorsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(turnoverPredictors).where(eq(turnoverPredictors.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteTurnoverPredictorsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(turnoverPredictors).where(eq(turnoverPredictors.sessionId, sessionId));
}

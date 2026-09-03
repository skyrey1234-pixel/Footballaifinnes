import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, gameSessions, scoutingReports, playerProfiles, mistakeAnalyses, highlightReels, formationAnalytics, presnapsReads, turnoverPredictors, heatMapAnalytics, routeTreeAnalytics, blockingAnalytics, momentumAnalytics, gapAnalytics, injuryImpactAnalytics, penaltyAnalytics, redZoneAnalytics, thirdDownAnalytics, twoMinuteAnalytics, situationalAnalytics, playerComparisons, liveGameSessions, liveAnalysisEvents, advancedAnalyticsRuns, type InsertGameSession, type InsertScoutingReport, type InsertPlayerProfile, type InsertLiveGameSession, type InsertLiveAnalysisEvent, type InsertAdvancedAnalyticsRun } from "../drizzle/schema";
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
  const analyticsTables = [
    advancedAnalyticsRuns, formationAnalytics, presnapsReads, turnoverPredictors,
    heatMapAnalytics, routeTreeAnalytics, blockingAnalytics, momentumAnalytics,
    gapAnalytics, injuryImpactAnalytics, penaltyAnalytics, redZoneAnalytics,
    thirdDownAnalytics, twoMinuteAnalytics, situationalAnalytics, playerComparisons,
  ] as const;
  for (const table of analyticsTables) {
    await db.delete(table).where(eq(table.sessionId, id));
  }
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

// ===== WAVE 2: Heat Map Analytics =====
export async function saveHeatMapAnalytics(sessionId: number, data: { preSnapHeatMaps?: unknown; routeHeatMaps?: unknown; alignmentTendencies?: unknown; motionTracking?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(heatMapAnalytics).where(eq(heatMapAnalytics.sessionId, sessionId));
  await db.insert(heatMapAnalytics).values({ sessionId, ...data });
}
export async function getHeatMapAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(heatMapAnalytics).where(eq(heatMapAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 2: Route Tree Analytics =====
export async function saveRouteTreeAnalytics(sessionId: number, data: { routes?: unknown; timingAnalysis?: unknown; effectivenessRatings?: unknown; routeTree?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(routeTreeAnalytics).where(eq(routeTreeAnalytics.sessionId, sessionId));
  await db.insert(routeTreeAnalytics).values({ sessionId, ...data });
}
export async function getRouteTreeAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(routeTreeAnalytics).where(eq(routeTreeAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 2: Blocking Analytics =====
export async function saveBlockingAnalytics(sessionId: number, data: { grades?: unknown; schemeConsistency?: unknown; pressureAllowed?: unknown; runFitAnalysis?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blockingAnalytics).where(eq(blockingAnalytics.sessionId, sessionId));
  await db.insert(blockingAnalytics).values({ sessionId, ...data });
}
export async function getBlockingAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(blockingAnalytics).where(eq(blockingAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 2: Momentum Analytics =====
export async function saveMomentumAnalytics(sessionId: number, data: { momentumGraph?: unknown; swingMoments?: unknown; emotionalIndicators?: unknown; comebackAnalysis?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(momentumAnalytics).where(eq(momentumAnalytics.sessionId, sessionId));
  await db.insert(momentumAnalytics).values({ sessionId, ...data });
}
export async function getMomentumAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(momentumAnalytics).where(eq(momentumAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Gap Analytics =====
export async function saveGapAnalytics(sessionId: number, data: { gapAssignments?: unknown; blitzPackages?: unknown; runFitBreakdowns?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(gapAnalytics).where(eq(gapAnalytics.sessionId, sessionId));
  await db.insert(gapAnalytics).values({ sessionId, ...data });
}
export async function getGapAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(gapAnalytics).where(eq(gapAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Injury Impact Analytics =====
export async function saveInjuryImpactAnalytics(sessionId: number, data: { keyPlayers?: unknown; vulnerabilityWindows?: unknown; depthChart?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(injuryImpactAnalytics).where(eq(injuryImpactAnalytics.sessionId, sessionId));
  await db.insert(injuryImpactAnalytics).values({ sessionId, ...data });
}
export async function getInjuryImpactAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(injuryImpactAnalytics).where(eq(injuryImpactAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Penalty Analytics =====
export async function savePenaltyAnalytics(sessionId: number, data: { penalties?: unknown; patterns?: unknown; costAnalysis?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(penaltyAnalytics).where(eq(penaltyAnalytics.sessionId, sessionId));
  await db.insert(penaltyAnalytics).values({ sessionId, ...data });
}
export async function getPenaltyAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(penaltyAnalytics).where(eq(penaltyAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Red Zone Analytics =====
export async function saveRedZoneAnalytics(sessionId: number, data: { efficiency?: unknown; goalLine?: unknown; tendencies?: unknown; scoringBreakdown?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(redZoneAnalytics).where(eq(redZoneAnalytics.sessionId, sessionId));
  await db.insert(redZoneAnalytics).values({ sessionId, ...data });
}
export async function getRedZoneAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(redZoneAnalytics).where(eq(redZoneAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Third Down Analytics =====
export async function saveThirdDownAnalytics(sessionId: number, data: { conversionRate?: unknown; byDistance?: unknown; playCallingPatterns?: unknown; defensiveTendencies?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(thirdDownAnalytics).where(eq(thirdDownAnalytics.sessionId, sessionId));
  await db.insert(thirdDownAnalytics).values({ sessionId, ...data });
}
export async function getThirdDownAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(thirdDownAnalytics).where(eq(thirdDownAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Two-Minute Drill Analytics =====
export async function saveTwoMinuteAnalytics(sessionId: number, data: { drillEfficiency?: unknown; playSelection?: unknown; timeoutManagement?: unknown; clutchPerformance?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(twoMinuteAnalytics).where(eq(twoMinuteAnalytics.sessionId, sessionId));
  await db.insert(twoMinuteAnalytics).values({ sessionId, ...data });
}
export async function getTwoMinuteAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(twoMinuteAnalytics).where(eq(twoMinuteAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Situational Analytics =====
export async function saveSituationalAnalytics(sessionId: number, data: { downAndDistance?: unknown; scoreDifferential?: unknown; fieldPosition?: unknown; timeRemaining?: unknown; predictiveModel?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(situationalAnalytics).where(eq(situationalAnalytics.sessionId, sessionId));
  await db.insert(situationalAnalytics).values({ sessionId, ...data });
}
export async function getSituationalAnalyticsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(situationalAnalytics).where(eq(situationalAnalytics.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== WAVE 3: Player Comparisons =====
export async function savePlayerComparisons(sessionId: number, data: { comparisons?: unknown; matchupAdvantages?: unknown; overallAssessment?: unknown; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(playerComparisons).where(eq(playerComparisons.sessionId, sessionId));
  await db.insert(playerComparisons).values({ sessionId, ...data });
}
export async function getPlayerComparisonsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(playerComparisons).where(eq(playerComparisons.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}

// ===== Live Game Intelligence =====

export async function createLiveGameSession(data: InsertLiveGameSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(liveGameSessions).values(data);
  return result[0].insertId;
}

export async function listLiveGameSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(liveGameSessions)
    .where(eq(liveGameSessions.userId, userId))
    .orderBy(desc(liveGameSessions.createdAt));
}

export async function getLiveGameSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(liveGameSessions)
    .where(sql`${liveGameSessions.id} = ${id} AND ${liveGameSessions.userId} = ${userId}`)
    .limit(1);
  return rows[0];
}

export async function updateLiveGameSession(
  id: number,
  userId: number,
  data: Partial<Pick<InsertLiveGameSession, "status" | "currentVideoSecond" | "situation" | "latestSummary" | "errorMessage" | "startedAt" | "endedAt">>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(liveGameSessions)
    .set(data)
    .where(sql`${liveGameSessions.id} = ${id} AND ${liveGameSessions.userId} = ${userId}`);
}

export async function deleteLiveGameSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(liveAnalysisEvents)
    .where(sql`${liveAnalysisEvents.liveSessionId} = ${id} AND ${liveAnalysisEvents.userId} = ${userId}`);
  await db
    .delete(liveGameSessions)
    .where(sql`${liveGameSessions.id} = ${id} AND ${liveGameSessions.userId} = ${userId}`);
}

export async function listLiveAnalysisEvents(liveSessionId: number, userId: number, limit = 120) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(liveAnalysisEvents)
    .where(sql`${liveAnalysisEvents.liveSessionId} = ${liveSessionId} AND ${liveAnalysisEvents.userId} = ${userId}`)
    .orderBy(desc(liveAnalysisEvents.windowIndex))
    .limit(Math.max(1, Math.min(limit, 300)));
}

export async function getLiveAnalysisEventByWindow(liveSessionId: number, userId: number, windowIndex: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(liveAnalysisEvents)
    .where(sql`${liveAnalysisEvents.liveSessionId} = ${liveSessionId} AND ${liveAnalysisEvents.userId} = ${userId} AND ${liveAnalysisEvents.windowIndex} = ${windowIndex}`)
    .limit(1);
  return rows[0];
}

export async function saveLiveAnalysisEvent(data: InsertLiveAnalysisEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(liveAnalysisEvents).values(data).onDuplicateKeyUpdate({
    set: {
      windowStartSeconds: data.windowStartSeconds,
      windowEndSeconds: data.windowEndSeconds,
      visibleAction: data.visibleAction,
      formation: data.formation,
      personnel: data.personnel,
      defensiveLook: data.defensiveLook,
      playCall: data.playCall,
      predictionSummary: data.predictionSummary,
      nextPlayProbabilities: data.nextPlayProbabilities,
      tendencyShift: data.tendencyShift,
      counterCall: data.counterCall,
      riskLevel: data.riskLevel,
      alerts: data.alerts,
      evidence: data.evidence,
      confidence: data.confidence,
      inputFrameCount: data.inputFrameCount,
    },
  });
}

export async function saveAdvancedAnalyticsRun(data: InsertAdvancedAnalyticsRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(advancedAnalyticsRuns).values(data).onDuplicateKeyUpdate({
    set: {
      status: data.status,
      summary: data.summary,
      confidence: data.confidence,
      dataBasis: data.dataBasis,
      evidence: data.evidence,
      missingInputs: data.missingInputs,
      limitations: data.limitations,
      coachVerified: data.coachVerified,
      updatedAt: new Date(),
    },
  });
}

export async function listAdvancedAnalyticsRuns(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(advancedAnalyticsRuns)
    .where(sql`${advancedAnalyticsRuns.sessionId} = ${sessionId} AND ${advancedAnalyticsRuns.userId} = ${userId}`)
    .orderBy(desc(advancedAnalyticsRuns.updatedAt));
}

export async function getAdvancedAnalyticsRun(sessionId: number, userId: number, module: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(advancedAnalyticsRuns)
    .where(sql`${advancedAnalyticsRuns.sessionId} = ${sessionId} AND ${advancedAnalyticsRuns.userId} = ${userId} AND ${advancedAnalyticsRuns.module} = ${module}`)
    .limit(1);
  return rows[0];
}

export async function setAdvancedAnalyticsCoachVerified(sessionId: number, userId: number, module: string, verified: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(advancedAnalyticsRuns)
    .set({ coachVerified: verified ? 1 : 0, updatedAt: new Date() })
    .where(sql`${advancedAnalyticsRuns.sessionId} = ${sessionId} AND ${advancedAnalyticsRuns.userId} = ${userId} AND ${advancedAnalyticsRuns.module} = ${module}`);
}

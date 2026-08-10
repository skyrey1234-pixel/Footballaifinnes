import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "scout", "strategist", "program"]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "past_due", "canceled", "unpaid"]).default("active"),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Game sessions table
export const gameSessions = mysqlTable("game_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  opponentName: varchar("opponentName", { length: 255 }).notNull(),
  gameDate: varchar("gameDate", { length: 32 }),
  sourceType: mysqlEnum("sourceType", ["youtube", "upload"]).notNull(),
  youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
  videoUrl: text("videoUrl"),
  videoFileKey: text("videoFileKey"),
  status: mysqlEnum("status", ["analyzing", "complete", "failed"]).default("analyzing").notNull(),
  /** Real backend analysis progress stage, written by the pipeline as it advances. */
  analysisStage: varchar("analysisStage", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GameSession = typeof gameSessions.$inferSelect;
export type InsertGameSession = typeof gameSessions.$inferInsert;

// Scouting reports table
export const scoutingReports = mysqlTable("scouting_reports", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  executiveSummary: text("executiveSummary"),
  offenseAnalysis: text("offenseAnalysis"),
  defenseAnalysis: text("defenseAnalysis"),
  specialSituations: text("specialSituations"),
  mistakes: text("mistakes"),
  predictions: text("predictions"),
  highlights: json("highlights"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScoutingReport = typeof scoutingReports.$inferSelect;
export type InsertScoutingReport = typeof scoutingReports.$inferInsert;

// Player tendency profiles table
export const playerProfiles = mysqlTable("player_profiles", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  opponentName: varchar("opponentName", { length: 255 }).notNull(),
  playerNumber: varchar("playerNumber", { length: 10 }).notNull(),
  playerName: varchar("playerName", { length: 255 }),
  position: varchar("position", { length: 64 }),
  tendencies: json("tendencies"), // Array of tendency objects
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  threatLevel: mysqlEnum("threatLevel", ["low", "medium", "high", "elite"]).default("medium").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type InsertPlayerProfile = typeof playerProfiles.$inferInsert;

// Mistake analyses table — AI-generated correct-vs-actual play breakdowns
export const mistakeAnalyses = mysqlTable("mistake_analyses", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  plays: json("plays"), // Array of mistake play objects
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MistakeAnalysis = typeof mistakeAnalyses.$inferSelect;

// Highlight reels table — AI-ranked best plays from game film
export const highlightReels = mysqlTable("highlight_reels", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  clips: json("clips"), // Array of ranked clip objects
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HighlightReel = typeof highlightReels.$inferSelect;

// ============ ADVANCED VIDEO ANALYTICS TABLES ============

// Formation Recognition Analytics
export const formationAnalytics = mysqlTable("formation_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  formations: json("formations"), // Array of { formation, frequency, successRate, playTypes }
  offensiveFormations: json("offensiveFormations"), // { Shotgun, IForm, Pistol, Spread, Empty, etc. }
  defensiveFormations: json("defensiveFormations"), // { 43, 34, Nickel, Dime, Cover2, Cover3, etc. }
  predictions: json("predictions"), // { situationKey: { formation, confidence, predictedPlay } }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FormationAnalytic = typeof formationAnalytics.$inferSelect;

// Pre-Snap Reads & Coverage Recognition
export const presnapsReads = mysqlTable("presnap_reads", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  reads: json("reads"), // Array of { playId, coverage, blitzPackage, hotRoute, qbProgression, difficulty }
  coverageTypes: json("coverageTypes"), // { Cover2, Cover3, Man, TwoDeep, etc. } with frequency
  blitzTendencies: json("blitzTendencies"), // { blitzType, frequency, effectiveness }
  drilQuestions: json("drilQuestions"), // Array of { scenario, correctAnswer, explanation }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PreSnapRead = typeof presnapsReads.$inferSelect;

// Turnover Predictor Analytics
export const turnoverPredictors = mysqlTable("turnover_predictors", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  plays: json("plays"), // Array of { playId, interceptionRisk, fumbleRisk, sackVulnerability, pressurePoints, recommendation }
  riskSummary: json("riskSummary"), // { avgInterceptionRisk, avgFumbleRisk, avgSackVulnerability, highRiskPlays }
  historicalData: json("historicalData"), // { playType: { successRate, turnoverRate, lastOccurrence } }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TurnoverPredictor = typeof turnoverPredictors.$inferSelect;

// ============ WAVE 2: VISUAL INTELLIGENCE ============

// Player Heat Maps & Positioning Analytics
export const heatMapAnalytics = mysqlTable("heat_map_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  preSnapHeatMaps: json("preSnapHeatMaps"), // { position: { zones: [{x,y,frequency}] } }
  routeHeatMaps: json("routeHeatMaps"), // { player: { routes: [{path,frequency}] } }
  alignmentTendencies: json("alignmentTendencies"), // { player: { avgDepth, avgWidth, tendencyNote } }
  motionTracking: json("motionTracking"), // { presnap: [], postsnap: [] }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HeatMapAnalytic = typeof heatMapAnalytics.$inferSelect;

// Route Tree Analyzer
export const routeTreeAnalytics = mysqlTable("route_tree_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  routes: json("routes"), // Array of { receiver, routeType, frequency, avgSeparation, catchRate, avgYAC }
  timingAnalysis: json("timingAnalysis"), // { route: { avgBreakTime, avgThrowWindow } }
  effectivenessRatings: json("effectivenessRatings"), // { route: { successRate, ypa, bigPlayRate } }
  routeTree: json("routeTree"), // Full route tree visualization data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RouteTreeAnalytic = typeof routeTreeAnalytics.$inferSelect;

// Blocking Assignment Tracker
export const blockingAnalytics = mysqlTable("blocking_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  grades: json("grades"), // { player: { passBlock, runBlock, overall, pancakes, sacks } }
  schemeConsistency: json("schemeConsistency"), // { scheme: { executionRate, breakdowns } }
  pressureAllowed: json("pressureAllowed"), // { player: { pressures, hurries, knockdowns } }
  runFitAnalysis: json("runFitAnalysis"), // { gapAssignment: { successRate, yardsCreated } }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BlockingAnalytic = typeof blockingAnalytics.$inferSelect;

// Momentum & Game Flow Analytics
export const momentumAnalytics = mysqlTable("momentum_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  momentumGraph: json("momentumGraph"), // Array of { play, momentum (-100 to 100), event }
  swingMoments: json("swingMoments"), // Array of { play, trigger, impact, description }
  emotionalIndicators: json("emotionalIndicators"), // { confidence, frustration, fatigue per quarter }
  comebackAnalysis: json("comebackAnalysis"), // { probability, keyFactors, historicalComps }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MomentumAnalytic = typeof momentumAnalytics.$inferSelect;

// ============ WAVE 3: SITUATIONAL MASTERY ============

// Defensive Gap Assignment Analyzer
export const gapAnalytics = mysqlTable("gap_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  gapAssignments: json("gapAssignments"), // { gap: { assignedPlayer, fillRate, yardsAllowed } }
  blitzPackages: json("blitzPackages"), // { package: { frequency, pressureRate, coverage } }
  runFitBreakdowns: json("runFitBreakdowns"), // Array of { play, gap, breakdown, yardage }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type GapAnalytic = typeof gapAnalytics.$inferSelect;

// Injury Impact Analyzer
export const injuryImpactAnalytics = mysqlTable("injury_impact_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  keyPlayers: json("keyPlayers"), // Array of { player, position, impactScore, replacement, performanceDrop }
  vulnerabilityWindows: json("vulnerabilityWindows"), // { scenario: { impact, adjustment } }
  depthChart: json("depthChart"), // { position: { starter, backup, dropOff } }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InjuryImpactAnalytic = typeof injuryImpactAnalytics.$inferSelect;

// Penalty Pattern Analyzer
export const penaltyAnalytics = mysqlTable("penalty_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  penalties: json("penalties"), // Array of { type, player, quarter, yardage, situation }
  patterns: json("patterns"), // { type: { frequency, situations, players } }
  costAnalysis: json("costAnalysis"), // { totalYards, driveKillers, scoringImpact }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PenaltyAnalytic = typeof penaltyAnalytics.$inferSelect;

// Red Zone & Goal Line Efficiency
export const redZoneAnalytics = mysqlTable("red_zone_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  efficiency: json("efficiency"), // { attempts, touchdowns, fieldGoals, turnovers, rate }
  goalLine: json("goalLine"), // { attempts, conversions, playTypes, successByFormation }
  tendencies: json("tendencies"), // { run vs pass, formation preferences, personnel }
  scoringBreakdown: json("scoringBreakdown"), // { method: count }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RedZoneAnalytic = typeof redZoneAnalytics.$inferSelect;

// Third-Down Efficiency & Conversion
export const thirdDownAnalytics = mysqlTable("third_down_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  conversionRate: json("conversionRate"), // { overall, short, medium, long }
  byDistance: json("byDistance"), // { '1-3': {attempts,conversions}, '4-6': {...}, '7+': {...} }
  playCallingPatterns: json("playCallingPatterns"), // { run, pass, screen, draw by distance }
  defensiveTendencies: json("defensiveTendencies"), // { blitz, zone, man by distance }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ThirdDownAnalytic = typeof thirdDownAnalytics.$inferSelect;

// Two-Minute Drill & Clutch Situations
export const twoMinuteAnalytics = mysqlTable("two_minute_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  drillEfficiency: json("drillEfficiency"), // { attempts, scores, avgTimeUsed, avgPlays }
  playSelection: json("playSelection"), // { hurryUp: {run,pass,screen}, normal: {run,pass} }
  timeoutManagement: json("timeoutManagement"), // { optimal, wasted, impactful }
  clutchPerformance: json("clutchPerformance"), // { qbRating, completionPct, bigPlays }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TwoMinuteAnalytic = typeof twoMinuteAnalytics.$inferSelect;

// Situational Football Analyzer
export const situationalAnalytics = mysqlTable("situational_analytics", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  downAndDistance: json("downAndDistance"), // { '1st-10': {run%,pass%,success%}, ... }
  scoreDifferential: json("scoreDifferential"), // { ahead: {tendencies}, behind: {tendencies} }
  fieldPosition: json("fieldPosition"), // { ownTerritory: {}, midfield: {}, opponent: {} }
  timeRemaining: json("timeRemaining"), // { early: {}, middle: {}, late: {} }
  predictiveModel: json("predictiveModel"), // { situation: { likelyPlay, confidence } }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SituationalAnalytic = typeof situationalAnalytics.$inferSelect;

// Player Comparison Tool
export const playerComparisons = mysqlTable("player_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  comparisons: json("comparisons"), // Array of { ourPlayer, theirPlayer, position, metrics, advantage }
  matchupAdvantages: json("matchupAdvantages"), // { matchup: { advantage, exploitStrategy } }
  overallAssessment: json("overallAssessment"), // { teamStrength, weaknesses, keyMatchups }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PlayerComparison = typeof playerComparisons.$inferSelect;

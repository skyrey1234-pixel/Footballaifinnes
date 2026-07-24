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

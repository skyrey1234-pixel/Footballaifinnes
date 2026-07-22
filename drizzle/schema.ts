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

// Fight sessions table — each session scouts one opponent fighter's tape
export const fightSessions = mysqlTable("fight_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  opponentFighter: varchar("opponentFighter", { length: 255 }).notNull(),
  fightDate: varchar("fightDate", { length: 32 }),
  sourceType: mysqlEnum("sourceType", ["youtube", "upload"]).notNull(),
  youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
  videoUrl: text("videoUrl"),
  videoFileKey: text("videoFileKey"),
  status: mysqlEnum("status", ["analyzing", "complete", "failed"]).default("analyzing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FightSession = typeof fightSessions.$inferSelect;
export type InsertFightSession = typeof fightSessions.$inferInsert;

// Fight breakdowns table — AI-generated tactical breakdown of the opponent
export const fightBreakdowns = mysqlTable("fight_breakdowns", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  executiveSummary: text("executiveSummary"),
  strikingAnalysis: text("strikingAnalysis"),
  grapplingAnalysis: text("grapplingAnalysis"),
  clinchCageAnalysis: text("clinchCageAnalysis"),
  weaknesses: text("weaknesses"),
  finishingThreats: text("finishingThreats"),
  highlights: json("highlights"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FightBreakdown = typeof fightBreakdowns.$inferSelect;
export type InsertFightBreakdown = typeof fightBreakdowns.$inferInsert;

// Fighter tendency profiles table — distinct scouting profiles per fighter/look
export const fighterProfiles = mysqlTable("fighter_profiles", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  opponentFighter: varchar("opponentFighter", { length: 255 }).notNull(),
  fighterTag: varchar("fighterTag", { length: 24 }).notNull(),
  fighterName: varchar("fighterName", { length: 255 }),
  stanceStyle: varchar("stanceStyle", { length: 96 }),
  tendencies: json("tendencies"), // Array of tendency objects
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  threatLevel: mysqlEnum("threatLevel", ["low", "medium", "high", "elite"]).default("medium").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FighterProfile = typeof fighterProfiles.$inferSelect;
export type InsertFighterProfile = typeof fighterProfiles.$inferInsert;

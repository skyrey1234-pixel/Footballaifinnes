import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * OctagonIQ — UFC / MMA fight-scouting data model.
 *
 * This mirrors the football "TacticalEdge" schema one-for-one, but every table
 * is re-cast for mixed martial arts:
 *   gameSessions   -> fightSessions   (film of an opponent fighter)
 *   scoutingReports -> fightReports   (striking / grappling / clinch / gameplan)
 *   playerProfiles -> weaponProfiles  (a fighter's signature techniques)
 *
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
  subscriptionTier: mysqlEnum("subscriptionTier", ["free", "cornerman", "headcoach", "gym"]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "past_due", "canceled", "unpaid"]).default("active"),
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Fight sessions table — one row per opponent breakdown (a fight or film study).
export const fightSessions = mysqlTable("fight_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fighterName: varchar("fighterName", { length: 255 }).notNull(),
  division: varchar("division", { length: 64 }), // weight class, e.g. "Lightweight"
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

// Fight scouting reports table.
export const fightReports = mysqlTable("fight_reports", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  executiveSummary: text("executiveSummary"),
  strikingAnalysis: text("strikingAnalysis"),       // stand-up: boxing, kicks, range, output
  grapplingAnalysis: text("grapplingAnalysis"),     // wrestling, takedowns, BJJ, ground control
  clinchAndCage: text("clinchAndCage"),             // clinch work, cage control, championship rounds
  vulnerabilities: text("vulnerabilities"),         // defensive holes and exploitable habits
  gamePlan: text("gamePlan"),                        // how to beat them / what they'll likely do
  highlights: json("highlights"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FightReport = typeof fightReports.$inferSelect;
export type InsertFightReport = typeof fightReports.$inferInsert;

// Signature-weapon tendency profiles table — the fighter's key techniques.
export const weaponProfiles = mysqlTable("weapon_profiles", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  fighterName: varchar("fighterName", { length: 255 }).notNull(),
  weaponName: varchar("weaponName", { length: 255 }).notNull(), // e.g. "Left High Kick"
  technique: varchar("technique", { length: 64 }),               // Striking | Wrestling | BJJ | Clinch | Defense
  tendencies: json("tendencies"), // Array of tendency objects
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  threatLevel: mysqlEnum("threatLevel", ["low", "medium", "high", "elite"]).default("medium").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeaponProfile = typeof weaponProfiles.$inferSelect;
export type InsertWeaponProfile = typeof weaponProfiles.$inferInsert;

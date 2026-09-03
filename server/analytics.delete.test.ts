import { afterEach, describe, expect, it } from "vitest";
import * as db from "./db";

describe("advanced analytics session cleanup", () => {
  let sessionId = 0;
  afterEach(async () => { if (sessionId) await db.deleteGameSession(sessionId).catch(() => {}); });

  it("removes every module row and evidence record with the parent session", async () => {
    sessionId = await db.createGameSession({ userId: 1, opponentName: "Analytics cleanup test", gameDate: null, sourceType: "upload", youtubeVideoId: null, videoFileKey: null, videoUrl: null, status: "complete" });
    await Promise.all([
      db.saveFormationAnalytics(sessionId, {}), db.savePreSnapReads(sessionId, {}), db.saveTurnoverPredictors(sessionId, {}),
      db.saveHeatMapAnalytics(sessionId, {}), db.saveRouteTreeAnalytics(sessionId, {}), db.saveBlockingAnalytics(sessionId, {}),
      db.saveMomentumAnalytics(sessionId, {}), db.saveGapAnalytics(sessionId, {}), db.saveInjuryImpactAnalytics(sessionId, {}),
      db.savePenaltyAnalytics(sessionId, {}), db.saveRedZoneAnalytics(sessionId, {}), db.saveThirdDownAnalytics(sessionId, {}),
      db.saveTwoMinuteAnalytics(sessionId, {}), db.saveSituationalAnalytics(sessionId, {}), db.savePlayerComparisons(sessionId, {}),
      db.saveAdvancedAnalyticsRun({ sessionId, userId: 1, module: "formations", status: "ready", summary: "test", confidence: 50, dataBasis: "test", evidence: [], missingInputs: [], limitations: [], coachVerified: 0 }),
    ]);
    await db.deleteGameSession(sessionId);
    const moduleRows = await Promise.all([
      db.getFormationAnalyticsBySession(sessionId), db.getPreSnapReadsBySession(sessionId), db.getTurnoverPredictorsBySession(sessionId),
      db.getHeatMapAnalyticsBySession(sessionId), db.getRouteTreeAnalyticsBySession(sessionId), db.getBlockingAnalyticsBySession(sessionId),
      db.getMomentumAnalyticsBySession(sessionId), db.getGapAnalyticsBySession(sessionId), db.getInjuryImpactAnalyticsBySession(sessionId),
      db.getPenaltyAnalyticsBySession(sessionId), db.getRedZoneAnalyticsBySession(sessionId), db.getThirdDownAnalyticsBySession(sessionId),
      db.getTwoMinuteAnalyticsBySession(sessionId), db.getSituationalAnalyticsBySession(sessionId), db.getPlayerComparisonsBySession(sessionId),
    ]);
    expect(moduleRows.every((row) => row == null)).toBe(true);
    expect(await db.listAdvancedAnalyticsRuns(sessionId, 1)).toEqual([]);
    sessionId = 0;
  });
});

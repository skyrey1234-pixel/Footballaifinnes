import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getGameSession, getReportBySessionId,
  saveHeatMapAnalytics, getHeatMapAnalyticsBySession,
  saveRouteTreeAnalytics, getRouteTreeAnalyticsBySession,
  saveBlockingAnalytics, getBlockingAnalyticsBySession,
  saveMomentumAnalytics, getMomentumAnalyticsBySession,
  saveGapAnalytics, getGapAnalyticsBySession,
  saveInjuryImpactAnalytics, getInjuryImpactAnalyticsBySession,
  savePenaltyAnalytics, getPenaltyAnalyticsBySession,
  saveRedZoneAnalytics, getRedZoneAnalyticsBySession,
  saveThirdDownAnalytics, getThirdDownAnalyticsBySession,
  saveTwoMinuteAnalytics, getTwoMinuteAnalyticsBySession,
  saveSituationalAnalytics, getSituationalAnalyticsBySession,
  savePlayerComparisons, getPlayerComparisonsBySession,
} from "./db";
import { persistAnalyticsQuality, runGuardedAnalytics, type AdvancedAnalyticsModule } from "./analyticsCore";

async function getOwnedReport(sessionId: number, userId: number) {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.userId !== userId) throw new Error("Unauthorized");
  const report = await getReportBySessionId(sessionId);
  if (!report) throw new Error("Scouting report not found");
  return report;
}

type SaveFn = (sessionId: number, data: any) => Promise<void>;

function analyzeModule(module: AdvancedAnalyticsModule, instructions: string, save: SaveFn, fields: string[], requiredExternalInputs: string[] = []) {
  return protectedProcedure
    .input(z.object({ sessionId: z.number(), context: z.string().max(20_000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedReport(input.sessionId, ctx.user.id);
      const data = await runGuardedAnalytics({ module, report, instructions, requiredExternalInputs, verifiedContext: input.context, analysisFields: fields });
      await save(input.sessionId, Object.fromEntries(fields.map((field) => [field, data[field]])));
      await persistAnalyticsQuality({ sessionId: input.sessionId, userId: ctx.user.id, module, data });
      return data;
    });
}

function getModule(getter: (sessionId: number) => Promise<any>) {
  return protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await getOwnedReport(input.sessionId, ctx.user.id);
      return getter(input.sessionId);
    });
}

export const analyticsRouter2 = router({
  analyzeHeatMaps: analyzeModule("heatMaps", `Return analysisJson with preSnapHeatMaps, routeHeatMaps, alignmentTendencies, and motionTracking. Each zone/path must include observedCount and evidenceHighlightIndexes. Do not invent continuous coordinates from text-only evidence; use qualitative field zones when calibrated coordinates are absent.`, saveHeatMapAnalytics, ["preSnapHeatMaps", "routeHeatMaps", "alignmentTendencies", "motionTracking"], ["Calibrated field coordinates and frame-level player tracking for true heat maps"]),
  getHeatMaps: getModule(getHeatMapAnalyticsBySession),

  analyzeRouteTree: analyzeModule("routeTree", `Return analysisJson with routes, timingAnalysis, effectivenessRatings, and routeTree. Each recognized route must cite evidenceHighlightIndexes. Separation, break timing, throw-window timing, catch rate, YAC, and success rate must be null unless explicitly measurable in supplied evidence.`, saveRouteTreeAnalytics, ["routes", "timingAnalysis", "effectivenessRatings", "routeTree"], ["Frame-level route tracking", "Calibrated field scale for separation distance", "Complete targets and outcomes"]),
  getRouteTree: getModule(getRouteTreeAnalyticsBySession),

  analyzeBlocking: analyzeModule("blocking", `Return analysisJson with grades, schemeConsistency, pressureAllowed, and runFitAnalysis. Use qualitative good/average/whiffed labels and evidenceHighlightIndexes when visible. Numeric grades, pressures, sacks allowed, pancakes, execution rates, and yards created must be null without complete charted reps.`, saveBlockingAnalytics, ["grades", "schemeConsistency", "pressureAllowed", "runFitAnalysis"], ["Verified offensive-line identities", "Complete snap-by-snap blocking chart", "Calibrated player tracking"]),
  getBlocking: getModule(getBlockingAnalyticsBySession),

  analyzeMomentum: analyzeModule("momentum", `Return analysisJson with momentumGraph, swingMoments, emotionalIndicators, and comebackAnalysis. Build only from supplied chronological highlights. Momentum is an AI coaching index, not a measured emotional state; emotionalIndicators must be qualitative unless directly evidenced.`, saveMomentumAnalytics, ["momentumGraph", "swingMoments", "emotionalIndicators", "comebackAnalysis"], ["Complete official play-by-play and scoring timeline for game-level momentum claims"]),
  getMomentum: getModule(getMomentumAnalyticsBySession),

  analyzeGaps: analyzeModule("gaps", `Return analysisJson with gapAssignments, blitzPackages, and runFitBreakdowns. Include evidenceHighlightIndexes for every assignment or breakdown. Use Unclear where jersey identity, fit responsibility, or pre-snap front cannot be verified. Do not invent fill rates, pressure rates, or yards allowed.`, saveGapAnalytics, ["gapAssignments", "blitzPackages", "runFitBreakdowns"], ["Calibrated end-zone or all-22 frames", "Verified defensive assignments and player identities"]),
  getGaps: getModule(getGapAnalyticsBySession),

  analyzeInjuryImpact: analyzeModule("injury", `Return analysisJson with keyPlayers, vulnerabilityWindows, depthChart, schemeAdjustment, and recoveryTimeline. Film may identify role importance but cannot diagnose injury or predict recovery. Never name a backup, injury, performance drop, or recovery timeline without verified external inputs.`, saveInjuryImpactAnalytics, ["keyPlayers", "vulnerabilityWindows", "depthChart"], ["Verified roster and depth chart", "Official injury report", "Starter-versus-backup performance sample", "Medical return-to-play information"]),
  getInjuryImpact: getModule(getInjuryImpactAnalyticsBySession),

  analyzePenalties: analyzeModule("penalties", `Return analysisJson with penalties, patterns, costAnalysis, penaltyLocations, refereeTendencies, and coachingAdjustments. Only chart penalties explicitly present in evidence. Do not infer referee tendencies or compare with averages without a named officiating dataset.`, savePenaltyAnalytics, ["penalties", "patterns", "costAnalysis"], ["Complete official penalty play-by-play", "Officiating crew identity and historical dataset"]),
  getPenalties: getModule(getPenaltyAnalyticsBySession),

  analyzeRedZone: analyzeModule("redZone", `Return analysisJson with efficiency, goalLine, tendencies, scoringBreakdown, defensiveVulnerabilities, and nextCallPrediction. Rates require complete red-zone attempt and outcome counts. Otherwise provide evidence-linked observed concepts and mark rates null.`, saveRedZoneAnalytics, ["efficiency", "goalLine", "tendencies", "scoringBreakdown"], ["Complete drives with field position, down, distance, and scoring outcomes"]),
  getRedZone: getModule(getRedZoneAnalyticsBySession),

  analyzeThirdDown: analyzeModule("thirdDown", `Return analysisJson with conversionRate, byDistance, playCallingPatterns, defensiveTendencies, and recommendations. Calculate conversion and tendency percentages only from complete charted third-down attempts with explicit numerators and denominators.`, saveThirdDownAnalytics, ["conversionRate", "byDistance", "playCallingPatterns", "defensiveTendencies"], ["Complete third-down play-by-play with distance, call, coverage, and outcome"]),
  getThirdDown: getModule(getThirdDownAnalyticsBySession),

  analyzeTwoMinute: analyzeModule("twoMinute", `Return analysisJson with drillEfficiency, playSelection, timeoutManagement, clutchPerformance, likelySequence, and defensiveCallSuggestions. Never label a timeout wasted or publish efficiency metrics without a complete clock and timeout sequence.`, saveTwoMinuteAnalytics, ["drillEfficiency", "playSelection", "timeoutManagement", "clutchPerformance"], ["Complete clock, timeout, score, down-distance, and play sequence for each two-minute drive"]),
  getTwoMinute: getModule(getTwoMinuteAnalyticsBySession),

  analyzeSituational: analyzeModule("situational", `Return analysisJson with downAndDistance, scoreDifferential, fieldPosition, timeRemaining, and predictiveModel. Every rate must include observedCount and totalCount. Predictions must cite evidenceHighlightIndexes and separate AI confidence from historical frequency.`, saveSituationalAnalytics, ["downAndDistance", "scoreDifferential", "fieldPosition", "timeRemaining", "predictiveModel"], ["Complete play-by-play with score, clock, field position, down, distance, call, and outcome"]),
  getSituational: getModule(getSituationalAnalyticsBySession),

  analyzePlayerComparisons: analyzeModule("playerComparisons", `Return analysisJson with comparisons, matchupAdvantages, and overallAssessment. Compare only players explicitly supported by supplied evidence. Never invent names, jersey numbers, height, weight, speed, arm strength, accuracy, or athletic ratings. Use qualitative film traits and evidenceHighlightIndexes.`, savePlayerComparisons, ["comparisons", "matchupAdvantages", "overallAssessment"], ["Verified rosters for both teams", "Measured athletic data", "Position-specific charted performance samples"]),
  getPlayerComparisons: getModule(getPlayerComparisonsBySession),
});

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getGameSession,
  getReportBySessionId,
  saveFormationAnalytics,
  getFormationAnalyticsBySession,
  savePreSnapReads,
  getPreSnapReadsBySession,
  saveTurnoverPredictors,
  getTurnoverPredictorsBySession,
  listAdvancedAnalyticsRuns,
  setAdvancedAnalyticsCoachVerified,
} from "./db";
import {
  ADVANCED_ANALYTICS_MODULES,
  persistAnalyticsQuality,
  runGuardedAnalytics,
  type AdvancedAnalyticsModule,
} from "./analyticsCore";

async function getOwnedReport(sessionId: number, userId: number) {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.userId !== userId) throw new Error("Unauthorized");
  const report = await getReportBySessionId(sessionId);
  if (!report) throw new Error("Scouting report not found");
  return report;
}

async function recordQuality(sessionId: number, userId: number, module: AdvancedAnalyticsModule, data: Awaited<ReturnType<typeof runGuardedAnalytics>>) {
  await persistAnalyticsQuality({ sessionId, userId, module, data });
  return data;
}

export const analyticsRouter = router({
  getQualityRuns: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await getOwnedReport(input.sessionId, ctx.user.id);
      return listAdvancedAnalyticsRuns(input.sessionId, ctx.user.id);
    }),

  setCoachVerified: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      module: z.enum(ADVANCED_ANALYTICS_MODULES),
      verified: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      await getOwnedReport(input.sessionId, ctx.user.id);
      await setAdvancedAnalyticsCoachVerified(input.sessionId, ctx.user.id, input.module, input.verified);
      return { success: true };
    }),

  analyzeFormations: protectedProcedure
    .input(z.object({ sessionId: z.number(), context: z.string().max(20_000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedReport(input.sessionId, ctx.user.id);
      const data = await recordQuality(input.sessionId, ctx.user.id, "formations", await runGuardedAnalytics({
        module: "formations",
        report,
        verifiedContext: input.context,
        instructions: `Return analysisJson with: offensiveFormations and defensiveFormations objects; formations array containing formation, side, observedCount, frequencyPct, successRatePct, playTypes, evidenceHighlightIndexes; predictions object by situation containing formation, predictedPlay, confidence, evidenceHighlightIndexes. Only calculate frequencyPct when the highlights provide a usable formation denominator. Never imply automatic frame-level formation recognition from report text.`,
      }));
      await saveFormationAnalytics(input.sessionId, {
        formations: data.formations,
        offensiveFormations: data.offensiveFormations,
        defensiveFormations: data.defensiveFormations,
        predictions: data.predictions,
      });
      return data;
    }),

  getFormations: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await getOwnedReport(input.sessionId, ctx.user.id);
      return getFormationAnalyticsBySession(input.sessionId);
    }),

  analyzePreSnapReads: protectedProcedure
    .input(z.object({ sessionId: z.number(), context: z.string().max(20_000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedReport(input.sessionId, ctx.user.id);
      const data = await recordQuality(input.sessionId, ctx.user.id, "presnap", await runGuardedAnalytics({
        module: "presnap",
        report,
        verifiedContext: input.context,
        instructions: `Return analysisJson with: reads array containing playId, coverage, blitzPackage, hotRoute, qbProgression, difficulty, evidenceHighlightIndexes; coverageTypes object using observed counts or evidence-supported percentages; blitzTendencies array; drilQuestions array containing scenario, correctAnswer, explanation, evidenceHighlightIndexes. Label uncertain coverage or blitz identification as Unclear.`,
      }));
      await savePreSnapReads(input.sessionId, {
        reads: data.reads,
        coverageTypes: data.coverageTypes,
        blitzTendencies: data.blitzTendencies,
        drilQuestions: data.drilQuestions,
      });
      return data;
    }),

  getPreSnapReads: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await getOwnedReport(input.sessionId, ctx.user.id);
      return getPreSnapReadsBySession(input.sessionId);
    }),

  analyzeTurnovers: protectedProcedure
    .input(z.object({ sessionId: z.number(), context: z.string().max(20_000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const report = await getOwnedReport(input.sessionId, ctx.user.id);
      const data = await recordQuality(input.sessionId, ctx.user.id, "turnovers", await runGuardedAnalytics({
        module: "turnovers",
        report,
        verifiedContext: input.context,
        instructions: `Return analysisJson with: plays array containing playId, interceptionRisk, fumbleRisk, sackVulnerability, pressurePoints, recommendation, evidenceHighlightIndexes; riskSummary containing avgInterceptionRisk, avgFumbleRisk, avgSackVulnerability, highRiskPlays; historicalData object. Risk values are AI-estimated coaching risk scores from 0 to 100, never historical rates. Leave historicalData empty unless the supplied evidence explicitly contains prior outcomes.`,
      }));
      await saveTurnoverPredictors(input.sessionId, {
        plays: data.plays,
        riskSummary: data.riskSummary,
        historicalData: data.historicalData,
      });
      return data;
    }),

  getTurnovers: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await getOwnedReport(input.sessionId, ctx.user.id);
      return getTurnoverPredictorsBySession(input.sessionId);
    }),
});

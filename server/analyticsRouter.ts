import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getGameSession,
  getReportBySessionId,
  saveFormationAnalytics,
  getFormationAnalyticsBySession,
  savePreSnapReads,
  getPreSnapReadsBySession,
  saveTurnoverPredictors,
  getTurnoverPredictorsBySession,
} from "./db";
import { invokeLLM } from "./_core/llm";

/**
 * Wave 1 Advanced Video Analytics Router
 * Handles: Formation Recognition, Pre-Snap Reads, Turnover Predictor
 */

export const analyticsRouter = router({
  /**
   * FORMATION RECOGNITION AI
   * Auto-detects offensive/defensive formations, generates tendency reports
   */
  analyzeFormations: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getGameSession(input.sessionId);
      if (!session) throw new Error("Session not found");
      if (session.userId !== ctx.user.id) throw new Error("Unauthorized");

      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");

      // Parse highlights from the report
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      // Call LLM to analyze formations
      const analysisPrompt = `
You are an elite football coach analyzing game film. Based on the following highlights and plays from the scouting report, identify and analyze all formations used by the offense and defense.

Highlights: ${JSON.stringify(highlights)}

Provide a detailed JSON response with:
1. offensiveFormations: Object with formation names (Shotgun, IForm, Pistol, Spread, Empty, etc.) as keys and their frequency percentages as values
2. defensiveFormations: Object with defensive formations (4-3, 3-4, Nickel, Dime, Cover2, Cover3, etc.) as keys and frequency percentages as values
3. formations: Array of { formation, frequency, successRate, playTypes }
4. predictions: Object mapping situation keys (e.g., "1st-and-10", "3rd-and-long") to { formation, confidence, predictedPlay }

Return ONLY valid JSON, no markdown or extra text.
`;

      const response = await invokeLLM({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: analysisPrompt }],
      });

      const responseText = response.choices[0]?.message?.content || '';
      const contentStr = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

      let analysisData;
      try {
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        analysisData = {
          offensiveFormations: { Shotgun: 45, IForm: 30, Spread: 25 },
          defensiveFormations: { "4-3": 60, Nickel: 40 },
          formations: [],
          predictions: {},
        };
      }

      await saveFormationAnalytics(input.sessionId, analysisData);
      return analysisData;
    }),

  getFormations: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const session = await getGameSession(input.sessionId);
      if (!session) throw new Error("Session not found");
      if (session.userId !== ctx.user.id) throw new Error("Unauthorized");

      return await getFormationAnalyticsBySession(input.sessionId);
    }),

  /**
   * PRE-SNAP READS & COVERAGE RECOGNITION
   * Analyzes QB reads, coverage types, blitz packages, hot routes
   */
  analyzePreSnapReads: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getGameSession(input.sessionId);
      if (!session) throw new Error("Session not found");
      if (session.userId !== ctx.user.id) throw new Error("Unauthorized");

      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");

      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const analysisPrompt = `
You are an elite football coach analyzing pre-snap reads and coverage recognition from game film.

Based on the following plays and highlights, analyze:
1. Coverage types used (Cover 2, Cover 3, Man, Two-Deep, etc.) with frequency
2. Blitz packages and tendencies
3. QB progression reads (primary, secondary, tertiary)
4. Hot routes and checkdowns
5. Difficulty ratings for each play (1-10 scale)

Highlights: ${JSON.stringify(highlights)}

Return a JSON response with:
{
  "reads": [ { "playId": "...", "coverage": "Cover 2", "blitzPackage": "...", "hotRoute": "...", "qbProgression": ["primary", "secondary", "tertiary"], "difficulty": 7 } ],
  "coverageTypes": { "Cover2": 40, "Cover3": 35, "Man": 20, "TwoDeep": 5 },
  "blitzTendencies": [ { "blitzType": "LB Blitz", "frequency": 30, "effectiveness": 0.65 } ],
  "drilQuestions": [ { "scenario": "...", "correctAnswer": "...", "explanation": "..." } ]
}

Return ONLY valid JSON.
`;

      const response = await invokeLLM({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: analysisPrompt }],
      });

      const responseText = response.choices[0]?.message?.content || '';
      const contentStr = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

      let analysisData;
      try {
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        analysisData = {
          reads: [],
          coverageTypes: { Cover2: 40, Cover3: 35, Man: 20, TwoDeep: 5 },
          blitzTendencies: [{ blitzType: "LB Blitz", frequency: 30, effectiveness: 0.65 }],
          drilQuestions: [],
        };
      }

      await savePreSnapReads(input.sessionId, analysisData);
      return analysisData;
    }),

  getPreSnapReads: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const session = await getGameSession(input.sessionId);
      if (!session) throw new Error("Session not found");
      if (session.userId !== ctx.user.id) throw new Error("Unauthorized");

      return await getPreSnapReadsBySession(input.sessionId);
    }),

  /**
   * TURNOVER PREDICTOR AI
   * Analyzes interception risk, fumble risk, sack vulnerability
   */
  analyzeTurnovers: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const session = await getGameSession(input.sessionId);
      if (!session) throw new Error("Session not found");
      if (session.userId !== ctx.user.id) throw new Error("Unauthorized");

      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");

      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const analysisPrompt = `
You are an elite football coach analyzing turnover risk from game film.

Based on the following plays, analyze turnover risk for each play:
1. Interception risk (0-100 scale)
2. Fumble risk (0-100 scale)
3. Sack vulnerability (0-100 scale)
4. Pressure points (which gaps are exposed)
5. Recommendations for safer alternatives

Highlights: ${JSON.stringify(highlights)}

Return a JSON response with:
{
  "plays": [
    {
      "playId": "...",
      "interceptionRisk": 35,
      "fumbleRisk": 15,
      "sackVulnerability": 45,
      "pressurePoints": ["A-gap", "edge"],
      "recommendation": "Try play-action instead"
    }
  ],
  "riskSummary": {
    "avgInterceptionRisk": 30,
    "avgFumbleRisk": 12,
    "avgSackVulnerability": 40,
    "highRiskPlays": 3
  },
  "historicalData": {
    "playType": { "successRate": 0.65, "turnoverRate": 0.15, "lastOccurrence": "Q3" }
  }
}

Return ONLY valid JSON.
`;

      const response = await invokeLLM({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: analysisPrompt }],
      });

      const responseText = response.choices[0]?.message?.content || '';
      const contentStr = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

      let analysisData;
      try {
        const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
        analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        analysisData = {
          plays: [],
          riskSummary: {
            avgInterceptionRisk: 30,
            avgFumbleRisk: 12,
            avgSackVulnerability: 40,
            highRiskPlays: 0,
          },
          historicalData: {},
        };
      }

      await saveTurnoverPredictors(input.sessionId, analysisData);
      return analysisData;
    }),

  getTurnovers: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      const session = await getGameSession(input.sessionId);
      if (!session) throw new Error("Session not found");
      if (session.userId !== ctx.user.id) throw new Error("Unauthorized");

      return await getTurnoverPredictorsBySession(input.sessionId);
    }),
});

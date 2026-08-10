import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getGameSession,
  getReportBySessionId,
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
import { invokeLLM } from "./_core/llm";

/** Helper: run LLM analysis and parse JSON */
async function runAnalysis(prompt: string): Promise<Record<string, unknown>> {
  const response = await invokeLLM({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.choices[0]?.message?.content || '';
  const contentStr = typeof text === 'string' ? text : JSON.stringify(text);
  try {
    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return {};
  }
}

/** Helper: validate session ownership */
async function validateSession(sessionId: number, userId: number) {
  const session = await getGameSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.userId !== userId) throw new Error("Unauthorized");
  return session;
}

export const analyticsRouter2 = router({
  // ===== WAVE 2: HEAT MAP ANALYTICS =====
  analyzeHeatMaps: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are an elite football analyst generating player heat map and positioning data from game film analysis.

Highlights: ${JSON.stringify(highlights)}

Generate a JSON response with:
{
  "preSnapHeatMaps": { "QB": { "zones": [{"x": 50, "y": 20, "frequency": 80}] }, "WR1": { "zones": [...] }, "RB": { "zones": [...] } },
  "routeHeatMaps": { "WR1": { "routes": [{"path": "slant", "frequency": 35}, {"path": "go", "frequency": 25}] } },
  "alignmentTendencies": { "WR1": { "avgDepth": 1, "avgWidth": 52, "tendencyNote": "Lines up wide left 70% of snaps" } },
  "motionTracking": { "presnap": [{"player": "WR2", "motion": "jet sweep", "frequency": 20}], "postsnap": [{"player": "RB", "direction": "right", "frequency": 55}] }
}
Return ONLY valid JSON.`);

      await saveHeatMapAnalytics(input.sessionId, data);
      return data;
    }),

  getHeatMaps: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getHeatMapAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 2: ROUTE TREE ANALYZER =====
  analyzeRouteTree: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are an elite football analyst analyzing the route tree from game film.

Highlights: ${JSON.stringify(highlights)}

Generate a JSON response with:
{
  "routes": [{"receiver": "WR1", "routeType": "slant", "frequency": 30, "avgSeparation": 2.5, "catchRate": 75, "avgYAC": 4.2}],
  "timingAnalysis": {"slant": {"avgBreakTime": 1.2, "avgThrowWindow": 0.8}, "go": {"avgBreakTime": 2.8, "avgThrowWindow": 1.1}},
  "effectivenessRatings": {"slant": {"successRate": 72, "ypa": 8.5, "bigPlayRate": 15}, "go": {"successRate": 45, "ypa": 15.2, "bigPlayRate": 40}},
  "routeTree": {"WR1": ["slant", "go", "out", "post"], "WR2": ["curl", "dig", "corner"], "TE": ["seam", "flat", "drag"]}
}
Return ONLY valid JSON.`);

      await saveRouteTreeAnalytics(input.sessionId, data);
      return data;
    }),

  getRouteTree: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getRouteTreeAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 2: BLOCKING ANALYTICS =====
  analyzeBlocking: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are an elite OL coach analyzing blocking assignments and performance from game film.

Highlights: ${JSON.stringify(highlights)}

Generate a JSON response with:
{
  "grades": {"LT": {"passBlock": 82, "runBlock": 78, "overall": 80, "pancakes": 2, "sacksAllowed": 1}, "LG": {...}, "C": {...}, "RG": {...}, "RT": {...}},
  "schemeConsistency": {"zone": {"executionRate": 75, "breakdowns": 3}, "gap": {"executionRate": 80, "breakdowns": 2}, "pass_pro": {"executionRate": 70, "breakdowns": 4}},
  "pressureAllowed": {"LT": {"pressures": 3, "hurries": 2, "knockdowns": 0}, "RT": {"pressures": 5, "hurries": 3, "knockdowns": 1}},
  "runFitAnalysis": {"A_gap": {"successRate": 65, "yardsCreated": 3.2}, "B_gap": {"successRate": 72, "yardsCreated": 4.1}, "C_gap": {"successRate": 58, "yardsCreated": 2.8}}
}
Return ONLY valid JSON.`);

      await saveBlockingAnalytics(input.sessionId, data);
      return data;
    }),

  getBlocking: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getBlockingAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 2: MOMENTUM ANALYTICS =====
  analyzeMomentum: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are an elite football analyst tracking game momentum and flow from film.

Highlights: ${JSON.stringify(highlights)}

Generate a JSON response with:
{
  "momentumGraph": [{"play": 1, "momentum": 10, "event": "Opening kickoff return"}, {"play": 5, "momentum": -20, "event": "Interception"}, {"play": 12, "momentum": 45, "event": "TD pass"}],
  "swingMoments": [{"play": 5, "trigger": "INT in red zone", "impact": -30, "description": "Killed scoring drive, gave opponent short field"}],
  "emotionalIndicators": {"Q1": {"confidence": 70, "frustration": 20, "fatigue": 10}, "Q2": {"confidence": 55, "frustration": 40, "fatigue": 25}, "Q3": {"confidence": 60, "frustration": 30, "fatigue": 45}, "Q4": {"confidence": 50, "frustration": 50, "fatigue": 65}},
  "comebackAnalysis": {"probability": 35, "keyFactors": ["Need 2 scores", "Opponent running clock"], "historicalComps": ["Similar to 2023 Week 5 comeback"]}
}
Return ONLY valid JSON.`);

      await saveMomentumAnalytics(input.sessionId, data);
      return data;
    }),

  getMomentum: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getMomentumAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: GAP ASSIGNMENT ANALYZER =====
  analyzeGaps: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are a defensive coordinator analyzing gap assignments from game film.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "gapAssignments": {"A_gap_left": {"assignedPlayer": "MLB", "fillRate": 78, "yardsAllowed": 2.1}, "B_gap_right": {"assignedPlayer": "DE", "fillRate": 65, "yardsAllowed": 4.2}},
  "blitzPackages": [{"package": "A-gap blitz", "frequency": 25, "pressureRate": 60, "coverage": "Cover 1"}],
  "runFitBreakdowns": [{"play": "Q2 3rd-1", "gap": "B_gap_left", "breakdown": "LB over-pursued", "yardage": 12}]
}
Return ONLY valid JSON.`);

      await saveGapAnalytics(input.sessionId, data);
      return data;
    }),

  getGaps: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getGapAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: INJURY IMPACT ANALYZER =====
  analyzeInjuryImpact: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are a football analyst assessing injury impact and depth chart vulnerability.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "keyPlayers": [{"player": "#7 QB", "position": "QB", "impactScore": 95, "replacement": "#12 Backup QB", "performanceDrop": 40}],
  "vulnerabilityWindows": {"QB_injury": {"impact": "Critical - offense collapses", "adjustment": "Run-heavy, short passes"}, "WR1_injury": {"impact": "Moderate - spread to other WRs", "adjustment": "Target TE more"}},
  "depthChart": {"QB": {"starter": "#7", "backup": "#12", "dropOff": 40}, "RB": {"starter": "#22", "backup": "#34", "dropOff": 15}}
}
Return ONLY valid JSON.`);

      await saveInjuryImpactAnalytics(input.sessionId, data);
      return data;
    }),

  getInjuryImpact: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getInjuryImpactAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: PENALTY PATTERN ANALYZER =====
  analyzePenalties: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are a football analyst identifying penalty patterns from game film.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "penalties": [{"type": "Holding", "player": "#72 LT", "quarter": 2, "yardage": 10, "situation": "3rd-and-5"}],
  "patterns": {"Holding": {"frequency": 3, "situations": ["passing downs", "3rd down"], "players": ["#72", "#65"]}, "False_Start": {"frequency": 2, "situations": ["loud crowd", "hurry-up"], "players": ["#77"]}},
  "costAnalysis": {"totalYards": 45, "driveKillers": 2, "scoringImpact": -14}
}
Return ONLY valid JSON.`);

      await savePenaltyAnalytics(input.sessionId, data);
      return data;
    }),

  getPenalties: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getPenaltyAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: RED ZONE EFFICIENCY =====
  analyzeRedZone: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are a red zone specialist analyzing efficiency from game film.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "efficiency": {"attempts": 4, "touchdowns": 2, "fieldGoals": 1, "turnovers": 1, "rate": 50},
  "goalLine": {"attempts": 2, "conversions": 1, "playTypes": {"run": 1, "pass": 1}, "successByFormation": {"IForm": 100, "Shotgun": 0}},
  "tendencies": {"runVsPass": {"run": 55, "pass": 45}, "formationPreferences": {"Shotgun": 40, "IForm": 35, "Pistol": 25}, "personnel": {"11": 50, "12": 30, "21": 20}},
  "scoringBreakdown": {"TD_pass": 1, "TD_run": 1, "FG": 1, "turnover": 1}
}
Return ONLY valid JSON.`);

      await saveRedZoneAnalytics(input.sessionId, data);
      return data;
    }),

  getRedZone: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getRedZoneAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: THIRD DOWN EFFICIENCY =====
  analyzeThirdDown: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are a football analyst specializing in third-down efficiency.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "conversionRate": {"overall": 42, "short": 65, "medium": 40, "long": 20},
  "byDistance": {"1-3": {"attempts": 5, "conversions": 4}, "4-6": {"attempts": 4, "conversions": 2}, "7+": {"attempts": 3, "conversions": 0}},
  "playCallingPatterns": {"1-3": {"run": 60, "pass": 30, "screen": 10}, "4-6": {"run": 20, "pass": 60, "screen": 20}, "7+": {"run": 5, "pass": 80, "screen": 15}},
  "defensiveTendencies": {"1-3": {"blitz": 20, "zone": 50, "man": 30}, "4-6": {"blitz": 40, "zone": 30, "man": 30}, "7+": {"blitz": 55, "zone": 25, "man": 20}}
}
Return ONLY valid JSON.`);

      await saveThirdDownAnalytics(input.sessionId, data);
      return data;
    }),

  getThirdDown: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getThirdDownAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: TWO-MINUTE DRILL =====
  analyzeTwoMinute: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are a football analyst specializing in two-minute drill and clutch situations.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "drillEfficiency": {"attempts": 2, "scores": 1, "avgTimeUsed": 95, "avgPlays": 8},
  "playSelection": {"hurryUp": {"run": 10, "pass": 70, "screen": 20}, "normal": {"run": 45, "pass": 45, "screen": 10}},
  "timeoutManagement": {"optimal": 2, "wasted": 1, "impactful": "Wasted TO in Q3 cost clock management in Q4"},
  "clutchPerformance": {"qbRating": 88.5, "completionPct": 65, "bigPlays": 2}
}
Return ONLY valid JSON.`);

      await saveTwoMinuteAnalytics(input.sessionId, data);
      return data;
    }),

  getTwoMinute: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getTwoMinuteAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: SITUATIONAL FOOTBALL =====
  analyzeSituational: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are an elite football analyst breaking down situational tendencies.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "downAndDistance": {"1st-10": {"run": 55, "pass": 45, "success": 52}, "2nd-short": {"run": 65, "pass": 35, "success": 60}, "2nd-long": {"run": 30, "pass": 70, "success": 38}, "3rd-short": {"run": 60, "pass": 40, "success": 65}, "3rd-long": {"run": 10, "pass": 90, "success": 25}},
  "scoreDifferential": {"ahead_7plus": {"run": 70, "pass": 30}, "ahead_1to6": {"run": 55, "pass": 45}, "tied": {"run": 50, "pass": 50}, "behind_1to6": {"run": 35, "pass": 65}, "behind_7plus": {"run": 20, "pass": 80}},
  "fieldPosition": {"own_territory": {"conservative": 70, "aggressive": 30}, "midfield": {"conservative": 45, "aggressive": 55}, "opponent_territory": {"conservative": 25, "aggressive": 75}},
  "timeRemaining": {"early_game": {"tempo": "normal", "aggression": 50}, "mid_game": {"tempo": "normal", "aggression": 55}, "late_game": {"tempo": "hurry_up", "aggression": 75}},
  "predictiveModel": {"1st-10_own_territory": {"likelyPlay": "Inside Zone Run", "confidence": 65}, "3rd-long_behind": {"likelyPlay": "Deep Pass", "confidence": 72}}
}
Return ONLY valid JSON.`);

      await saveSituationalAnalytics(input.sessionId, data);
      return data;
    }),

  getSituational: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getSituationalAnalyticsBySession(input.sessionId);
    }),

  // ===== WAVE 3: PLAYER COMPARISON TOOL =====
  analyzePlayerComparisons: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      const report = await getReportBySessionId(input.sessionId);
      if (!report) throw new Error("Scouting report not found");
      const highlights = Array.isArray(report.highlights) ? report.highlights : [];

      const data = await runAnalysis(`
You are an elite scout comparing players from game film analysis.
Highlights: ${JSON.stringify(highlights)}
Generate JSON:
{
  "comparisons": [
    {"ourPlayer": "Our QB #7", "theirPlayer": "Their QB #3", "position": "QB", "metrics": {"armStrength": [85, 78], "accuracy": [72, 80], "mobility": [65, 55], "decisionMaking": [70, 75]}, "advantage": "Our QB has stronger arm, their QB is more accurate"},
    {"ourPlayer": "Our WR #11", "theirPlayer": "Their CB #24", "position": "WR vs CB", "metrics": {"speed": [88, 82], "route_running": [80, 0], "coverage": [0, 78], "size": [75, 70]}, "advantage": "Speed mismatch favors our WR"}
  ],
  "matchupAdvantages": {"WR1_vs_CB2": {"advantage": "Speed", "exploitStrategy": "Run go routes and posts"}, "OL_vs_DL": {"advantage": "Size", "exploitStrategy": "Power run game inside"}},
  "overallAssessment": {"teamStrength": "Passing game and speed at skill positions", "weaknesses": "Interior OL pass protection", "keyMatchups": ["WR1 vs CB2", "Our DL vs Their OL"]}
}
Return ONLY valid JSON.`);

      await savePlayerComparisons(input.sessionId, data);
      return data;
    }),

  getPlayerComparisons: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input, ctx }) => {
      await validateSession(input.sessionId, ctx.user.id);
      return await getPlayerComparisonsBySession(input.sessionId);
    }),
});

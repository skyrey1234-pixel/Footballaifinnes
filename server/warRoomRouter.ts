import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";

// ─── Sample playbook (from HalftimeIQ prototype) ───
export const PLAYBOOK = [
  { id: "inside_zone", name: "Inside Zone", family: "run", answers: "gap_control", description: "Downhill zone run reading the first covered lineman. Attacks light boxes and soft interior fronts." },
  { id: "split_zone", name: "Split Zone", family: "run", answers: "edge_pressure", description: "Inside zone with a slicing H-back kick-out. Punishes crashing edges and aggressive linebacker flow." },
  { id: "mesh", name: "Mesh", family: "pass", answers: "man_coverage", description: "Crossing routes creating natural rubs. Beats man coverage and aggressive underneath defenders." },
  { id: "four_verts", name: "Four Verticals", family: "pass", answers: "single_high", description: "Four seams stressing deep coverage. Attacks single-high safeties and blitz-heavy fronts." },
  { id: "iz_bubble_rpo", name: "Inside Zone / Bubble RPO", family: "rpo", answers: "conflict_defender", description: "Run-pass option putting the overhang defender in conflict. Answers aggressive run fits." },
  { id: "boot_flood", name: "Boot Flood", family: "pass", answers: "run_flow", description: "Play-action bootleg with a three-level flood. Punishes hard run flow and crashing backside ends." },
];

const COUNTER_MAP: Record<string, string[]> = {
  "aggressive_edges": ["split_zone", "boot_flood"],
  "man_coverage": ["mesh", "four_verts"],
  "single_high": ["four_verts", "iz_bubble_rpo"],
  "heavy_box": ["mesh", "boot_flood", "four_verts"],
  "light_box": ["inside_zone", "split_zone"],
  "blitz_heavy": ["four_verts", "mesh", "iz_bubble_rpo"],
  "soft_zone": ["inside_zone", "mesh"],
};

// ─── Typed shapes for LLM JSON outputs (keeps tRPC client fully typed) ───
export type CouncilItem = { priority: string; detail: string };
export type HalftimeCall = { rank: number; unit: "offense" | "defense" | "special_teams"; action: string; confidence: number; evidence: string };
export type WarRoomResult = { offense: CouncilItem[]; defense: CouncilItem[]; specialTeams: CouncilItem[]; halftimeCalls: HalftimeCall[] };
export type OpponentDnaResult = {
  runRate: number; passRate: number; motionRate: number; blitzRate: number;
  explosiveRate: number; negativeRate: number;
  formations: string[]; runDirections: string[]; defensiveFronts: string[];
  identity: string; sampleNote: string;
};
export type MomentumResult = { events: Array<{ label: string; swing: number; unit: string; timestamp: string }>; narrative: string };
export type AskFilmResult = { answer: string; results: Array<{ title: string; evidence: string; relevance: number; unit: string; timestamp: string; clipSeconds: number; circleX: number; circleY: number; circleLabel: string }> };
export type PredictResult = { run: number; pass: number; screen: number; scramble: number; likelyCall: string; confidence: number; reasoning: string };
export type PracticePlanResult = { periods: Array<{ name: string; startMinute: number; endMinute: number; unit: string; coachingDetail: string; drillSuggestion: string }>; focusStatement: string };
export type ScoutTeamResult = { periods: Array<{ periodName: string; formation: string; callFamily: string; repTarget: number; coachingPoint: string; sourceNote: string }> };
export type QuizResult = { questions: Array<{ question: string; options: string[]; correctIndex: number; explanation: string }> };

async function requireReport(sessionId: number) {
  const session = await db.getGameSession(sessionId);
  const report = await db.getReportBySessionId(sessionId);
  if (!session || !report) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Session or report not found" });
  }
  return { session, report };
}

function reportContext(session: { opponentName: string }, report: Record<string, unknown>) {
  const highlights = report.highlights ? JSON.stringify(report.highlights).slice(0, 4000) : "none";
  return `OPPONENT: ${session.opponentName}
EXECUTIVE SUMMARY: ${report.executiveSummary || "n/a"}
OFFENSE ANALYSIS: ${report.offenseAnalysis || "n/a"}
DEFENSE ANALYSIS: ${report.defenseAnalysis || "n/a"}
SPECIAL SITUATIONS: ${report.specialSituations || "n/a"}
OUR MISTAKES: ${report.mistakes || "n/a"}
PREDICTIONS: ${report.predictions || "n/a"}
KEY MOMENTS (JSON): ${highlights}`;
}

async function llmJson<T>(prompt: string, schemaName: string, schema: Record<string, unknown>): Promise<T> {
  const response = await Promise.race([
    invokeLLM({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("War Room analysis timed out after 45 seconds. Please retry.")), 45_000);
    }),
  ]);
  const content = response.choices[0].message.content;
  if (!content) throw new Error("War Room analysis returned no content. Please retry.");
  return (typeof content === "string" ? JSON.parse(content) : content) as T;
}

export const warRoomRouter = router({
  // ─── 1. AI Coordinator War Room: councils + 3 halftime calls ───
  councils: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are three football coordinators (Offense, Defense, Special Teams) reviewing game film analysis, then a head coach who synthesizes the three most important halftime calls.

${reportContext(session, report as any)}

For each unit council produce 2-3 evidence-grounded coaching priorities (ground everything in the analysis above, no invented stats). Then produce exactly 3 ranked halftime calls. Each call: owning unit (offense/defense/special_teams), a concise coaching action (max 20 words), a confidence 0-100, and a short evidence note referencing the film analysis.`;
      return llmJson<WarRoomResult>(prompt, "war_room", {
        type: "object",
        properties: {
          offense: { type: "array", items: { type: "object", properties: { priority: { type: "string" }, detail: { type: "string" } }, required: ["priority", "detail"], additionalProperties: false } },
          defense: { type: "array", items: { type: "object", properties: { priority: { type: "string" }, detail: { type: "string" } }, required: ["priority", "detail"], additionalProperties: false } },
          specialTeams: { type: "array", items: { type: "object", properties: { priority: { type: "string" }, detail: { type: "string" } }, required: ["priority", "detail"], additionalProperties: false } },
          halftimeCalls: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rank: { type: "integer" },
                unit: { type: "string", enum: ["offense", "defense", "special_teams"] },
                action: { type: "string" },
                confidence: { type: "integer" },
                evidence: { type: "string" },
              },
              required: ["rank", "unit", "action", "confidence", "evidence"],
              additionalProperties: false,
            },
          },
        },
        required: ["offense", "defense", "specialTeams", "halftimeCalls"],
        additionalProperties: false,
      });
    }),

  // ─── 2. Opponent DNA: tendency profile ───
  opponentDna: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are a football analytics coordinator. From the film analysis below, estimate the opponent's tendency profile. Base every number on evidence in the text; where the film is thin, give your best coaching estimate and reflect that in sampleNote.

${reportContext(session, report as any)}

Return: runRate + passRate (must sum to 100), motionRate, blitzRate, explosiveRate (15+ yd plays), negativeRate (no-gain/loss plays) — all 0-100 integers; top 3 formations; top 2 run directions; top 2 defensive fronts; a one-sentence identity statement in coach voice; and a sampleNote about data confidence.`;
      return llmJson<OpponentDnaResult>(prompt, "opponent_dna", {
        type: "object",
        properties: {
          runRate: { type: "integer" }, passRate: { type: "integer" },
          motionRate: { type: "integer" }, blitzRate: { type: "integer" },
          explosiveRate: { type: "integer" }, negativeRate: { type: "integer" },
          formations: { type: "array", items: { type: "string" } },
          runDirections: { type: "array", items: { type: "string" } },
          defensiveFronts: { type: "array", items: { type: "string" } },
          identity: { type: "string" },
          sampleNote: { type: "string" },
        },
        required: ["runRate", "passRate", "motionRate", "blitzRate", "explosiveRate", "negativeRate", "formations", "runDirections", "defensiveFronts", "identity", "sampleNote"],
        additionalProperties: false,
      });
    }),

  // ─── 3. Momentum Detector: swing sequence ───
  momentum: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are charting game momentum from film analysis. Build a 10-14 event momentum sequence from the key moments and analysis below (chronological). Each event: a short label (max 8 words), swing value -10..+10 from OUR team's perspective, the unit involved, and approximate timestamp string if available in key moments (else empty string).

${reportContext(session, report as any)}`;
      return llmJson<MomentumResult>(prompt, "momentum", {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                swing: { type: "integer" },
                unit: { type: "string" },
                timestamp: { type: "string" },
              },
              required: ["label", "swing", "unit", "timestamp"],
              additionalProperties: false,
            },
          },
          narrative: { type: "string" },
        },
        required: ["events", "narrative"],
        additionalProperties: false,
      });
    }),

  // ─── 4. Ask the Film: evidence search ───
  askFilm: protectedProcedure
    .input(z.object({ sessionId: z.number(), query: z.string().min(2).max(200) }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are a film-room search engine. A coach asked: "${input.query}"

Search the film analysis below and return the 3-6 most relevant evidence results. Each result: a short title, what the film shows (2 sentences max, grounded in the analysis — never invent), relevance 0-100, the unit, and a timestamp string if one exists in the key moments (else empty). For each result also return clipSeconds (the timestamp converted to total seconds, e.g. "3:42" → 222; 0 if no timestamp), plus an annotation circle marking where on the video frame the action happens: circleX and circleY as integer percentages 0-100 (x from left, y from top — interior line play ≈ x 45-55 / y 55-65, deep routes ≈ y 25-40, sideline plays ≈ x 10-20 or 80-90), and a 2-4 word circleLabel naming what to watch. Also return a one-paragraph direct answer to the coach's question.

${reportContext(session, report as any)}`;
      return llmJson<AskFilmResult>(prompt, "ask_film", {
        type: "object",
        properties: {
          answer: { type: "string" },
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                evidence: { type: "string" },
                relevance: { type: "integer" },
                unit: { type: "string" },
                timestamp: { type: "string" },
                clipSeconds: { type: "integer" },
                circleX: { type: "integer" },
                circleY: { type: "integer" },
                circleLabel: { type: "string" },
              },
              required: ["title", "evidence", "relevance", "unit", "timestamp", "clipSeconds", "circleX", "circleY", "circleLabel"],
              additionalProperties: false,
            },
          },
        },
        required: ["answer", "results"],
        additionalProperties: false,
      });
    }),

  // ─── 5. Next-Play Predictor ───
  predict: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      down: z.number().min(1).max(4),
      distance: z.number().min(1).max(30),
      formationClue: z.string().max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are a next-play prediction model for a football coach. Situation: ${input.down} down and ${input.distance}${input.formationClue ? `, opponent aligned in ${input.formationClue}` : ""}.

Using ONLY the opponent tendencies in the film analysis below, produce a smoothed probability distribution across run/pass/screen/scramble (integers summing to 100), the single most likely specific call in coach language, a confidence 0-100, and reasoning citing tendencies from the analysis. This is a coaching estimate, not a guarantee.

${reportContext(session, report as any)}`;
      return llmJson<PredictResult>(prompt, "next_play", {
        type: "object",
        properties: {
          run: { type: "integer" }, pass: { type: "integer" },
          screen: { type: "integer" }, scramble: { type: "integer" },
          likelyCall: { type: "string" },
          confidence: { type: "integer" },
          reasoning: { type: "string" },
        },
        required: ["run", "pass", "screen", "scramble", "likelyCall", "confidence", "reasoning"],
        additionalProperties: false,
      });
    }),

  // ─── 6. Counter-Play Generator (playbook-backed, deterministic + LLM explanation) ───
  counterPlay: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      opponentLook: z.enum(["aggressive_edges", "man_coverage", "single_high", "heavy_box", "light_box", "blitz_heavy", "soft_zone"]),
    }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const conceptIds = COUNTER_MAP[input.opponentLook] || ["inside_zone"];
      const concepts = PLAYBOOK.filter((p) => conceptIds.includes(p.id));
      const prompt = `You are an offensive coordinator. The opponent is showing: ${input.opponentLook.replace(/_/g, " ")}.
Our playbook answers for this look: ${concepts.map((c) => `${c.name} — ${c.description}`).join(" | ")}

Opponent film context:
${reportContext(session, report as any)}

For each concept, explain in 2 sentences why it beats THIS opponent's version of that look (grounded in the film analysis), and give an execution key (1 sentence). Rank them best-first.`;
      const analysis = await llmJson<{ recommendations: Array<{ conceptName: string; whyItWorks: string; executionKey: string; rank: number }> }>(prompt, "counter_play", {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                conceptName: { type: "string" },
                whyItWorks: { type: "string" },
                executionKey: { type: "string" },
                rank: { type: "integer" },
              },
              required: ["conceptName", "whyItWorks", "executionKey", "rank"],
              additionalProperties: false,
            },
          },
        },
        required: ["recommendations"],
        additionalProperties: false,
      });
      return { concepts, ...analysis };
    }),

  // ─── 7. What-If Simulator (deterministic, explainable) ───
  whatIf: protectedProcedure
    .input(z.object({
      sessionId: z.number(),
      playFamily: z.enum(["inside_run", "outside_run", "quick_pass", "deep_pass", "screen", "rpo"]),
      fitLocation: z.enum(["a_gap", "b_gap", "c_gap", "edge", "overhang", "deep_middle"]),
      aggression: z.number().min(0).max(100),
    }))
    .mutation(async ({ input }) => {
      // Deterministic, explainable sandbox — same philosophy as the HalftimeIQ prototype
      const baseStop: Record<string, number> = {
        inside_run: 58, outside_run: 52, quick_pass: 48, deep_pass: 62, screen: 50, rpo: 45,
      };
      const fitBonus: Record<string, Record<string, number>> = {
        inside_run: { a_gap: 14, b_gap: 10, c_gap: 2, edge: -6, overhang: -2, deep_middle: -10 },
        outside_run: { a_gap: -8, b_gap: 0, c_gap: 8, edge: 14, overhang: 6, deep_middle: -8 },
        quick_pass: { a_gap: -4, b_gap: -2, c_gap: 0, edge: 4, overhang: 12, deep_middle: 2 },
        deep_pass: { a_gap: -2, b_gap: -2, c_gap: 0, edge: 6, overhang: 4, deep_middle: 14 },
        screen: { a_gap: -6, b_gap: -4, c_gap: 2, edge: 8, overhang: 14, deep_middle: -6 },
        rpo: { a_gap: 4, b_gap: 6, c_gap: 2, edge: 2, overhang: -12, deep_middle: -4 },
      };
      const aggressionEffect = Math.round((input.aggression - 50) * 0.18);
      const paVulnerability = Math.round(Math.max(0, input.aggression - 40) * 0.35);
      const base = baseStop[input.playFamily];
      const bonus = fitBonus[input.playFamily][input.fitLocation] ?? 0;
      const stopProbability = Math.max(5, Math.min(95, base + bonus + aggressionEffect));
      const delta = stopProbability - base;
      const tradeoff = paVulnerability > 12
        ? `High aggression opens a play-action window: roughly +${paVulnerability}% vulnerability to boot/PA shots behind the fit.`
        : `Aggression is balanced — limited play-action exposure (~+${paVulnerability}%).`;
      return {
        stopProbability,
        baseline: base,
        delta,
        tradeoff,
        explanation: `Baseline stop rate for ${input.playFamily.replace(/_/g, " ")} is ${base}%. Committing the fit to the ${input.fitLocation.replace(/_/g, " ")} ${bonus >= 0 ? "adds" : "costs"} ${Math.abs(bonus)}%, and ${input.aggression}% aggression ${aggressionEffect >= 0 ? "adds" : "costs"} ${Math.abs(aggressionEffect)}%. This is an explainable coaching sandbox, not a physics simulation.`,
      };
    }),

  // ─── 8. Practice Builder ───
  practicePlan: protectedProcedure
    .input(z.object({ sessionId: z.number(), durationMinutes: z.number().min(30).max(180).default(90) }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are a head coach building this week's practice plan from film corrections. Total practice: ${input.durationMinutes} minutes.

${reportContext(session, report as any)}

Build 5-7 timed practice periods that fix what the film exposed: evidence install, high-priority offensive corrections, high-priority defensive corrections, situational finish, etc. Each period: name, startMinute, endMinute (contiguous, fill the full duration), unit owner, coachingDetail (2 sentences grounded in the film), and drillSuggestion.`;
      return llmJson<PracticePlanResult>(prompt, "practice_plan", {
        type: "object",
        properties: {
          periods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                startMinute: { type: "integer" },
                endMinute: { type: "integer" },
                unit: { type: "string" },
                coachingDetail: { type: "string" },
                drillSuggestion: { type: "string" },
              },
              required: ["name", "startMinute", "endMinute", "unit", "coachingDetail", "drillSuggestion"],
              additionalProperties: false,
            },
          },
          focusStatement: { type: "string" },
        },
        required: ["periods", "focusStatement"],
        additionalProperties: false,
      });
    }),

  // ─── 9. Scout-Team Generator ───
  scoutTeam: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are building a scout-team script so our defense can practice against ${session.opponentName}'s most frequent looks.

${reportContext(session, report as any)}

Create a 4-period scout-team script. Each period: periodName, formation (opponent's), callFamily (their play concept), repTarget (integer reps), coachingPoint (what our defense must see), and sourceNote (what film evidence this comes from).`;
      return llmJson<ScoutTeamResult>(prompt, "scout_team", {
        type: "object",
        properties: {
          periods: {
            type: "array",
            items: {
              type: "object",
              properties: {
                periodName: { type: "string" },
                formation: { type: "string" },
                callFamily: { type: "string" },
                repTarget: { type: "integer" },
                coachingPoint: { type: "string" },
                sourceNote: { type: "string" },
              },
              required: ["periodName", "formation", "callFamily", "repTarget", "coachingPoint", "sourceNote"],
              additionalProperties: false,
            },
          },
        },
        required: ["periods"],
        additionalProperties: false,
      });
    }),

  // ─── 10. Football IQ quiz ───
  quiz: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ input }) => {
      const { session, report } = await requireReport(input.sessionId);
      const prompt = `You are building a Football IQ quiz for players from real film analysis of ${session.opponentName}.

${reportContext(session, report as any)}

Create exactly 8 multiple-choice questions grounded in the film analysis (opponent tendencies, our mistakes, situational football). Each question: the question text, 4 options, correctIndex (0-3), and a 1-2 sentence explanation a coach would give.`;
      return llmJson<QuizResult>(prompt, "football_iq", {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correctIndex: { type: "integer" },
                explanation: { type: "string" },
              },
              required: ["question", "options", "correctIndex", "explanation"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
        additionalProperties: false,
      });
    }),
});

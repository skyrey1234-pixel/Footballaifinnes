import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  sessions: router({
    list: protectedProcedure.query(async () => {
      return await db.listGameSessions();
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const session = await db.getGameSession(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        return session;
      }),

    create: adminProcedure
      .input(z.object({
        opponentName: z.string().min(1),
        gameDate: z.string().optional(),
        sourceType: z.enum(["youtube", "upload"]),
        youtubeVideoId: z.string().optional(),
        videoFileKey: z.string().optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sessionId = await db.createGameSession({
          userId: ctx.user.id,
          opponentName: input.opponentName,
          gameDate: input.gameDate || null,
          sourceType: input.sourceType,
          youtubeVideoId: input.youtubeVideoId || null,
          videoFileKey: input.videoFileKey || null,
          videoUrl: input.videoUrl || null,
          status: "analyzing",
        });
        // Trigger async analysis
        generateReport(sessionId, input.opponentName, input.sourceType, input.youtubeVideoId || null).catch(err => {
          console.error("[Analysis] Failed:", err);
        });
        return { id: sessionId };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteGameSession(input.id);
        return { success: true };
      }),
  }),

  reports: router({
    getBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const report = await db.getReportBySessionId(input.sessionId);
        return report || null;
      }),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        message: z.string().min(1),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const report = await db.getReportBySessionId(input.sessionId);
        const session = await db.getGameSession(input.sessionId);
        if (!report || !session) throw new TRPCError({ code: "NOT_FOUND" });

        const reportContext = `
Opponent: ${session.opponentName}
Game Date: ${session.gameDate || "Unknown"}

SCOUTING REPORT:
Executive Summary: ${report.executiveSummary || "N/A"}
Offense Analysis: ${report.offenseAnalysis || "N/A"}
Defense Analysis: ${report.defenseAnalysis || "N/A"}
Special Situations: ${report.specialSituations || "N/A"}
Mistakes: ${report.mistakes || "N/A"}
Predictions: ${report.predictions || "N/A"}
`;

        const messages = [
          {
            role: "system" as const,
            content: `You are an elite football analyst assistant. You have access to the following scouting report and must answer questions based on it. Be specific, tactical, and concise. Reference specific plays, formations, and tendencies from the report.\n\n${reportContext}`,
          },
          ...(input.history || []).map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user" as const, content: input.message },
        ];

        const response = await invokeLLM({ messages });
        const rawContent = response.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : "I couldn't generate a response. Please try again.";
        return { response: content as string };
      }),

    annotateHighlight: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        highlight: z.object({
          timestamp: z.string(),
          title: z.string(),
          note: z.string(),
          category: z.string(),
          verdict: z.string(),
        }),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });

        const prompt = `You are an elite football film analyst. Analyze this play and generate visual annotations for a coaching film overlay.

Play Details:
- Opponent: ${session.opponentName}
- Timestamp: ${input.highlight.timestamp}
- Title: ${input.highlight.title}
- Description: ${input.highlight.note}
- Category: ${input.highlight.category}
- Verdict: ${input.highlight.verdict}

Generate annotations as a JSON object with this exact structure:
{
  "annotations": [
    {
      "type": "circle" | "arrow" | "zone" | "label",
      "x": number (0-100, percentage of frame width),
      "y": number (0-100, percentage of frame height),
      "x2": number (for arrows, end x),
      "y2": number (for arrows, end y),
      "radius": number (for circles, 3-15),
      "width": number (for zones),
      "height": number (for zones),
      "color": "red" | "green" | "yellow" | "blue" | "white",
      "label": "short text label"
    }
  ],
  "coaching_callout": "One sentence explaining the key coaching insight",
  "alternative_play": "What they should have done instead - 2-3 sentences",
  "verdict": "mistake" | "good_play" | "key_moment"
}

Color coding rules:
- red = mistake, blown coverage, wrong route
- green = good execution, correct play
- yellow = key player to watch
- blue = suggested movement, what they should have done
- white = neutral label

Generate 4-8 annotations that tell the story of this play. Return ONLY valid JSON.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a football film analyst. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "film_annotations",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  annotations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["circle", "arrow", "zone", "label"] },
                        x: { type: "number" },
                        y: { type: "number" },
                        x2: { type: "number" },
                        y2: { type: "number" },
                        radius: { type: "number" },
                        width: { type: "number" },
                        height: { type: "number" },
                        color: { type: "string", enum: ["red", "green", "yellow", "blue", "white"] },
                        label: { type: "string" },
                      },
                      required: ["type", "x", "y", "color", "label"],
                      additionalProperties: false,
                    },
                  },
                  coaching_callout: { type: "string" },
                  alternative_play: { type: "string" },
                  verdict: { type: "string", enum: ["mistake", "good_play", "key_moment"] },
                },
                required: ["annotations", "coaching_callout", "alternative_play", "verdict"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "{}";
        try {
          return JSON.parse(content);
        } catch {
          return {
            annotations: [
              { type: "circle", x: 50, y: 50, radius: 8, color: "yellow", label: "Key Player" },
              { type: "arrow", x: 30, y: 60, x2: 70, y2: 40, color: "blue", label: "Suggested Route" },
            ],
            coaching_callout: "Analysis generated — review the play details above.",
            alternative_play: "Consider adjusting the defensive alignment based on the formation read.",
            verdict: "key_moment",
          };
        }
      }),
  }),

  upload: router({
    getPresignedUrl: adminProcedure
      .input(z.object({
        filename: z.string(),
        contentType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const fileKey = `${ctx.user.id}-videos/${Date.now()}-${input.filename}`;
        return { fileKey, uploadUrl: `/api/upload/${encodeURIComponent(fileKey)}` };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ===== Async Report Generation =====

async function generateReport(sessionId: number, opponentName: string, sourceType: string, youtubeVideoId: string | null) {
  try {
    const prompt = `You are an elite football scouting analyst. Generate a comprehensive scouting report for the opponent "${opponentName}".
${sourceType === "youtube" && youtubeVideoId ? `YouTube Video ID: ${youtubeVideoId}` : ""}

Generate a detailed scouting report as a JSON object with this exact structure:
{
  "executive_summary": "2-3 paragraph overview of the opponent's strengths, weaknesses, and overall game plan",
  "offense_analysis": "Detailed analysis of offensive formations, personnel groupings, run/pass tendencies, route concepts, and key playmakers",
  "defense_analysis": "Coverage shells (Cover 1/2/3/4), blitz packages, front alignments, and defensive tendencies",
  "special_situations": "Red zone, 3rd down, 2-minute drill, and goal line tendencies",
  "mistakes": "Key mistakes, blown coverages, missed assignments, and exploitable weaknesses",
  "predictions": "Predicted game plan, likely adjustments, and recommended counter-strategies",
  "highlights": [
    {
      "timestamp": "MM:SS",
      "seconds": 0,
      "title": "Short title of the play",
      "note": "Detailed description of what happened",
      "category": "offense" | "defense" | "special" | "mistake",
      "verdict": "good" | "bad"
    }
  ]
}

Generate between 6 and 12 highlights. Make the analysis specific, tactical, and actionable for a coaching staff. Return ONLY valid JSON.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You are an elite football scouting analyst. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scouting_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              executive_summary: { type: "string" },
              offense_analysis: { type: "string" },
              defense_analysis: { type: "string" },
              special_situations: { type: "string" },
              mistakes: { type: "string" },
              predictions: { type: "string" },
              highlights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    seconds: { type: "number" },
                    title: { type: "string" },
                    note: { type: "string" },
                    category: { type: "string", enum: ["offense", "defense", "special", "mistake"] },
                    verdict: { type: "string", enum: ["good", "bad"] },
                  },
                  required: ["timestamp", "seconds", "title", "note", "category", "verdict"],
                  additionalProperties: false,
                },
              },
            },
            required: ["executive_summary", "offense_analysis", "defense_analysis", "special_situations", "mistakes", "predictions", "highlights"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const reportData = JSON.parse(content as string);

    await db.createScoutingReport({
      sessionId,
      executiveSummary: reportData.executive_summary,
      offenseAnalysis: reportData.offense_analysis,
      defenseAnalysis: reportData.defense_analysis,
      specialSituations: reportData.special_situations,
      mistakes: reportData.mistakes,
      predictions: reportData.predictions,
      highlights: reportData.highlights,
    });

    await db.updateGameSessionStatus(sessionId, "complete");
  } catch (error) {
    console.error("[Report Generation] Error:", error);
    await db.updateGameSessionStatus(sessionId, "failed");
  }
}

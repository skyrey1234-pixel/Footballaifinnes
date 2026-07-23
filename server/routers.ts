import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { analyzeFootballVideo, cleanupAnalysisTemp, type VideoAnalysis } from "./videoAnalysis";
import { generateImage } from "./_core/imageGeneration";
import { stripeRouter } from "./stripeRoutes";
import { canAccessFeature } from "./stripe";
import { warRoomRouter } from "./warRoomRouter";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  stripe: stripeRouter,
  warRoom: warRoomRouter,
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
        // Trigger async analysis (grounded in the uploaded footage when present)
        generateReport(
          sessionId,
          input.opponentName,
          input.sourceType,
          input.youtubeVideoId || null,
          input.videoFileKey || null
        ).catch(err => {
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

    reanalyze: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        // Delete existing report
        await db.deleteReportBySessionId(input.id);
        // Reset status
        await db.updateGameSessionStatus(input.id, "analyzing");
        // Re-trigger analysis
        generateReport(input.id, session.opponentName, session.sourceType, session.youtubeVideoId || null).catch(err => {
          console.error("[Re-Analysis] Failed:", err);
        });
        return { success: true, message: "Re-analysis started" };
      }),
  }),

  reports: router({
    getBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const report = await db.getReportBySessionId(input.sessionId);
        return report || null;
      }),

    exportPdf: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND" });

        const highlights = (report.highlights as Array<{ timestamp: string; title: string; note: string; category: string; verdict: string }>) || [];

        // Generate HTML for PDF conversion
        const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; padding: 40px; line-height: 1.6; }
  h1 { color: #0D1117; border-bottom: 3px solid #00FF87; padding-bottom: 10px; font-size: 28px; }
  h2 { color: #0D1117; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin-top: 30px; font-size: 20px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
  .section { margin-bottom: 24px; }
  .section p { font-size: 14px; white-space: pre-wrap; }
  .highlight { border-left: 3px solid #00FF87; padding: 8px 12px; margin: 8px 0; background: #f8f9fa; }
  .highlight .time { font-weight: bold; color: #00FF87; }
  .highlight .title { font-weight: bold; }
  .highlight .note { font-size: 13px; color: #555; }
  .badge-good { display: inline-block; background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .badge-bad { display: inline-block; background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .footer { margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 10px; font-size: 12px; color: #999; text-align: center; }
</style>
</head>
<body>
  <h1>Scouting Report: ${session.opponentName}</h1>
  <div class="meta">
    <p>Game Date: ${session.gameDate || "Not specified"} | Generated: ${new Date().toLocaleDateString()}</p>
    <p>Source: ${session.sourceType === "youtube" ? "YouTube Analysis" : "Video Upload"}</p>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.executiveSummary || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Offense Analysis</h2>
    <p>${report.offenseAnalysis || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Defense Analysis</h2>
    <p>${report.defenseAnalysis || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Special Situations</h2>
    <p>${report.specialSituations || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Mistakes & Exploitable Weaknesses</h2>
    <p>${report.mistakes || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Predictions & Recommendations</h2>
    <p>${report.predictions || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Key Highlights (${highlights.length})</h2>
    ${highlights.map(h => `
      <div class="highlight">
        <span class="time">${h.timestamp}</span> &mdash; <span class="title">${h.title}</span>
        <span class="${h.verdict === "good" ? "badge-good" : "badge-bad"}">${h.verdict === "good" ? "Good Play" : "Mistake"}</span>
        <br/><span class="note">${h.note}</span>
      </div>
    `).join("")}
  </div>

  <div class="footer">
    <p>Generated by TacticalEdge AI &mdash; AI-Powered Football Scouting</p>
  </div>
</body>
</html>`;

        // Store as HTML file that can be printed/saved as PDF from browser
        const fileKey = `reports/scouting-report-${session.opponentName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.html`;
        const result = await storagePut(fileKey, Buffer.from(html, "utf-8"), "text/html");
        return { url: result.url, filename: `Scouting-Report-${session.opponentName}.html` };
      }),

    generateDiagram: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        playDescription: z.string(),
        formationType: z.enum(["offense", "defense"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });

        // Use LLM to generate a detailed image prompt for X's and O's diagram
        const diagramPromptResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are a football diagram specialist. Generate a concise image generation prompt for creating a clean X's and O's football play diagram." },
            { role: "user", content: `Create an image prompt for a football play diagram based on this description: "${input.playDescription}". The diagram should show player positions as X's (offense) and O's (defense), with arrows showing routes/movements. Clean white background, professional coaching diagram style. Keep the prompt under 100 words.` },
          ],
        });

        const imagePrompt = typeof diagramPromptResponse.choices?.[0]?.message?.content === "string"
          ? diagramPromptResponse.choices[0].message.content
          : `Football X's and O's play diagram showing: ${input.playDescription}. Clean white background, professional coaching style with player positions marked as X and O symbols, arrows showing routes and movements.`;

        // Generate the diagram image
        const imageResult = await generateImage({
          prompt: imagePrompt + " Wide 16:9 aspect ratio layout.",
        });

        return { imageUrl: imageResult.url, prompt: imagePrompt };
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
        // Get a real S3 presigned PUT URL from Forge so the browser can
        // upload the video directly to S3 — the file never touches this
        // server, avoiding the 512MB memory and 180s request limits.
        const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";
        if (!forgeUrl || !forgeKey) {
          throw new Error("Storage is not configured");
        }
        const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileKey = `videos/${ctx.user.id}-${Date.now()}-${safeName}`;
        const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
        presignUrl.searchParams.set("path", fileKey);
        const resp = await fetch(presignUrl, {
          headers: { Authorization: `Bearer ${forgeKey}` },
        });
        if (!resp.ok) {
          const msg = await resp.text().catch(() => resp.statusText);
          console.error("[Upload] Presign failed:", resp.status, msg);
          throw new Error("Could not prepare the upload. Please try again.");
        }
        const { url } = (await resp.json()) as { url: string };
        if (!url) throw new Error("Could not prepare the upload. Please try again.");
        return { fileKey, uploadUrl: url };
      }),
  }),

  season: router({
    stats: protectedProcedure.query(async () => {
      return await db.getSeasonStats();
    }),

    opponentTrends: protectedProcedure
      .input(z.object({ opponentName: z.string() }))
      .query(async ({ input }) => {
        return await db.getOpponentTrends(input.opponentName);
      }),
  }),

  players: router({
    listBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getPlayerProfilesBySession(input.sessionId);
      }),

    listByOpponent: protectedProcedure
      .input(z.object({ opponentName: z.string() }))
      .query(async ({ input }) => {
        return await db.getPlayerProfilesByOpponent(input.opponentName);
      }),

    generate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND" });

        const prompt = `You are an elite football scout. Based on this scouting report, identify the key opposing players and generate detailed tendency profiles for each.

Opponent: ${session.opponentName}
Offense Analysis: ${report.offenseAnalysis || "N/A"}
Defense Analysis: ${report.defenseAnalysis || "N/A"}
Mistakes: ${report.mistakes || "N/A"}

Generate player profiles as a JSON array. Each profile should include:
{
  "players": [
    {
      "playerNumber": "#7",
      "playerName": "Estimated name or position label (e.g. 'Starting QB')",
      "position": "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "CB" | "S" | "K" | "P",
      "tendencies": [
        { "tendency": "Scrambles right 65% of the time", "frequency": "65%", "situation": "Under pressure" },
        { "tendency": "Throws deep on play-action", "frequency": "40%", "situation": "2nd and long" }
      ],
      "strengths": "Key strengths of this player",
      "weaknesses": "Key weaknesses and exploitable habits",
      "threatLevel": "low" | "medium" | "high" | "elite",
      "notes": "Additional coaching notes"
    }
  ]
}

Generate 3-6 key player profiles. Focus on the most impactful players mentioned or implied in the report. Return ONLY valid JSON.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an elite football scout. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "player_profiles",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  players: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        playerNumber: { type: "string" },
                        playerName: { type: "string" },
                        position: { type: "string" },
                        tendencies: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              tendency: { type: "string" },
                              frequency: { type: "string" },
                              situation: { type: "string" },
                            },
                            required: ["tendency", "frequency", "situation"],
                            additionalProperties: false,
                          },
                        },
                        strengths: { type: "string" },
                        weaknesses: { type: "string" },
                        threatLevel: { type: "string", enum: ["low", "medium", "high", "elite"] },
                        notes: { type: "string" },
                      },
                      required: ["playerNumber", "playerName", "position", "tendencies", "strengths", "weaknesses", "threatLevel", "notes"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["players"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "{}";
        let playersData: Array<{ playerNumber: string; playerName: string; position: string; tendencies: unknown; strengths: string; weaknesses: string; threatLevel: string; notes: string }> = [];
        try {
          const parsed = JSON.parse(content);
          playersData = parsed.players || [];
        } catch {
          playersData = [];
        }

        // Save to database
        const savedIds: number[] = [];
        for (const p of playersData) {
          const id = await db.createPlayerProfile({
            sessionId: input.sessionId,
            opponentName: session.opponentName,
            playerNumber: p.playerNumber,
            playerName: p.playerName || null,
            position: p.position || null,
            tendencies: p.tendencies,
            strengths: p.strengths || null,
            weaknesses: p.weaknesses || null,
            threatLevel: (p.threatLevel as "low" | "medium" | "high" | "elite") || "medium",
            notes: p.notes || null,
          });
          savedIds.push(id);
        }

        return { count: savedIds.length, playerIds: savedIds };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlayerProfile(input.id);
        return { success: true };
      }),
  }),

  gamePlan: router({
    generate: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        teamStrengths: z.string().optional(),
        teamFormation: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Server-side tier enforcement
        const dbUser = await db.getUserById(ctx.user.id);
        const tier = (dbUser as any)?.subscriptionTier || "free";
        const isAdmin = (dbUser as any)?.role === "admin";
        if (!isAdmin && !canAccessFeature(tier, "game_plan")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Game Plan Generator requires the Strategist plan or higher. Please upgrade to access this feature.",
          });
        }

        const session = await db.getGameSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND", message: "Session or report not found" });

        const playerProfiles = await db.getPlayerProfilesBySession(input.sessionId);
        const playerContext = playerProfiles.length > 0
          ? `\n\nKey Player Profiles:\n${playerProfiles.map(p => `- ${p.playerNumber} ${p.playerName || ""} (${p.position}) — Threat: ${p.threatLevel}. Weaknesses: ${p.weaknesses || "Unknown"}`).join("\n")}`
          : "";

        const prompt = `You are an elite football coordinator preparing a game plan against "${session.opponentName}". 

SCOUTING INTEL:
Executive Summary: ${report.executiveSummary || "N/A"}
Opponent Offense: ${report.offenseAnalysis || "N/A"}
Opponent Defense: ${report.defenseAnalysis || "N/A"}
Special Situations: ${report.specialSituations || "N/A"}
Opponent Mistakes: ${report.mistakes || "N/A"}
Predictions: ${report.predictions || "N/A"}
${playerContext}
${input.teamStrengths ? `\nOUR TEAM STRENGTHS: ${input.teamStrengths}` : ""}
${input.teamFormation ? `\nOUR BASE FORMATION: ${input.teamFormation}` : ""}

Generate a COMPLETE GAME PLAN. Make every recommendation SPECIFIC to this opponent based on the scouting intel above.`;

        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: "You are an elite football coordinator. Generate detailed, specific game plans." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "game_plan",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    overview: { type: "string", description: "2-3 sentence game plan philosophy" },
                    opponentDefenseScheme: { type: "string", description: "Opponent base defensive scheme e.g. 4-3, 3-4, nickel" },
                    scriptedPlays: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          playNumber: { type: "number" },
                          name: { type: "string" },
                          formation: { type: "string" },
                          type: { type: "string", description: "run, pass, play-action, screen, or rpo" },
                          target: { type: "string" },
                          why: { type: "string" },
                          defenseExpected: { type: "string" },
                        },
                        required: ["playNumber", "name", "formation", "type", "target", "why", "defenseExpected"],
                        additionalProperties: false,
                      },
                    },
                    redZonePackage: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          formation: { type: "string" },
                          situation: { type: "string" },
                          target: { type: "string" },
                          why: { type: "string" },
                          defenseExpected: { type: "string" },
                        },
                        required: ["name", "formation", "situation", "target", "why", "defenseExpected"],
                        additionalProperties: false,
                      },
                    },
                    thirdDownConversions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          situation: { type: "string" },
                          name: { type: "string" },
                          formation: { type: "string" },
                          concept: { type: "string" },
                          target: { type: "string" },
                          expectedResult: { type: "string" },
                          defenseExpected: { type: "string" },
                        },
                        required: ["situation", "name", "formation", "concept", "target", "expectedResult", "defenseExpected"],
                        additionalProperties: false,
                      },
                    },
                    defensiveAdjustments: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          situation: { type: "string" },
                          adjustment: { type: "string" },
                          keyPlayer: { type: "string" },
                          why: { type: "string" },
                        },
                        required: ["situation", "adjustment", "keyPlayer", "why"],
                        additionalProperties: false,
                      },
                    },
                    keyMatchups: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          ourPlayer: { type: "string" },
                          theirPlayer: { type: "string" },
                          strategy: { type: "string" },
                          alert: { type: "string" },
                        },
                        required: ["ourPlayer", "theirPlayer", "strategy", "alert"],
                        additionalProperties: false,
                      },
                    },
                    halftimeChecklist: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["overview", "opponentDefenseScheme", "scriptedPlays", "redZonePackage", "thirdDownConversions", "defensiveAdjustments", "keyMatchups", "halftimeChecklist"],
                  additionalProperties: false,
                },
              },
            },
            maxTokens: 16000,
          });

          let content = typeof response.choices?.[0]?.message?.content === "string"
            ? response.choices[0].message.content
            : Array.isArray(response.choices?.[0]?.message?.content)
              ? (response.choices[0].message.content.find((c: any) => c.type === "text") as any)?.text || "{}"
              : "{}";

          // Strip markdown code fences if present
          content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

          const parsed = JSON.parse(content);
          return {
            overview: parsed.overview || "Game plan generated successfully.",
            opponentDefenseScheme: parsed.opponentDefenseScheme || "4-3",
            scriptedPlays: parsed.scriptedPlays || [],
            redZonePackage: parsed.redZonePackage || [],
            thirdDownConversions: parsed.thirdDownConversions || [],
            defensiveAdjustments: parsed.defensiveAdjustments || [],
            keyMatchups: parsed.keyMatchups || [],
            halftimeChecklist: parsed.halftimeChecklist || [],
          };
        } catch (error: any) {
          console.error("[GamePlan] Generation failed:", error?.message || error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to generate game plan: ${error?.message || "Unknown error"}. Please try again.` });
        }
      }),
  }),
  mistakeAnalysis: router({
    get: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const row = await db.getMistakeAnalysisBySession(input.sessionId);
        return row ? { plays: row.plays as any[], createdAt: row.createdAt } : null;
      }),
    generate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND", message: "Session or report not found" });
        const prompt = `You are an elite football coach reviewing game film of "${session.opponentName}".
SCOUTING INTEL:
Executive Summary: ${report.executiveSummary || "N/A"}
Offense: ${report.offenseAnalysis || "N/A"}
Defense: ${report.defenseAnalysis || "N/A"}
Mistakes Observed: ${report.mistakes || "N/A"}

Identify 4 specific plays where a mistake or breakdown occurred (based on the mistakes/analysis above). For each play, describe BOTH what actually happened (the mistake) AND what the correct execution should have looked like, so the two can be animated side by side.`;
        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: "You are an elite football coach who breaks down play mistakes visually. Use ONLY these formations: Shotgun Spread, Shotgun, Trips Right, I-Form, Pistol, Twins 2x2, Empty 5 Wide, Goal Line Jumbo. Use ONLY these play types: run, pass, play-action, screen. Use ONLY these targets: X, Y, Z, H, RB, FB." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "mistake_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    plays: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string", description: "Short name of the play situation" },
                          quarter: { type: "string", description: "e.g. Q2" },
                          situation: { type: "string", description: "Down and distance e.g. 3rd & 7" },
                          formation: { type: "string" },
                          playType: { type: "string" },
                          target: { type: "string" },
                          whatWentWrong: { type: "string", description: "2-3 sentences on the actual breakdown" },
                          correctExecution: { type: "string", description: "2-3 sentences on what should have happened" },
                          breakdownMoment: { type: "number", description: "Progress point 0-1 where the play broke down, e.g. 0.4" },
                          culprit: { type: "string", description: "Position label responsible e.g. RT, QB, CB" },
                          coachingPoint: { type: "string", description: "One actionable coaching cue" },
                          severity: { type: "string", description: "minor, moderate, or critical" },
                        },
                        required: ["title", "quarter", "situation", "formation", "playType", "target", "whatWentWrong", "correctExecution", "breakdownMoment", "culprit", "coachingPoint", "severity"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["plays"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices?.[0]?.message?.content;
          if (!content || typeof content !== "string") throw new Error("Empty AI response");
          const parsed = JSON.parse(content);
          const plays = parsed.plays || [];
          await db.saveMistakeAnalysis(input.sessionId, plays);
          return { plays };
        } catch (error: any) {
          console.error("[MistakeAnalysis] Generation failed:", error?.message || error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to generate mistake analysis: ${error?.message || "Unknown error"}. Please try again.` });
        }
      }),
  }),
  highlightReel: router({
    get: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const row = await db.getHighlightReelBySession(input.sessionId);
        return row ? { clips: row.clips as any[], createdAt: row.createdAt } : null;
      }),
    generate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND", message: "Session or report not found" });
        const existingHighlights = Array.isArray(report.highlights) ? (report.highlights as any[]) : [];
        const highlightContext = existingHighlights.length > 0
          ? `\n\nEXISTING KEY MOMENTS (with timestamps in seconds):\n${existingHighlights.map((h: any, i: number) => `${i + 1}. [${h.timestamp}s] ${h.title || h.description || ""}`).join("\n")}`
          : "";
        const prompt = `You are an elite football video editor creating the ULTIMATE highlight reel from the game film of "${session.opponentName}".
SCOUTING INTEL:
Executive Summary: ${report.executiveSummary || "N/A"}
Offense: ${report.offenseAnalysis || "N/A"}
Defense: ${report.defenseAnalysis || "N/A"}
Predictions: ${report.predictions || "N/A"}${highlightContext}

Select and rank the 8 BEST plays for a highlight reel. Rank by impact (game-changing plays first). If existing key moments have timestamps, reuse those exact timestamps for matching plays; distribute any additional clips across the full game duration.`;
        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: "You are an elite football video editor who selects the most impactful plays for highlight reels." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "highlight_reel",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    clips: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          rank: { type: "number", description: "1 = best play" },
                          title: { type: "string" },
                          description: { type: "string", description: "1-2 sentence description of the play" },
                          timestamp: { type: "number", description: "Start time in seconds" },
                          duration: { type: "number", description: "Clip length in seconds, 8-20" },
                          category: { type: "string", description: "touchdown, big-play, turnover, defensive-stop, special-teams, or momentum-shift" },
                          impactScore: { type: "number", description: "1-100 impact rating" },
                          players: { type: "string", description: "Key players involved e.g. #7 QB, #23 RB" },
                        },
                        required: ["rank", "title", "description", "timestamp", "duration", "category", "impactScore", "players"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["clips"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices?.[0]?.message?.content;
          if (!content || typeof content !== "string") throw new Error("Empty AI response");
          const parsed = JSON.parse(content);
          const clips = (parsed.clips || []).sort((a: any, b: any) => a.rank - b.rank);
          await db.saveHighlightReel(input.sessionId, clips);
          return { clips };
        } catch (error: any) {
          console.error("[HighlightReel] Generation failed:", error?.message || error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to generate highlight reel: ${error?.message || "Unknown error"}. Please try again.` });
        }
      }),
  }),
  playSim: router({
    grade: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        playId: z.string(),
        selectedDefense: z.string(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getGameSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Session or report not found" });
        }
        // Mock play for demo — in production, fetch from gamePlans table
        const selectedPlay = {
          id: input.playId,
          name: "Sample Play",
          formation: "I-Form",
          playType: "Run",
          description: "Inside zone run to the right",
        };
        const prompt = `You are an elite football coordinator analyzing a play call.
PLAY CALLED: ${selectedPlay.name}
FORMATION: ${selectedPlay.formation}
PLAY TYPE: ${selectedPlay.playType}
DESCRIPTION: ${selectedPlay.description}

OPPONENT DEFENSE: ${input.selectedDefense}
OPPONENT TENDENCIES: ${report.defenseAnalysis || "Unknown"}

Analyze this matchup and provide:
1. Success Likelihood (0-100): How likely this play succeeds against this defense
2. Key Coaching Notes (2-3 sentences): Why it works or doesn't work
3. Adjustment (1 sentence): How to tweak the play if it fails

Format as JSON: { "successLikelihood": number, "coachingNotes": string, "adjustment": string }`;
        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "play_grade",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  successLikelihood: { type: "integer", description: "0-100 success percentage" },
                  coachingNotes: { type: "string", description: "Analysis of the matchup" },
                  adjustment: { type: "string", description: "How to adjust if it fails" },
                },
                required: ["successLikelihood", "coachingNotes", "adjustment"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0].message.content;
        const parsed = typeof content === "string" ? JSON.parse(content) : content;
        return {
          playId: input.playId,
          selectedDefense: input.selectedDefense,
          successLikelihood: parsed.successLikelihood || 50,
          coachingNotes: parsed.coachingNotes || "Matchup analysis unavailable",
          adjustment: parsed.adjustment || "Execute as called",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ===== Async Report Generation =====

async function generateReport(sessionId: number, opponentName: string, sourceType: string, youtubeVideoId: string | null, videoFileKey?: string | null) {
  // ---- Step 1: analyze the REAL footage (if we have it) ----
  // This is the core fix: the report is now grounded in what's actually on the
  // film instead of invented from the opponent's name. If anything about the
  // vision pipeline fails, we fall back to the name-only report below.
  let vision: VideoAnalysis | null = null;
  const session = await db.getGameSession(sessionId).catch(() => undefined);
  const fileKey = videoFileKey || session?.videoFileKey || null;
  const ytId = youtubeVideoId || session?.youtubeVideoId || null;
  let tempVideoPath: string | null = null;
  if (fileKey || ytId) {
    try {
      vision = await analyzeFootballVideo({ opponentName, videoFileKey: fileKey, youtubeVideoId: ytId });
      tempVideoPath = (vision as any).localPath ?? null;
    } catch (err) {
      console.warn(
        `[Report Generation] Vision analysis unavailable for session ${sessionId}, falling back to name-only report:`,
        (err as Error).message
      );
      vision = null;
    }
  }

  try {
    // ---- Step 2: build the report prompt, grounded in vision when present ----
    const visionContext = vision
      ? `
REAL FOOTAGE ANALYSIS (from ${vision.frameCount} frames sampled across the actual game — use ONLY this; do not invent other plays):
Visual summary: ${vision.visualSummary}

Coach-visible observations:
${vision.observations.map((o) => `- ${o}`).join("\n")}

Detected plays (anchored to real timestamps in the footage):
${vision.highlights.map((h) => `- [${h.timestamp}] (${h.verdict} / ${h.category}) ${h.title}: ${h.note}`).join("\n")}
`
      : "";

    const prompt = `You are an elite football scouting analyst. Generate a comprehensive scouting report for the opponent "${opponentName}".
${sourceType === "youtube" && youtubeVideoId ? `Source: YouTube footage (youtubeVideoId=${youtubeVideoId}).` : ""}
${vision ? "" : "NOTE: No footage was analyzed for this session, so general opponent tendencies should be clearly framed as expectations, not observed facts."}

${visionContext}
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
      "timestamp": "MM:SS format — MUST match the seconds field exactly",
      "seconds": "integer second in the video where this play occurs",
      "title": "Short title of the play",
      "note": "Detailed description of what happened",
      "category": "offense" | "defense" | "special" | "mistake",
      "verdict": "good" | "bad"
    }

HIGHLIGHT RULES:
${vision
        ? "- Use the detected plays above as your highlights. Their timestamps/seconds are REAL and must be passed through unchanged. Do not fabricate new timestamps."
        : "- Timestamps are estimates only; spread them across a typical game duration (1:00-58:00) and never duplicate. Mark them as approximate."}
- Each highlight must have a UNIQUE seconds value. Order chronologically.
- Generate between 6 and 12 highlights.

Make the analysis specific, tactical, and actionable for a coaching staff. Return ONLY valid JSON.`;

    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are an elite football scouting analyst. Generate detailed, specific analysis." },
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

    // When we have real footage, prefer the vision-anchored highlights so the
    // "key moments" sidebar points at plays that actually exist in the film.
    if (vision && vision.highlights.length > 0) {
      reportData.highlights = vision.highlights;
    }

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
  } finally {
    await cleanupAnalysisTemp(tempVideoPath).catch(() => {});
  }
}

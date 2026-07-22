import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { stripeRouter } from "./stripeRoutes";

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
      return await db.listFightSessions();
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const session = await db.getFightSession(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        return session;
      }),

    create: adminProcedure
      .input(z.object({
        opponentFighter: z.string().min(1),
        fightDate: z.string().optional(),
        sourceType: z.enum(["youtube", "upload"]),
        youtubeVideoId: z.string().optional(),
        videoFileKey: z.string().optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sessionId = await db.createFightSession({
          userId: ctx.user.id,
          opponentFighter: input.opponentFighter,
          fightDate: input.fightDate || null,
          sourceType: input.sourceType,
          youtubeVideoId: input.youtubeVideoId || null,
          videoFileKey: input.videoFileKey || null,
          videoUrl: input.videoUrl || null,
          status: "analyzing",
        });
        // Trigger async analysis
        generateBreakdown(sessionId, input.opponentFighter, input.sourceType, input.youtubeVideoId || null).catch(err => {
          console.error("[Analysis] Failed:", err);
        });
        return { id: sessionId };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteFightSession(input.id);
        return { success: true };
      }),

    reanalyze: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getFightSession(input.id);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });
        // Delete existing breakdown
        await db.deleteBreakdownBySessionId(input.id);
        // Reset status
        await db.updateFightSessionStatus(input.id, "analyzing");
        // Re-trigger analysis
        generateBreakdown(input.id, session.opponentFighter, session.sourceType, session.youtubeVideoId || null).catch(err => {
          console.error("[Re-Analysis] Failed:", err);
        });
        return { success: true, message: "Re-analysis started" };
      }),
  }),

  reports: router({
    getBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const report = await db.getBreakdownBySessionId(input.sessionId);
        return report || null;
      }),

    exportPdf: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getFightSession(input.sessionId);
        const report = await db.getBreakdownBySessionId(input.sessionId);
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
  <h1>Fight Breakdown: ${session.opponentFighter}</h1>
  <div class="meta">
    <p>Fight Date: ${session.fightDate || "Not specified"} | Generated: ${new Date().toLocaleDateString()}</p>
    <p>Source: ${session.sourceType === "youtube" ? "YouTube Analysis" : "Video Upload"}</p>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <p>${report.executiveSummary || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Striking Analysis</h2>
    <p>${report.strikingAnalysis || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Grappling & Wrestling Analysis</h2>
    <p>${report.grapplingAnalysis || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Clinch & Cage Control</h2>
    <p>${report.clinchCageAnalysis || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Weaknesses & Openings</h2>
    <p>${report.weaknesses || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Finishing Threats & Game Plan</h2>
    <p>${report.finishingThreats || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Key Sequences (${highlights.length})</h2>
    ${highlights.map(h => `
      <div class="highlight">
        <span class="time">${h.timestamp}</span> &mdash; <span class="title">${h.title}</span>
        <span class="${h.verdict === "good" ? "badge-good" : "badge-bad"}">${h.verdict === "good" ? "Strength" : "Opening"}</span>
        <br/><span class="note">${h.note}</span>
      </div>
    `).join("")}
  </div>

  <div class="footer">
    <p>Generated by FinesseMMA AI &mdash; AI-Powered UFC Fight Scouting</p>
  </div>
</body>
</html>`;

        // Store as HTML file that can be printed/saved as PDF from browser
        const fileKey = `breakdowns/fight-breakdown-${session.opponentFighter.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.html`;
        const result = await storagePut(fileKey, Buffer.from(html, "utf-8"), "text/html");
        return { url: result.url, filename: `Fight-Breakdown-${session.opponentFighter}.html` };
      }),

    generateDiagram: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        playDescription: z.string(),
        formationType: z.enum(["offense", "defense"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getFightSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });

        // Use LLM to generate a detailed image prompt for a strike combination map
        const diagramPromptResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an MMA striking diagram specialist. Generate a concise image generation prompt for a clean strike combination map showing a fighter silhouette and the sequence of strikes." },
            { role: "user", content: `Create an image prompt for an MMA strike combination diagram based on this description: "${input.playDescription}". The diagram should show a fighter silhouette in the octagon with numbered arrows tracing the strike sequence (jab, cross, hook, kick, level change). Clean dark background, professional coaching diagram style. Keep the prompt under 100 words.` },
          ],
        });

        const imagePrompt = typeof diagramPromptResponse.choices?.[0]?.message?.content === "string"
          ? diagramPromptResponse.choices[0].message.content
          : `MMA strike combination map showing: ${input.playDescription}. Clean dark background, professional coaching style with a fighter silhouette and numbered arrows tracing punches and kicks.`;

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
        const report = await db.getBreakdownBySessionId(input.sessionId);
        const session = await db.getFightSession(input.sessionId);
        if (!report || !session) throw new TRPCError({ code: "NOT_FOUND" });

        const reportContext = `
Opponent Fighter: ${session.opponentFighter}
Fight Date: ${session.fightDate || "Unknown"}

FIGHT BREAKDOWN:
Executive Summary: ${report.executiveSummary || "N/A"}
Striking Analysis: ${report.strikingAnalysis || "N/A"}
Grappling & Wrestling Analysis: ${report.grapplingAnalysis || "N/A"}
Clinch & Cage Control: ${report.clinchCageAnalysis || "N/A"}
Weaknesses & Openings: ${report.weaknesses || "N/A"}
Finishing Threats: ${report.finishingThreats || "N/A"}
`;

        const messages = [
          {
            role: "system" as const,
            content: `You are an elite MMA coach and fight analyst assistant. You have access to the following fight breakdown and must answer questions based on it. Be specific, tactical, and concise. Reference specific strikes, combinations, takedown setups, and tendencies from the breakdown.\n\n${reportContext}`,
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
        const session = await db.getFightSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });

        const prompt = `You are an elite MMA film analyst. Analyze this exchange and generate visual annotations for a coaching film overlay.

Exchange Details:
- Opponent Fighter: ${session.opponentFighter}
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
  "alternative_play": "What our fighter should do to counter or exploit this - 2-3 sentences",
  "verdict": "mistake" | "good_play" | "key_moment"
}

Color coding rules:
- red = defensive lapse, dropped hand, exposed opening
- green = clean technique, effective strike or takedown
- yellow = key habit or tell to watch
- blue = suggested counter or angle our fighter should take
- white = neutral label

Generate 4-8 annotations that tell the story of this exchange. Return ONLY valid JSON.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an MMA film analyst. Return only valid JSON." },
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
              { type: "circle", x: 50, y: 50, radius: 8, color: "yellow", label: "Lead Hand" },
              { type: "arrow", x: 30, y: 60, x2: 70, y2: 40, color: "blue", label: "Counter Angle" },
            ],
            coaching_callout: "Analysis generated — review the exchange details above.",
            alternative_play: "Consider changing levels or circling off the cage to counter this pressure.",
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

  season: router({
    stats: protectedProcedure.query(async () => {
      return await db.getRecordStats();
    }),

    opponentTrends: protectedProcedure
      .input(z.object({ opponentFighter: z.string() }))
      .query(async ({ input }) => {
        return await db.getOpponentTrends(input.opponentFighter);
      }),
  }),

  players: router({
    listBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getFighterProfilesBySession(input.sessionId);
      }),

    listByOpponent: protectedProcedure
      .input(z.object({ opponentFighter: z.string() }))
      .query(async ({ input }) => {
        return await db.getFighterProfilesByOpponent(input.opponentFighter);
      }),

    generate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getFightSession(input.sessionId);
        const report = await db.getBreakdownBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND" });

        const prompt = `You are an elite MMA scout. Based on this fight breakdown, generate detailed tendency profiles for the opponent across the distinct "looks" or phases they show in a fight (e.g. their orthodox pressure game, their southpaw counter game, their wrestling/clinch mode, their championship-rounds pace).

Opponent Fighter: ${session.opponentFighter}
Striking Analysis: ${report.strikingAnalysis || "N/A"}
Grappling & Wrestling Analysis: ${report.grapplingAnalysis || "N/A"}
Weaknesses & Openings: ${report.weaknesses || "N/A"}

Generate fighter profiles as a JSON array. Each profile should include:
{
  "players": [
    {
      "playerNumber": "Phase 1",
      "playerName": "Short label for this look (e.g. 'Pressure Striking', 'Clinch & Takedowns')",
      "position": "Orthodox Pressure Fighter" | "Southpaw Counter-striker" | "Wrestle-boxer" | "Grappler" | "Kickboxer" | etc,
      "tendencies": [
        { "tendency": "Leads with the jab then level changes", "frequency": "60%", "situation": "First two rounds" },
        { "tendency": "Drops right hand when throwing the left hook", "frequency": "40%", "situation": "When pressured" }
      ],
      "strengths": "Key strengths in this mode",
      "weaknesses": "Key weaknesses and exploitable habits to attack",
      "threatLevel": "low" | "medium" | "high" | "elite",
      "notes": "Additional cornering notes"
    }
  ]
}

Generate 3-6 fighter profiles covering the opponent's most dangerous looks. Return ONLY valid JSON.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an elite MMA scout. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "fighter_profiles",
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
          const id = await db.createFighterProfile({
            sessionId: input.sessionId,
            opponentFighter: session.opponentFighter,
            fighterTag: p.playerNumber,
            fighterName: p.playerName || null,
            stanceStyle: p.position || null,
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
        await db.deleteFighterProfile(input.id);
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
            message: "The Fight Game Plan generator requires the Strategist plan or higher. Please upgrade to access this feature.",
          });
        }

        const session = await db.getFightSession(input.sessionId);
        const report = await db.getBreakdownBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND", message: "Session or breakdown not found" });

        const fighterProfiles = await db.getFighterProfilesBySession(input.sessionId);
        const playerContext = fighterProfiles.length > 0
          ? `\n\nOpponent Looks / Modes:\n${fighterProfiles.map(p => `- ${p.fighterTag} ${p.fighterName || ""} (${p.stanceStyle}) — Threat: ${p.threatLevel}. Weaknesses: ${p.weaknesses || "Unknown"}`).join("\n")}`
          : "";

        const prompt = `You are an elite MMA head coach building a fight game plan against "${session.opponentFighter}".

SCOUTING INTEL:
Executive Summary: ${report.executiveSummary || "N/A"}
Opponent Striking: ${report.strikingAnalysis || "N/A"}
Opponent Grappling & Wrestling: ${report.grapplingAnalysis || "N/A"}
Clinch & Cage Control: ${report.clinchCageAnalysis || "N/A"}
Opponent Weaknesses & Openings: ${report.weaknesses || "N/A"}
Finishing Threats: ${report.finishingThreats || "N/A"}
${playerContext}
${input.teamStrengths ? `\nOUR FIGHTER'S STRENGTHS: ${input.teamStrengths}` : ""}
${input.teamFormation ? `\nOUR FIGHTER'S BASE STYLE: ${input.teamFormation}` : ""}

Generate a COMPLETE FIGHT GAME PLAN. Provide:
- overview: 2-3 sentence fight strategy/philosophy
- opponentDefenseScheme: one-line description of the opponent's primary style (e.g. "Orthodox pressure boxer with heavy right hand and reactive takedowns")
- scriptedPlays: 8-15 striking combinations/sequences to establish, each with a combo name, the RANGE to use it at (as "formation"), a strike "type" (e.g. boxing combo, kick, feint-to-takedown), the "target" area, "why" it works on this opponent, and the "defenseExpected" reaction
- redZonePackage: grappling/takedown entries to use, treating "formation" as the position/entry and "situation" as when to use it
- thirdDownConversions: finishing sequences, treating "formation" as the setup and "concept" as the finish path
- defensiveAdjustments: how our fighter defends the opponent's best weapons (keyPlayer = the key threat to neutralize)
- keyMatchups: weapon-vs-weapon battles (ourPlayer = our weapon, theirPlayer = their weapon)
- halftimeChecklist: between-rounds corner checklist items
Make every recommendation SPECIFIC to this opponent based on the scouting intel above.`;

        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: "You are an elite MMA head coach. Generate detailed, specific round-by-round fight game plans." },
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
                    overview: { type: "string", description: "2-3 sentence fight game plan philosophy" },
                    opponentDefenseScheme: { type: "string", description: "One-line description of the opponent's primary style, e.g. 'Orthodox pressure boxer with reactive takedowns'" },
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
            overview: parsed.overview || "Fight game plan generated successfully.",
            opponentDefenseScheme: parsed.opponentDefenseScheme || "Balanced mixed martial artist",
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
});

export type AppRouter = typeof appRouter;

// ===== Async Fight Breakdown Generation =====

async function generateBreakdown(sessionId: number, opponentFighter: string, sourceType: string, youtubeVideoId: string | null) {
  try {
    // Try to get video duration for better timestamp distribution
    let videoDurationSecs = 0;
    if (sourceType === "youtube" && youtubeVideoId) {
      try {
        // Use noembed to get video title confirmation, then estimate duration.
        // MMA highlight reels are typically 3-10 minutes; full fights run 15-25 minutes;
        // five-round main events can run 25+ minutes. Use a reasonable default.
        const oembed = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeVideoId}`);
        const oembedData = await oembed.json();
        const title = (oembedData.title || "").toLowerCase();
        // Estimate duration based on title keywords
        if (title.includes("full fight") || title.includes("complete fight")) {
          videoDurationSecs = 1500; // ~25 min
        } else if (title.includes("highlights") || title.includes("finish") || title.includes("knockout") || title.includes("ko")) {
          videoDurationSecs = 300; // ~5 min
        } else if (title.includes("main event") || title.includes("title fight") || title.includes("5 round")) {
          videoDurationSecs = 1800; // ~30 min
        } else {
          videoDurationSecs = 900; // Default ~15 min (3-round fight)
        }
        console.log(`[Breakdown] Video "${oembedData.title}" estimated duration: ${videoDurationSecs}s`);
      } catch {
        videoDurationSecs = 900; // Default 15 min
      }
    }

    const durationMin = Math.floor(videoDurationSecs / 60);
    const prompt = `You are an elite MMA fight analyst. Generate a comprehensive fight breakdown of the opponent "${opponentFighter}".
${sourceType === "youtube" && youtubeVideoId ? `Video source: YouTube (ID: ${youtubeVideoId})` : ""}
${videoDurationSecs > 0 ? `Video duration: approximately ${durationMin} minutes (${videoDurationSecs} seconds total).` : ""}

Generate a detailed fight breakdown. Cover the opponent's striking (stance, combinations, kicks, footwork), grappling & wrestling (takedowns, scrambles, top control, submissions), clinch & cage control, exploitable weaknesses and openings, and their finishing threats plus a recommended game plan to beat them.

CRITICAL TIMESTAMP RULES FOR KEY SEQUENCES:
- The video is approximately ${durationMin} minutes long (${videoDurationSecs} seconds)
- Distribute 8-10 key sequences EVENLY across the video duration
- First sequence should be around ${Math.floor(videoDurationSecs * 0.05)} seconds (${Math.floor(videoDurationSecs * 0.05 / 60)}:${String(Math.floor(videoDurationSecs * 0.05) % 60).padStart(2, '0')})
- Last sequence should be around ${Math.floor(videoDurationSecs * 0.9)} seconds (${Math.floor(videoDurationSecs * 0.9 / 60)}:${String(Math.floor(videoDurationSecs * 0.9) % 60).padStart(2, '0')})
- Space sequences roughly ${Math.floor(videoDurationSecs / 10)} seconds apart
- Each "seconds" value MUST be unique and match its "timestamp" field exactly
- timestamp format: "MM:SS" where seconds = minutes*60 + seconds (e.g. "05:30" = 330 seconds)
- NEVER cluster all sequences in the first few minutes — spread them across the ENTIRE video

Make the analysis specific, tactical, and actionable for a fighter's corner.`;

    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are an elite MMA fight analyst. Generate detailed, specific analysis." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "fight_breakdown",
          strict: true,
          schema: {
            type: "object",
            properties: {
              executive_summary: { type: "string" },
              striking_analysis: { type: "string" },
              grappling_analysis: { type: "string" },
              clinch_cage_analysis: { type: "string" },
              weaknesses: { type: "string" },
              finishing_threats: { type: "string" },
              highlights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    seconds: { type: "number" },
                    title: { type: "string" },
                    note: { type: "string" },
                    category: { type: "string", enum: ["striking", "grappling", "clinch", "opening"] },
                    verdict: { type: "string", enum: ["good", "bad"] },
                  },
                  required: ["timestamp", "seconds", "title", "note", "category", "verdict"],
                  additionalProperties: false,
                },
              },
            },
            required: ["executive_summary", "striking_analysis", "grappling_analysis", "clinch_cage_analysis", "weaknesses", "finishing_threats", "highlights"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const reportData = JSON.parse(content as string);

    await db.createFightBreakdown({
      sessionId,
      executiveSummary: reportData.executive_summary,
      strikingAnalysis: reportData.striking_analysis,
      grapplingAnalysis: reportData.grappling_analysis,
      clinchCageAnalysis: reportData.clinch_cage_analysis,
      weaknesses: reportData.weaknesses,
      finishingThreats: reportData.finishing_threats,
      highlights: reportData.highlights,
    });

    await db.updateFightSessionStatus(sessionId, "complete");
  } catch (error) {
    console.error("[Breakdown Generation] Error:", error);
    await db.updateFightSessionStatus(sessionId, "failed");
  }
}
import { canAccessFeature } from "./stripe";

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
import { canAccessFeature } from "./stripe";

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

  fights: router({
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
        fighterName: z.string().min(1),
        division: z.string().optional(),
        fightDate: z.string().optional(),
        sourceType: z.enum(["youtube", "upload"]),
        youtubeVideoId: z.string().optional(),
        videoFileKey: z.string().optional(),
        videoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const sessionId = await db.createFightSession({
          userId: ctx.user.id,
          fighterName: input.fighterName,
          division: input.division || null,
          fightDate: input.fightDate || null,
          sourceType: input.sourceType,
          youtubeVideoId: input.youtubeVideoId || null,
          videoFileKey: input.videoFileKey || null,
          videoUrl: input.videoUrl || null,
          status: "analyzing",
        });
        // Trigger async analysis
        generateReport(sessionId, input.fighterName, input.sourceType, input.youtubeVideoId || null).catch(err => {
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
        // Delete existing report
        await db.deleteReportBySessionId(input.id);
        // Reset status
        await db.updateFightSessionStatus(input.id, "analyzing");
        // Re-trigger analysis
        generateReport(input.id, session.fighterName, session.sourceType, session.youtubeVideoId || null).catch(err => {
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
        const session = await db.getFightSession(input.sessionId);
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
  h1 { color: #0D1117; border-bottom: 3px solid #FF2D2D; padding-bottom: 10px; font-size: 28px; }
  h2 { color: #0D1117; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin-top: 30px; font-size: 20px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
  .section { margin-bottom: 24px; }
  .section p { font-size: 14px; white-space: pre-wrap; }
  .highlight { border-left: 3px solid #FF2D2D; padding: 8px 12px; margin: 8px 0; background: #f8f9fa; }
  .highlight .time { font-weight: bold; color: #FF2D2D; }
  .highlight .title { font-weight: bold; }
  .highlight .note { font-size: 13px; color: #555; }
  .badge-good { display: inline-block; background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .badge-bad { display: inline-block; background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .footer { margin-top: 40px; border-top: 1px solid #e0e0e0; padding-top: 10px; font-size: 12px; color: #999; text-align: center; }
</style>
</head>
<body>
  <h1>Fight Report: ${session.fighterName}</h1>
  <div class="meta">
    <p>Division: ${session.division || "Not specified"} | Fight Date: ${session.fightDate || "Not specified"} | Generated: ${new Date().toLocaleDateString()}</p>
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
    <h2>Grappling Analysis</h2>
    <p>${report.grapplingAnalysis || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Clinch & Cage Control</h2>
    <p>${report.clinchAndCage || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Vulnerabilities & Exploitable Habits</h2>
    <p>${report.vulnerabilities || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Game Plan & Predictions</h2>
    <p>${report.gamePlan || "N/A"}</p>
  </div>

  <div class="section">
    <h2>Key Moments (${highlights.length})</h2>
    ${highlights.map(h => `
      <div class="highlight">
        <span class="time">${h.timestamp}</span> &mdash; <span class="title">${h.title}</span>
        <span class="${h.verdict === "good" ? "badge-good" : "badge-bad"}">${h.verdict === "good" ? "Landed Clean" : "Got Caught"}</span>
        <br/><span class="note">${h.note}</span>
      </div>
    `).join("")}
  </div>

  <div class="footer">
    <p>Generated by OctagonIQ &mdash; AI-Powered MMA Fight Scouting</p>
  </div>
</body>
</html>`;

        // Store as HTML file that can be printed/saved as PDF from browser
        const fileKey = `reports/fight-report-${session.fighterName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.html`;
        const result = await storagePut(fileKey, Buffer.from(html, "utf-8"), "text/html");
        return { url: result.url, filename: `Fight-Report-${session.fighterName}.html` };
      }),

    generateDiagram: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        sequenceDescription: z.string(),
        phaseType: z.enum(["striking", "grappling"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const session = await db.getFightSession(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND" });

        // Use LLM to generate a detailed image prompt for a technique/sequence diagram
        const diagramPromptResponse = await invokeLLM({
          messages: [
            { role: "system", content: "You are an MMA technique-diagram specialist. Generate a concise image generation prompt for a clean overhead MMA cage/technique diagram." },
            { role: "user", content: `Create an image prompt for an MMA fight-sequence diagram based on this description: "${input.sequenceDescription}". The diagram should show two fighters as labeled figures inside an octagon, with arrows showing strikes, level changes, angles, and movement. Clean minimal background, professional coaching diagram style. Keep the prompt under 100 words.` },
          ],
        });

        const imagePrompt = typeof diagramPromptResponse.choices?.[0]?.message?.content === "string"
          ? diagramPromptResponse.choices[0].message.content
          : `MMA technique diagram inside an octagon showing: ${input.sequenceDescription}. Clean minimal background, professional coaching style with two labeled fighters, arrows showing strikes, angles and movement.`;

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
        const session = await db.getFightSession(input.sessionId);
        if (!report || !session) throw new TRPCError({ code: "NOT_FOUND" });

        const reportContext = `
Fighter: ${session.fighterName}
Division: ${session.division || "Unknown"}
Fight Date: ${session.fightDate || "Unknown"}

FIGHT REPORT:
Executive Summary: ${report.executiveSummary || "N/A"}
Striking Analysis: ${report.strikingAnalysis || "N/A"}
Grappling Analysis: ${report.grapplingAnalysis || "N/A"}
Clinch & Cage: ${report.clinchAndCage || "N/A"}
Vulnerabilities: ${report.vulnerabilities || "N/A"}
Game Plan: ${report.gamePlan || "N/A"}
`;

        const messages = [
          {
            role: "system" as const,
            content: `You are an elite MMA fight analyst and striking/grappling coach. You have access to the following fight report and must answer questions based on it. Be specific, tactical, and concise. Reference specific techniques, ranges, and tendencies from the report.\n\n${reportContext}`,
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
- Fighter scouted: ${session.fighterName}
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
- red = mistake, dropped hands, bad defensive posture, got caught
- green = clean technique, correct execution
- yellow = key weapon / dangerous position to watch
- blue = suggested counter, angle or level change they should have taken
- white = neutral label

Generate 4-8 annotations that tell the story of this exchange (strikes thrown, head movement, level changes, cage position). Return ONLY valid JSON.`;

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
              { type: "circle", x: 50, y: 50, radius: 8, color: "yellow", label: "Key Weapon" },
              { type: "arrow", x: 30, y: 60, x2: 70, y2: 40, color: "blue", label: "Suggested Counter" },
            ],
            coaching_callout: "Analysis generated — review the exchange details above.",
            alternative_play: "Consider changing levels or circling off the cage based on the range read.",
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

  division: router({
    stats: protectedProcedure.query(async () => {
      return await db.getDivisionStats();
    }),

    fighterTrends: protectedProcedure
      .input(z.object({ fighterName: z.string() }))
      .query(async ({ input }) => {
        return await db.getFighterTrends(input.fighterName);
      }),
  }),

  weapons: router({
    listBySession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await db.getWeaponProfilesBySession(input.sessionId);
      }),

    listByFighter: protectedProcedure
      .input(z.object({ fighterName: z.string() }))
      .query(async ({ input }) => {
        return await db.getWeaponProfilesByFighter(input.fighterName);
      }),

    generate: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ input }) => {
        const session = await db.getFightSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND" });

        const prompt = `You are an elite MMA scout. Based on this fight report, identify the fighter's signature weapons and techniques and generate detailed tendency profiles for each.

Fighter: ${session.fighterName}
Striking Analysis: ${report.strikingAnalysis || "N/A"}
Grappling Analysis: ${report.grapplingAnalysis || "N/A"}
Vulnerabilities: ${report.vulnerabilities || "N/A"}

Generate weapon profiles as a JSON array. Each profile should include:
{
  "weapons": [
    {
      "weaponName": "Left High Kick",
      "technique": "Striking" | "Wrestling" | "BJJ" | "Clinch" | "Defense",
      "tendencies": [
        { "tendency": "Sets it up behind the jab 60% of the time", "frequency": "60%", "situation": "Southpaw vs orthodox" },
        { "tendency": "Throws it when opponent circles to the lead side", "frequency": "40%", "situation": "Cage cutting" }
      ],
      "strengths": "Key strengths of this weapon",
      "weaknesses": "How to defend or counter it",
      "threatLevel": "low" | "medium" | "high" | "elite",
      "notes": "Additional coaching notes"
    }
  ]
}

Generate 3-6 signature weapon profiles. Focus on the most impactful techniques mentioned or implied in the report. Return ONLY valid JSON.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an elite MMA scout. Return only valid JSON." },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "weapon_profiles",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  weapons: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        weaponName: { type: "string" },
                        technique: { type: "string" },
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
                      required: ["weaponName", "technique", "tendencies", "strengths", "weaknesses", "threatLevel", "notes"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["weapons"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = typeof response.choices?.[0]?.message?.content === "string" ? response.choices[0].message.content : "{}";
        let weaponsData: Array<{ weaponName: string; technique: string; tendencies: unknown; strengths: string; weaknesses: string; threatLevel: string; notes: string }> = [];
        try {
          const parsed = JSON.parse(content);
          weaponsData = parsed.weapons || [];
        } catch {
          weaponsData = [];
        }

        // Save to database
        const savedIds: number[] = [];
        for (const w of weaponsData) {
          const id = await db.createWeaponProfile({
            sessionId: input.sessionId,
            fighterName: session.fighterName,
            weaponName: w.weaponName,
            technique: w.technique || null,
            tendencies: w.tendencies,
            strengths: w.strengths || null,
            weaknesses: w.weaknesses || null,
            threatLevel: (w.threatLevel as "low" | "medium" | "high" | "elite") || "medium",
            notes: w.notes || null,
          });
          savedIds.push(id);
        }

        return { count: savedIds.length, weaponIds: savedIds };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteWeaponProfile(input.id);
        return { success: true };
      }),
  }),

  fightPlan: router({
    generate: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        ourStrengths: z.string().optional(),
        ourStance: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Server-side tier enforcement
        const dbUser = await db.getUserById(ctx.user.id);
        const tier = (dbUser as any)?.subscriptionTier || "free";
        const isAdmin = (dbUser as any)?.role === "admin";
        if (!isAdmin && !canAccessFeature(tier, "fight_plan")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Fight Plan Generator requires the Head Coach plan or higher. Please upgrade to access this feature.",
          });
        }

        const session = await db.getFightSession(input.sessionId);
        const report = await db.getReportBySessionId(input.sessionId);
        if (!session || !report) throw new TRPCError({ code: "NOT_FOUND", message: "Session or report not found" });

        const weaponProfiles = await db.getWeaponProfilesBySession(input.sessionId);
        const weaponContext = weaponProfiles.length > 0
          ? `\n\nSignature Weapons:\n${weaponProfiles.map(w => `- ${w.weaponName} (${w.technique}) — Threat: ${w.threatLevel}. Counter: ${w.weaknesses || "Unknown"}`).join("\n")}`
          : "";

        const prompt = `You are an elite MMA head coach building a fight plan against "${session.fighterName}".

SCOUTING INTEL:
Executive Summary: ${report.executiveSummary || "N/A"}
Their Striking: ${report.strikingAnalysis || "N/A"}
Their Grappling: ${report.grapplingAnalysis || "N/A"}
Clinch & Cage: ${report.clinchAndCage || "N/A"}
Vulnerabilities: ${report.vulnerabilities || "N/A"}
Predictions: ${report.gamePlan || "N/A"}
${weaponContext}
${input.ourStrengths ? `\nOUR FIGHTER'S STRENGTHS: ${input.ourStrengths}` : ""}
${input.ourStance ? `\nOUR STANCE / STYLE: ${input.ourStance}` : ""}

Generate a COMPLETE FIGHT PLAN. Make every recommendation SPECIFIC to this opponent based on the scouting intel above.`;

        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: "You are an elite MMA head coach. Generate detailed, specific fight plans." },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "fight_plan",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    overview: { type: "string", description: "2-3 sentence fight plan philosophy" },
                    opponentStyle: { type: "string", description: "Opponent fighting style e.g. 'orthodox pressure boxer', 'wrestle-boxer', 'BJJ specialist'" },
                    strikingSequences: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sequenceNumber: { type: "number" },
                          name: { type: "string" },
                          range: { type: "string", description: "long, mid, pocket, or clinch" },
                          type: { type: "string", description: "combination, counter, feint, or kick setup" },
                          target: { type: "string" },
                          why: { type: "string" },
                          theirLikelyResponse: { type: "string" },
                        },
                        required: ["sequenceNumber", "name", "range", "type", "target", "why", "theirLikelyResponse"],
                        additionalProperties: false,
                      },
                    },
                    finishingSequences: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          position: { type: "string" },
                          situation: { type: "string" },
                          target: { type: "string" },
                          why: { type: "string" },
                          theirLikelyResponse: { type: "string" },
                        },
                        required: ["name", "position", "situation", "target", "why", "theirLikelyResponse"],
                        additionalProperties: false,
                      },
                    },
                    takedownAndScramblePlan: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          situation: { type: "string" },
                          name: { type: "string" },
                          entry: { type: "string" },
                          concept: { type: "string" },
                          target: { type: "string" },
                          expectedResult: { type: "string" },
                          theirLikelyResponse: { type: "string" },
                        },
                        required: ["situation", "name", "entry", "concept", "target", "expectedResult", "theirLikelyResponse"],
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
                          keyWeapon: { type: "string" },
                          why: { type: "string" },
                        },
                        required: ["situation", "adjustment", "keyWeapon", "why"],
                        additionalProperties: false,
                      },
                    },
                    styleMatchups: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          ourAdvantage: { type: "string" },
                          theirAdvantage: { type: "string" },
                          strategy: { type: "string" },
                          alert: { type: "string" },
                        },
                        required: ["ourAdvantage", "theirAdvantage", "strategy", "alert"],
                        additionalProperties: false,
                      },
                    },
                    betweenRoundsChecklist: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["overview", "opponentStyle", "strikingSequences", "finishingSequences", "takedownAndScramblePlan", "defensiveAdjustments", "styleMatchups", "betweenRoundsChecklist"],
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
            overview: parsed.overview || "Fight plan generated successfully.",
            opponentStyle: parsed.opponentStyle || "orthodox pressure striker",
            strikingSequences: parsed.strikingSequences || [],
            finishingSequences: parsed.finishingSequences || [],
            takedownAndScramblePlan: parsed.takedownAndScramblePlan || [],
            defensiveAdjustments: parsed.defensiveAdjustments || [],
            styleMatchups: parsed.styleMatchups || [],
            betweenRoundsChecklist: parsed.betweenRoundsChecklist || [],
          };
        } catch (error: any) {
          console.error("[FightPlan] Generation failed:", error?.message || error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to generate fight plan: ${error?.message || "Unknown error"}. Please try again.` });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ===== Async Report Generation =====

async function generateReport(sessionId: number, fighterName: string, sourceType: string, youtubeVideoId: string | null) {
  try {
    // Try to estimate video duration for better timestamp distribution
    let videoDurationSecs = 0;
    if (sourceType === "youtube" && youtubeVideoId) {
      try {
        // Use noembed to get video title confirmation, then estimate duration.
        // MMA highlight reels run 3-10 min; full fights run 15-25 min (3x5)
        // or 25 min (5x5) championship / main-event bouts.
        const oembed = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${youtubeVideoId}`);
        const oembedData = await oembed.json();
        const title = (oembedData.title || "").toLowerCase();
        // Estimate duration based on title keywords
        if (title.includes("full fight") || title.includes("complete fight")) {
          videoDurationSecs = 1500; // ~25 min (5 rounds)
        } else if (title.includes("highlights") || title.includes("recap") || title.includes("finish")) {
          videoDurationSecs = 360; // ~6 min
        } else if (title.includes("main event") || title.includes("title fight") || title.includes("championship")) {
          videoDurationSecs = 1500; // ~25 min
        } else {
          videoDurationSecs = 900; // Default ~15 min (3 rounds)
        }
        console.log(`[Report] Video "${oembedData.title}" estimated duration: ${videoDurationSecs}s`);
      } catch {
        videoDurationSecs = 900; // Default 15 min
      }
    }

    const durationMin = Math.floor(videoDurationSecs / 60);
    const prompt = `You are an elite MMA scouting analyst. Generate a comprehensive fight report for the fighter "${fighterName}".
${sourceType === "youtube" && youtubeVideoId ? `Video source: YouTube (ID: ${youtubeVideoId})` : ""}
${videoDurationSecs > 0 ? `Video duration: approximately ${durationMin} minutes (${videoDurationSecs} seconds total).` : ""}

Generate a detailed fight report. The analysis should cover striking, grappling, clinch/cage work, key weapons, and exploitable vulnerabilities.

CRITICAL TIMESTAMP RULES FOR KEY MOMENTS:
- The video is approximately ${durationMin} minutes long (${videoDurationSecs} seconds)
- Distribute 8-10 key moments EVENLY across the video duration
- First moment should be around ${Math.floor(videoDurationSecs * 0.05)} seconds (${Math.floor(videoDurationSecs * 0.05 / 60)}:${String(Math.floor(videoDurationSecs * 0.05) % 60).padStart(2, '0')})
- Last moment should be around ${Math.floor(videoDurationSecs * 0.9)} seconds (${Math.floor(videoDurationSecs * 0.9 / 60)}:${String(Math.floor(videoDurationSecs * 0.9) % 60).padStart(2, '0')})
- Space moments roughly ${Math.floor(videoDurationSecs / 10)} seconds apart
- Each "seconds" value MUST be unique and match its "timestamp" field exactly
- timestamp format: "MM:SS" where seconds = minutes*60 + seconds (e.g. "05:30" = 330 seconds)
- NEVER cluster all moments in the first few minutes — spread them across the ENTIRE video

Make the analysis specific, tactical, and actionable for a fighter's corner.`;

    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are an elite MMA scouting analyst. Generate detailed, specific analysis." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "fight_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              executive_summary: { type: "string" },
              striking_analysis: { type: "string" },
              grappling_analysis: { type: "string" },
              clinch_and_cage: { type: "string" },
              vulnerabilities: { type: "string" },
              game_plan: { type: "string" },
              highlights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timestamp: { type: "string" },
                    seconds: { type: "number" },
                    title: { type: "string" },
                    note: { type: "string" },
                    category: { type: "string", enum: ["striking", "grappling", "clinch", "mistake"] },
                    verdict: { type: "string", enum: ["good", "bad"] },
                  },
                  required: ["timestamp", "seconds", "title", "note", "category", "verdict"],
                  additionalProperties: false,
                },
              },
            },
            required: ["executive_summary", "striking_analysis", "grappling_analysis", "clinch_and_cage", "vulnerabilities", "game_plan", "highlights"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from LLM");

    const reportData = JSON.parse(content as string);

    await db.createFightReport({
      sessionId,
      executiveSummary: reportData.executive_summary,
      strikingAnalysis: reportData.striking_analysis,
      grapplingAnalysis: reportData.grappling_analysis,
      clinchAndCage: reportData.clinch_and_cage,
      vulnerabilities: reportData.vulnerabilities,
      gamePlan: reportData.game_plan,
      highlights: reportData.highlights,
    });

    await db.updateFightSessionStatus(sessionId, "complete");
  } catch (error) {
    console.error("[Report Generation] Error:", error);
    await db.updateFightSessionStatus(sessionId, "failed");
  }
}

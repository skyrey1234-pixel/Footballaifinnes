import { base44 } from '@/api/base44Client';

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    executive_summary: { type: "string", description: "High-level fight-scouting summary in markdown" },
    striking_analysis: { type: "string", description: "Stand-up game: boxing, kicks, range, output, combinations, footwork, southpaw/orthodox tendencies — markdown" },
    grappling_analysis: { type: "string", description: "Wrestling, takedown entries & defense, BJJ, top control, guard, submission threats — markdown" },
    clinch_and_cage: { type: "string", description: "Clinch work, cage control, dirty boxing, level changes, championship-round conditioning — markdown" },
    vulnerabilities: { type: "string", description: "Defensive holes, bad habits, gas-tank issues and how to exploit them — markdown" },
    game_plan: { type: "string", description: "What the fighter is likely to do and the blueprint to beat them — markdown" },
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string", description: "mm:ss in the video" },
          seconds: { type: "number", description: "timestamp in total seconds" },
          title: { type: "string" },
          note: { type: "string", description: "coaching note about this moment" },
          category: { type: "string", enum: ["striking", "grappling", "clinch", "mistake"] },
          verdict: { type: "string", enum: ["good", "bad"], description: "whether this exchange went well or went wrong for the fighter being scouted" }
        }
      }
    }
  },
  required: ["executive_summary", "striking_analysis", "grappling_analysis", "clinch_and_cage", "vulnerabilities", "game_plan", "highlights"]
};

export async function runAnalysis(session) {
  let prompt = `You are an elite MMA fight analyst and head coach. Analyze the provided fight footage of "${session.fighter_name}" and produce a complete 360-degree fight report for the coaching corner.

Cover in depth:
1. STRIKING — stance, range management, favorite combinations, kick game, output volume, power vs volume, head movement and defensive striking.
2. GRAPPLING — takedown entries and success rate, takedown defense, top control and ground-and-pound, guard, scrambles, submission threats and defense.
3. CLINCH & CAGE — clinch work, dirty boxing, cage control, level changes, and how they hold up in the championship rounds.
4. VULNERABILITIES — defensive holes, exploitable habits, gas-tank/conditioning issues, and what beats them.
5. GAME PLAN — what they are most likely to do and a specific blueprint to defeat them.

Also produce 6-12 timestamped key moments from the footage with precise timestamps in VIDEO time (so the clip can be played at that exact moment), sharp coaching notes, and a verdict of "good" or "bad" for whether the exchange went well or went wrong for the fighter being scouted. Write everything in confident, practical coach-speak using markdown with bold key terms and bullet points.`;

  const params = {
    prompt,
    response_json_schema: REPORT_SCHEMA,
    model: 'gemini_3_1_pro'
  };

  if (session.source_type === 'youtube') {
    params.prompt += `\n\nThe fight footage is this YouTube video: https://www.youtube.com/watch?v=${session.youtube_video_id}

Search the web to identify exactly which fight this video shows (fighters, event, date, result). Then build the full fight report using round-by-round data, official stats (significant strikes, takedowns, control time), recaps, and your expert film knowledge of these fighters' styles and tendencies. For key moments, use pivotal exchanges of the fight with their approximate timing (use 0 for seconds if unknown).

CRITICAL: You MUST completely fill EVERY field of the report with detailed, specific analysis. Never leave any field empty or null.`;
    params.add_context_from_internet = true;
  } else {
    params.file_urls = [session.video_url];
    params.prompt += `\n\nCRITICAL: You MUST completely fill EVERY field of the report with detailed, specific analysis based on the attached footage. Never leave any field empty or null.`;
  }

  const result = await base44.integrations.Core.InvokeLLM(params);
  if (!result || !result.executive_summary) {
    throw new Error('Analysis returned an empty report');
  }
  const report = await base44.entities.FightReport.create({ session_id: session.id, ...result });
  await base44.entities.FightSession.update(session.id, { status: 'complete' });
  return report;
}

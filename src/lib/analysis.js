import { base44 } from '@/api/base44Client';

const REPORT_SCHEMA = {
  type: "object",
  properties: {
    executive_summary: { type: "string", description: "High-level scouting summary in markdown" },
    offense_analysis: { type: "string", description: "Offensive formations, tendencies, route concepts, key personnel — markdown" },
    defense_analysis: { type: "string", description: "Coverage schemes, blitz packages, front alignments, weak spots — markdown" },
    special_situations: { type: "string", description: "3rd down, red zone, 2-minute drill, 4th down tendencies — markdown" },
    mistakes: { type: "string", description: "Mistakes, missed assignments and what could have been done better — markdown" },
    predictions: { type: "string", description: "What the opponent is likely to do next and how to counter it — markdown" },
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string", description: "mm:ss in the video" },
          seconds: { type: "number", description: "timestamp in total seconds" },
          title: { type: "string" },
          note: { type: "string", description: "coaching note about this moment" },
          category: { type: "string", enum: ["offense", "defense", "special", "mistake"] }
        }
      }
    }
  }
};

export async function runAnalysis(session) {
  let prompt = `You are an elite American football scouting analyst and coordinator. Analyze the provided game footage of the opponent "${session.opponent_name}" and produce a complete 360-degree halftime scouting report for the coaching staff.

Cover in depth:
1. OFFENSE — formations they favor, personnel groupings, run/pass tendencies by down and distance, route concepts, star players and how they're used.
2. DEFENSE — base front, coverage shells (man/zone, Cover 1/2/3/4), blitz packages and when they bring pressure, exploitable weak spots.
3. SPECIAL SITUATIONS — what they call on 3rd down, in the red zone, 4th and short, and the 2-minute drill.
4. MISTAKES — errors, missed assignments, and what could have been done better against them.
5. PREDICTIONS — what they are most likely to do in the second half / next matchup and specific counters to call.

Also produce 6-12 timestamped highlight moments from the footage with precise timestamps and sharp coaching notes. Write everything in confident, practical coach-speak using markdown with bold key terms and bullet points.`;

  const params = {
    prompt,
    response_json_schema: REPORT_SCHEMA,
    model: 'gemini_3_1_pro'
  };

  if (session.source_type === 'youtube') {
    params.prompt += `\n\nThe game footage is this YouTube video: https://www.youtube.com/watch?v=${session.youtube_video_id} — analyze this specific game.`;
    params.add_context_from_internet = true;
  } else {
    params.file_urls = [session.video_url];
  }

  const result = await base44.integrations.Core.InvokeLLM(params);
  const report = await base44.entities.ScoutingReport.create({ session_id: session.id, ...result });
  await base44.entities.GameSession.update(session.id, { status: 'complete' });
  return report;
}
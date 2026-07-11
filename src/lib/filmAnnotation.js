import { base44 } from '@/api/base44Client';

/**
 * Schema for a single annotation overlay on a video frame.
 * All positions are in percentages (0-100) of the frame dimensions.
 */
const ANNOTATION_SCHEMA = {
  type: 'object',
  properties: {
    annotations: {
      type: 'array',
      description: 'List of visual annotations to draw on the video frame',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['circle', 'arrow', 'zone', 'label'],
            description: 'circle = highlight a player/spot, arrow = show movement/direction, zone = shade an area, label = text callout'
          },
          color: {
            type: 'string',
            enum: ['red', 'green', 'yellow', 'blue', 'white'],
            description: 'red = mistake/danger, green = good play/opportunity, yellow = caution/key player, blue = suggested route/movement, white = neutral label'
          },
          x: { type: 'number', description: 'X position as percentage of frame width (0=left, 100=right)' },
          y: { type: 'number', description: 'Y position as percentage of frame height (0=top, 100=bottom)' },
          x2: { type: 'number', description: 'For arrows and zones: end X position as percentage' },
          y2: { type: 'number', description: 'For arrows and zones: end Y position as percentage' },
          radius: { type: 'number', description: 'For circles: radius as percentage of frame width (default 5)' },
          label: { type: 'string', description: 'Short coaching label (max 6 words) shown near the annotation' },
          pulse: { type: 'boolean', description: 'Whether this annotation should pulse/animate to draw attention' }
        },
        required: ['type', 'color', 'x', 'y', 'label']
      }
    },
    coaching_callout: {
      type: 'string',
      description: 'One bold coaching sentence (max 15 words) shown as the main overlay text on the frame'
    },
    alternative_play: {
      type: 'string',
      description: 'What the team SHOULD have done instead — one sentence, coach-speak style'
    },
    verdict: {
      type: 'string',
      enum: ['mistake', 'good_play', 'key_moment'],
      description: 'Overall verdict for this frame'
    }
  },
  required: ['annotations', 'coaching_callout', 'verdict']
};

/**
 * Generate AI annotations for a single highlight moment.
 * @param {Object} highlight - The highlight object from the scouting report
 * @param {Object} session - The game session
 * @param {string} reportContext - Brief context from the full report
 * @returns {Promise<Object>} Annotation data
 */
export async function generateHighlightAnnotations(highlight, session, reportContext) {
  const isYouTube = session.source_type === 'youtube';

  const prompt = `You are an elite football film analyst and visual coach. You are annotating a specific play frame from game footage.

PLAY CONTEXT:
- Opponent: ${session.opponent_name}
- Timestamp: ${highlight.timestamp}
- Play Title: ${highlight.title}
- Coaching Note: ${highlight.note}
- Category: ${highlight.category}
- Verdict: ${highlight.verdict === 'bad' ? 'MISTAKE / WENT WRONG' : 'GOOD PLAY / WENT WELL'}
- Report Context: ${reportContext}

YOUR TASK:
Generate precise visual annotations to overlay on this video frame. Think like a coach drawing on a whiteboard:

1. CIRCLES — Draw circles around players who made mistakes or key players to watch. Use RED for mistakes, GREEN for good execution, YELLOW for key players to watch.

2. ARROWS — Show where players moved, where they SHOULD have moved, or passing lanes. Use BLUE for suggested/correct routes, RED for wrong routes taken.

3. ZONES — Shade areas that are open (GREEN), dangerous (RED), or key coverage zones (BLUE).

4. LABELS — Short coaching callouts like "MISSED BLOCK", "OPEN ROUTE", "WRONG COVERAGE", "KEY PLAYER", "SHOULD GO HERE".

Position everything using percentages of the frame (0-100 for both X and Y). Think about where players typically are on a football field:
- Offensive line: center of frame, y around 45-55%
- Wide receivers: left/right edges, x around 5-20% or 80-95%
- Quarterback: center-back, x around 45-55%, y around 55-65%
- Defensive backs: spread across frame, y around 25-40%
- Running back: behind QB, y around 60-70%

For a ${highlight.category} play that ${highlight.verdict === 'bad' ? 'went wrong' : 'went well'}:
- If MISTAKE: circle the player(s) who messed up in RED, show with arrows where they should have gone in BLUE, label what went wrong
- If GOOD PLAY: circle the key player(s) in GREEN, show the route/movement that worked in GREEN arrows, label what they did right
- Always add at least one annotation showing the ALTERNATIVE or CORRECT play

Generate 3-6 annotations total. Make them feel like a real coach drawing on film.`;

  const params = {
    prompt,
    response_json_schema: ANNOTATION_SCHEMA,
    model: 'gemini_3_1_pro'
  };

  if (isYouTube) {
    params.add_context_from_internet = true;
    params.prompt += `\n\nThe footage is from: https://www.youtube.com/watch?v=${session.youtube_video_id} at timestamp ${highlight.timestamp}. Use your knowledge of this game and typical football field positioning to place annotations accurately.`;
  }

  try {
    const result = await base44.integrations.Core.InvokeLLM(params);
    return result;
  } catch (err) {
    console.error('Annotation generation failed:', err);
    // Return a fallback annotation so the UI doesn't break
    return {
      annotations: [
        {
          type: 'circle',
          color: highlight.verdict === 'bad' ? 'red' : 'green',
          x: 50,
          y: 50,
          radius: 6,
          label: highlight.verdict === 'bad' ? 'Key Mistake' : 'Good Play',
          pulse: true
        }
      ],
      coaching_callout: highlight.title,
      alternative_play: highlight.note,
      verdict: highlight.verdict === 'bad' ? 'mistake' : 'good_play'
    };
  }
}

/**
 * Generate annotations for all highlights in a report.
 * Runs sequentially to avoid rate limiting.
 * @param {Array} highlights - Array of highlight objects
 * @param {Object} session - The game session
 * @param {Object} report - The full scouting report
 * @returns {Promise<Array>} Array of annotation objects indexed to highlights
 */
export async function generateAllAnnotations(highlights, session, report) {
  const reportContext = `${report.executive_summary?.slice(0, 300) || ''}`;
  const results = [];

  for (const highlight of highlights) {
    const annotation = await generateHighlightAnnotations(highlight, session, reportContext);
    results.push(annotation);
  }

  return results;
}

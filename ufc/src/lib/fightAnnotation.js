import { base44 } from '@/api/base44Client';

/**
 * Schema for a single annotation overlay on a fight-video frame.
 * All positions are in percentages (0-100) of the frame dimensions.
 */
const ANNOTATION_SCHEMA = {
  type: 'object',
  properties: {
    annotations: {
      type: 'array',
      description: 'List of visual annotations to draw on the fight frame',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['circle', 'arrow', 'zone', 'label'],
            description: 'circle = highlight a fighter/target, arrow = show a strike/level change/movement, zone = shade an area, label = text callout'
          },
          color: {
            type: 'string',
            enum: ['red', 'green', 'yellow', 'blue', 'white'],
            description: 'red = mistake/got caught, green = clean technique/opportunity, yellow = key weapon/danger, blue = suggested counter or angle, white = neutral label'
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
      description: 'What the fighter SHOULD have done instead — one sentence, coach-speak style'
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
 * Generate AI annotations for a single key-moment exchange.
 * @param {Object} highlight - The highlight object from the fight report
 * @param {Object} session - The fight session
 * @param {string} reportContext - Brief context from the full report
 * @returns {Promise<Object>} Annotation data
 */
export async function generateHighlightAnnotations(highlight, session, reportContext) {
  const isYouTube = session.source_type === 'youtube';

  const prompt = `You are an elite MMA film analyst and visual coach. You are annotating a specific exchange from fight footage.

EXCHANGE CONTEXT:
- Fighter scouted: ${session.fighter_name}
- Timestamp: ${highlight.timestamp}
- Title: ${highlight.title}
- Coaching Note: ${highlight.note}
- Category: ${highlight.category}
- Verdict: ${highlight.verdict === 'bad' ? 'MISTAKE / GOT CAUGHT' : 'CLEAN / WENT WELL'}
- Report Context: ${reportContext}

YOUR TASK:
Generate precise visual annotations to overlay on this video frame. Think like a striking/grappling coach breaking down tape:

1. CIRCLES — Draw circles around a fighter's head, hands, hips or a target. Use RED for who got caught / a defensive lapse, GREEN for clean technique, YELLOW for a key weapon or dangerous position.

2. ARROWS — Show strikes thrown, level changes, angles taken, or the counter that SHOULD have been thrown. Use BLUE for suggested/correct counters and angles, RED for the shot that landed on them.

3. ZONES — Shade open areas (GREEN), danger areas like the fence (RED), or key control positions (BLUE).

4. LABELS — Short coaching callouts like "HANDS DROPPED", "OPEN LEAD LEG", "LEVEL CHANGE HERE", "KEY WEAPON", "CIRCLE OFF THE CAGE".

Position everything using percentages of the frame (0-100 for both X and Y). Think about where fighters typically are in a striking exchange:
- Both fighters usually center frame, x around 30-70%, y around 30-70%
- Head level: y around 25-40%
- Hips / level-change target: y around 55-70%
- Lead leg / low kick target: y around 75-90%
- The cage/fence: frame edges, x near 5-15% or 85-95%

For a ${highlight.category} moment that ${highlight.verdict === 'bad' ? 'went wrong' : 'went well'}:
- If MISTAKE: circle who got caught in RED, show the counter they should have thrown in BLUE, label the defensive lapse
- If CLEAN: circle the fighter landing in GREEN, show the strike/entry that worked in GREEN arrows, label what they did right
- Always add at least one annotation showing the CORRECT counter or escape

Generate 3-6 annotations total. Make them feel like a real coach drawing on tape.`;

  const params = {
    prompt,
    response_json_schema: ANNOTATION_SCHEMA,
    model: 'gemini_3_1_pro'
  };

  if (isYouTube) {
    params.add_context_from_internet = true;
    params.prompt += `\n\nThe footage is from: https://www.youtube.com/watch?v=${session.youtube_video_id} at timestamp ${highlight.timestamp}. Use your knowledge of this fight and typical MMA exchange positioning to place annotations accurately.`;
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
          y: 40,
          radius: 6,
          label: highlight.verdict === 'bad' ? 'Got Caught' : 'Clean Shot',
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
 * Generate annotations for all key moments in a report.
 * Runs sequentially to avoid rate limiting.
 * @param {Array} highlights - Array of highlight objects
 * @param {Object} session - The fight session
 * @param {Object} report - The full fight report
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

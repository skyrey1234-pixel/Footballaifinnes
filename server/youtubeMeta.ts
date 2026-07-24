/**
 * YouTube Data API v3 helper.
 *
 * Fetches REAL video metadata (duration, title, channel) for YouTube-linked
 * sessions so the report pipeline can distribute timestamps across the actual
 * video length instead of guessing a "typical game duration".
 *
 * Requires YOUTUBE_API_KEY env. Degrades gracefully: returns null on any
 * failure so callers fall back to the previous estimation behavior.
 */

export type YouTubeVideoMeta = {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  /** Real duration in whole seconds. */
  durationSeconds: number;
  /** Human "MM:SS" or "H:MM:SS" render of durationSeconds. */
  durationLabel: string;
};

/** Parse ISO 8601 durations like "PT1H2M3S" / "PT19S" into seconds. */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return Math.round(h * 3600 + min * 60 + s);
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export async function fetchYouTubeMeta(videoId: string): Promise<YouTubeVideoMeta | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !videoId) return null;
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet` +
      `&id=${encodeURIComponent(videoId)}&key=${key}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      console.warn(`[YouTubeMeta] API error ${res.status} for video ${videoId}`);
      return null;
    }
    const body = (await res.json()) as {
      items?: Array<{
        contentDetails?: { duration?: string };
        snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
      }>;
    };
    const item = body.items?.[0];
    if (!item) return null;
    const durationSeconds = parseIsoDuration(item.contentDetails?.duration ?? "");
    if (durationSeconds <= 0) return null;
    return {
      videoId,
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      durationSeconds,
      durationLabel: formatDuration(durationSeconds),
    };
  } catch (err) {
    console.warn(`[YouTubeMeta] fetch failed for ${videoId}:`, (err as Error).message);
    return null;
  }
}

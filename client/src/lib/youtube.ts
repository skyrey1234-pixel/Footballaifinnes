const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function validVideoId(value: string | null | undefined): string | null {
  const candidate = value?.trim() ?? "";
  return YOUTUBE_VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * Accept a bare video ID or the common YouTube URL variants coaches paste:
 * watch, share, Shorts, live, embed, mobile, and privacy-enhanced embeds.
 */
export function extractYouTubeVideoId(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  const directId = validVideoId(raw);
  if (directId) return directId;

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      return validVideoId(url.pathname.split("/").filter(Boolean)[0]);
    }

    const isYouTubeHost =
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com";
    if (!isYouTubeHost) return null;

    const queryId = validVideoId(url.searchParams.get("v"));
    if (queryId) return queryId;

    const segments = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(segments[0] ?? "")) {
      return validVideoId(segments[1]);
    }
  } catch {
    return null;
  }

  return null;
}

type EmbedOptions = {
  startSeconds?: number;
  endSeconds?: number;
  autoPlay?: boolean;
  origin?: string;
};

export function buildYouTubeEmbedUrl(
  input: string | null | undefined,
  options: EmbedOptions = {},
): string | null {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;

  const params = new URLSearchParams({
    rel: "0",
    playsinline: "1",
    enablejsapi: "1",
    autoplay: options.autoPlay ? "1" : "0",
  });

  const start = Math.max(0, Math.floor(options.startSeconds ?? 0));
  if (start > 0) params.set("start", String(start));

  if (typeof options.endSeconds === "number") {
    const end = Math.max(start + 1, Math.ceil(options.endSeconds));
    params.set("end", String(end));
  }

  if (options.origin) {
    try {
      const origin = new URL(options.origin).origin;
      params.set("origin", origin);
      params.set("widget_referrer", origin);
    } catch {
      // Ignore malformed optional origins; the iframe referrer policy still applies.
    }
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function buildYouTubeWatchUrl(
  input: string | null | undefined,
  startSeconds?: number,
): string | null {
  const videoId = extractYouTubeVideoId(input);
  if (!videoId) return null;

  const url = new URL(`https://www.youtube.com/watch?v=${videoId}`);
  const start = Math.max(0, Math.floor(startSeconds ?? 0));
  if (start > 0) url.searchParams.set("t", `${start}s`);
  return url.toString();
}

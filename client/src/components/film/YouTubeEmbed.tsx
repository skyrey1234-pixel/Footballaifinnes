import { ExternalLink, Youtube } from "lucide-react";
import { buildYouTubeEmbedUrl, buildYouTubeWatchUrl } from "@/lib/youtube";

type YouTubeEmbedProps = {
  video: string;
  title?: string;
  startSeconds?: number;
  endSeconds?: number;
  autoPlay?: boolean;
  className?: string;
  overlay?: React.ReactNode;
  showExternalFallback?: boolean;
};

export default function YouTubeEmbed({
  video,
  title = "YouTube game film",
  startSeconds,
  endSeconds,
  autoPlay = false,
  className = "",
  overlay,
  showExternalFallback = true,
}: YouTubeEmbedProps) {
  const origin = typeof window === "undefined" ? undefined : window.location.origin;
  const embedUrl = buildYouTubeEmbedUrl(video, { startSeconds, endSeconds, autoPlay, origin });
  const watchUrl = buildYouTubeWatchUrl(video, startSeconds);

  if (!embedUrl || !watchUrl) {
    return (
      <div className={`flex aspect-video items-center justify-center bg-black text-sm text-zinc-400 ${className}`}>
        Invalid YouTube video link
      </div>
    );
  }

  return (
    <div className={`relative bg-black ${className}`}>
      <div className="relative aspect-video">
        <iframe
          src={embedUrl}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
        {overlay}
      </div>
      {showExternalFallback && (
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 border-t border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-400 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Youtube className="h-3.5 w-3.5 text-red-500" />
            Video unavailable here? The channel may block playback inside other websites.
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            Open {startSeconds ? "this clip" : "video"} on YouTube <ExternalLink className="h-3 w-3" />
          </span>
        </a>
      )}
    </div>
  );
}

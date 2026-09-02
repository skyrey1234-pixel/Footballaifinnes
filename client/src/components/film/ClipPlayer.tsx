import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ClipPlayer — plays ONLY a timed segment of the session video.
 * - Uploaded video (S3 URL): seeks to startSeconds, auto-pauses at endSeconds,
 *   shows a clip-scoped progress bar with replay.
 * - YouTube: embeds with start & end params so only the clip segment plays.
 */
type ClipPlayerProps = {
  sourceType: string;
  youtubeVideoId?: string | null;
  videoUrl?: string | null;
  startSeconds: number;
  clipDuration?: number; // default 12s window
  autoPlay?: boolean;
  overlay?: React.ReactNode; // annotation overlay rendered on top
  className?: string;
};

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function ClipPlayer({
  sourceType,
  youtubeVideoId,
  videoUrl,
  startSeconds,
  clipDuration = 12,
  autoPlay = false,
  overlay,
  className = "",
}: ClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [clipProgress, setClipProgress] = useState(0); // 0..1 within clip
  const [ready, setReady] = useState(false);
  const endSeconds = startSeconds + clipDuration;

  // Seek to clip start once metadata loads
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(startSeconds, Math.max(0, (v.duration || startSeconds + 1) - 0.5));
    setReady(true);
    if (autoPlay) {
      v.play().catch(() => {});
    }
  }, [startSeconds, autoPlay]);

  // Clip-bounded playback: auto-pause at endSeconds
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      setClipProgress(Math.min(Math.max((t - startSeconds) / clipDuration, 0), 1));
      if (t >= endSeconds) {
        v.pause();
        setPlaying(false);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [startSeconds, endSeconds, clipDuration]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
    } else {
      // If at/past clip end, restart the clip
      if (v.currentTime >= endSeconds - 0.2 || v.currentTime < startSeconds) {
        v.currentTime = startSeconds;
      }
      v.play().catch(() => {});
    }
  }, [playing, startSeconds, endSeconds]);

  const replayClip = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startSeconds;
    v.play().catch(() => {});
  }, [startSeconds]);

  if (sourceType === "youtube" && youtubeVideoId) {
    return (
      <div className={`relative aspect-video rounded-lg overflow-hidden bg-black border border-border ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeVideoId}?start=${Math.floor(startSeconds)}&end=${Math.ceil(endSeconds)}&autoplay=${autoPlay ? 1 : 0}&rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {overlay}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 uppercase tracking-wider pointer-events-none">
          <Film className="h-3 w-3" /> Clip {fmt(startSeconds)}–{fmt(endSeconds)}
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className={`relative aspect-video rounded-lg overflow-hidden bg-black/50 border border-border flex items-center justify-center text-muted-foreground text-sm ${className}`}>
        No video source available
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden bg-black border border-border ${className}`}>
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain bg-black"
          onLoadedMetadata={handleLoadedMetadata}
          playsInline
          preload="metadata"
        />
        {overlay}
        {/* Clip badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 uppercase tracking-wider pointer-events-none">
          <Film className="h-3 w-3" /> Clip {fmt(startSeconds)}–{fmt(endSeconds)}
        </div>
        {/* Big center play button when paused */}
        {!playing && ready && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
            aria-label="Play clip"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/90 text-black shadow-[0_0_30px_rgba(16,185,129,0.5)]">
              <Play className="h-6 w-6 ml-0.5" />
            </span>
          </button>
        )}
      </div>
      {/* Clip-scoped controls */}
      <div className="flex items-center gap-2 bg-zinc-950/95 px-3 py-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={togglePlay}>
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={replayClip}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <div className="relative h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-200"
            style={{ width: `${clipProgress * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-zinc-400 tabular-nums">
          {fmt(startSeconds + clipProgress * clipDuration)} / {fmt(endSeconds)}
        </span>
      </div>
    </div>
  );
}

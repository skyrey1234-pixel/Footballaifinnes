import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Film, Sparkles, PlayCircle, X } from "lucide-react";
import ClipPlayer from "@/components/film/ClipPlayer";

const SUGGESTIONS = ["interior run defense", "missed tackles", "pass protection breakdowns", "blitz tendencies", "red zone", "explosive plays"];

type SessionVideo = {
  sourceType: string;
  youtubeVideoId?: string | null;
  videoUrl?: string | null;
};

/** Pulsing annotation circle + label rendered on top of the clip */
function FilmCircleOverlay({ x, y, label }: { x: number; y: number; label: string }) {
  const cx = Math.min(Math.max(x, 5), 95);
  const cy = Math.min(Math.max(y, 8), 92);
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute" style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%, -50%)" }}>
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full border-4 border-yellow-400 opacity-60" />
          <span className="absolute inline-flex h-full w-full rounded-full border-[3px] border-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.7)]" />
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-yellow-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black shadow-lg">
            {label || "WATCH HERE"}
          </span>
        </span>
      </div>
      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-300">
        Circle position AI-estimated
      </span>
    </div>
  );
}

export default function AskFilmPanel({ sessionId, video }: { sessionId: number; video?: SessionVideo | null }) {
  const [query, setQuery] = useState("");
  const [watchingIdx, setWatchingIdx] = useState<number | null>(null);
  const mutation = trpc.warRoom.askFilm.useMutation({
    onSuccess: () => setWatchingIdx(null),
  });

  const search = (q: string) => {
    if (q.trim().length < 2) return;
    setQuery(q);
    mutation.mutate({ sessionId, query: q.trim() });
  };

  const hasVideo = !!video && (video.sourceType === "upload" ? !!video.videoUrl : !!video.youtubeVideoId);
  const results = mutation.data?.results ?? [];
  const watching = watchingIdx !== null ? results[watchingIdx] : null;

  return (
    <div className="space-y-5">
      {/* Search hero */}
      <div className="glass-bright rounded-2xl p-8 anim-rise relative overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-30 pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center space-y-4">
          <div className="font-tactical text-[10px] text-primary flex items-center justify-center gap-2">
            <Film className="h-3.5 w-3.5" /> ASK THE FILM ANYTHING
          </div>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search(query)}
              placeholder='e.g. "How do they handle interior runs?"'
              className="h-12 text-base bg-background/60 border-primary/25 focus-visible:ring-primary/40"
            />
            <Button size="lg" className="h-12 gap-2 glow-primary-sm active:scale-[0.97]" onClick={() => search(query)} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => search(s)} className="font-tactical text-[10px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors active:scale-[0.97]">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mutation.data && (
        <>
          <div className="glass rounded-xl p-5 anim-rise border-l-2 border-l-primary">
            <div className="font-tactical text-[10px] text-primary mb-2 flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> FILM ANSWER</div>
            <p className="text-sm leading-relaxed">{mutation.data.answer}</p>
          </div>

          {/* Inline clip theater — jumps to the exact moment with annotation circle */}
          {watching && hasVideo && video && (
            <div className="glass-bright rounded-xl p-4 anim-rise border border-yellow-400/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-tactical text-[10px] text-yellow-400">FILM EVIDENCE · {watching.timestamp || "clip"}</div>
                  <div className="text-sm font-bold">{watching.title}</div>
                </div>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setWatchingIdx(null)}>
                  <X className="h-3 w-3" /> Close
                </Button>
              </div>
              <ClipPlayer
                key={`askfilm-${watchingIdx}`}
                sourceType={video.sourceType}
                youtubeVideoId={video.youtubeVideoId}
                videoUrl={video.videoUrl}
                startSeconds={Math.max(watching.clipSeconds || 0, 0)}
                clipDuration={14}
                autoPlay
                overlay={<FilmCircleOverlay x={watching.circleX} y={watching.circleY} label={watching.circleLabel} />}
              />
              <p className="text-[11px] text-muted-foreground mt-2">{watching.evidence}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {results.map((r, i) => (
              <div key={i} className={`glass rounded-xl p-4 anim-rise-${Math.min(i + 1, 5)} hover:border-primary/30 transition-colors ${watchingIdx === i ? "border-yellow-400/50" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{r.title}</span>
                  <span className="font-display text-xs font-bold text-primary">{r.relevance}%</span>
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary" style={{ width: `${r.relevance}%` }} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.evidence}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="font-tactical text-[9px] text-muted-foreground/70">
                    {r.unit.toUpperCase()} {r.timestamp && `· ${r.timestamp}`}
                  </div>
                  {hasVideo && r.timestamp && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-[10px] border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10"
                      onClick={() => setWatchingIdx(watchingIdx === i ? null : i)}
                    >
                      <PlayCircle className="h-3 w-3" /> {watchingIdx === i ? "Watching" : "Watch clip"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Film, Sparkles } from "lucide-react";

const SUGGESTIONS = ["interior run defense", "missed tackles", "pass protection breakdowns", "blitz tendencies", "red zone", "explosive plays"];

export default function AskFilmPanel({ sessionId }: { sessionId: number }) {
  const [query, setQuery] = useState("");
  const mutation = trpc.warRoom.askFilm.useMutation();

  const search = (q: string) => {
    if (q.trim().length < 2) return;
    setQuery(q);
    mutation.mutate({ sessionId, query: q.trim() });
  };

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
          <div className="grid md:grid-cols-2 gap-3">
            {mutation.data.results.map((r, i) => (
              <div key={i} className={`glass rounded-xl p-4 anim-rise-${Math.min(i + 1, 5)} hover:border-primary/30 transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{r.title}</span>
                  <span className="font-display text-xs font-bold text-primary">{r.relevance}%</span>
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary" style={{ width: `${r.relevance}%` }} />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{r.evidence}</p>
                <div className="mt-2 font-tactical text-[9px] text-muted-foreground/70">
                  {r.unit.toUpperCase()} {r.timestamp && `· ${r.timestamp}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


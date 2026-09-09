import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Box, ChevronRight, Film, Loader2, Radio, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

function formatClock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export default function TacticalTwinLibraryPage() {
  const [, setLocation] = useLocation();
  const { data = [], isLoading } = trpc.tacticalTwin.list.useQuery();

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden border border-emerald-400/20 bg-[#050a08] px-6 py-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),repeating-linear-gradient(90deg,transparent,transparent_47px,rgba(255,255,255,0.025)_48px)]" />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-400"><Sparkles className="h-3.5 w-3.5" />Tactical Twin · Coach Reconstruction Lab</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">Turn game film into a controllable digital twin.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/50">Select a real play from Film Breakdown, Highlight Reel, or Live View. Then correct alignment, draw routes, mark breakdowns, scrub the same moment across film, tactical map, and interactive 3D.</p>
          <div className="mt-6 flex flex-wrap gap-2"><Button className="gap-2 bg-emerald-400 text-black hover:bg-emerald-300" onClick={() => setLocation("/")}><Film className="h-4 w-4" />Choose film session</Button><Button variant="outline" className="gap-2" onClick={() => setLocation("/live")}><Radio className="h-4 w-4" />Choose Live event</Button></div>
        </div>
      </header>

      {isLoading ? <div className="grid min-h-60 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-400" /></div> : null}

      {!isLoading && data.length === 0 ? (
        <section className="grid min-h-72 place-items-center border border-dashed border-white/15 bg-white/[0.02] px-6 text-center"><div><Box className="mx-auto h-10 w-10 text-white/20" /><h2 className="mt-4 text-xl font-semibold text-white">No Tactical Twins yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/40">Open AI Film Breakdown, Highlight Reel, or a completed Live evidence window and press <strong className="text-white/70">Build Tactical Twin</strong>.</p></div></section>
      ) : null}

      {data.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Reconstruction library</p><h2 className="mt-1 text-2xl font-semibold text-white">{data.length} saved twin{data.length === 1 ? "" : "s"}</h2></div></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {data.map((item) => (
              <button key={item.id} onClick={() => setLocation(`/twin/${item.id}`)} className="group grid min-h-40 gap-5 border border-white/10 bg-[#070b09] p-5 text-left hover:border-emerald-400/35 md:grid-cols-[1fr_auto]">
                <div><div className="flex flex-wrap items-center gap-2"><span className="border border-emerald-400/25 bg-emerald-400/[0.07] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300">{item.sourceKind.replace("_", " ")}</span>{item.coachVerified ? <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Verified</span> : <span className="text-[10px] uppercase tracking-[0.12em] text-amber-200/70">Draft · {item.confidence}%</span>}</div><h3 className="mt-4 text-xl font-semibold text-white group-hover:text-emerald-300">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-white/40">{item.sourceDescription || item.coachingNotes || "Coach-assisted tactical reconstruction"}</p><p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-white/30">{item.formation} · {item.playType} · {formatClock(item.sourceStartSeconds)}–{formatClock(item.sourceEndSeconds)}</p></div><div className="grid place-items-center"><ChevronRight className="h-6 w-6 text-white/20 group-hover:text-emerald-400" /></div>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

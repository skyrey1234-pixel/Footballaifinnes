import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Swords, Loader2, BookOpen } from "lucide-react";

const LOOKS = [
  { id: "aggressive_edges", label: "Aggressive Edges", desc: "DEs crashing hard" },
  { id: "man_coverage", label: "Man Coverage", desc: "Tight man across the board" },
  { id: "single_high", label: "Single-High Safety", desc: "One deep, loaded box" },
  { id: "heavy_box", label: "Heavy Box", desc: "7-8 defenders down" },
  { id: "light_box", label: "Light Box", desc: "6 or fewer in the box" },
  { id: "blitz_heavy", label: "Blitz Heavy", desc: "Extra rushers coming" },
  { id: "soft_zone", label: "Soft Zone", desc: "Off coverage, zone shells" },
] as const;

export default function CounterPlayPanel({ sessionId }: { sessionId: number }) {
  const [look, setLook] = useState<(typeof LOOKS)[number]["id"] | null>(null);
  const mutation = trpc.warRoom.counterPlay.useMutation();

  const select = (id: (typeof LOOKS)[number]["id"]) => {
    setLook(id);
    mutation.mutate({ sessionId, opponentLook: id });
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 anim-rise">
        <div className="font-tactical text-[10px] text-primary mb-4 flex items-center gap-2">
          <Swords className="h-3.5 w-3.5" /> WHAT ARE THEY SHOWING YOU?
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {LOOKS.map((l) => (
            <button key={l.id} onClick={() => select(l.id)} className={`p-3 rounded-lg text-left transition-all active:scale-[0.96] ${look === l.id ? "bg-primary text-primary-foreground glow-primary-sm" : "bg-secondary hover:bg-accent"}`}>
              <div className="font-display text-xs font-bold leading-tight">{l.label}</div>
              <div className={`text-[9px] mt-1 ${look === l.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {mutation.isPending && (
        <div className="glass rounded-2xl p-12 flex flex-col items-center gap-3 relative overflow-hidden">
          <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent anim-scan" />
          <BookOpen className="h-8 w-8 text-primary animate-pulse" />
          <span className="font-tactical text-xs text-primary">PULLING PLAYBOOK ANSWERS…</span>
        </div>
      )}

      {mutation.data && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mutation.data.recommendations
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((rec, i) => {
              const concept = mutation.data!.concepts.find((c) => c.name.toLowerCase() === rec.conceptName.toLowerCase()) || mutation.data!.concepts[i];
              return (
                <div key={i} className={`glass-bright clip-tactical p-5 anim-rise-${i + 1} ${i === 0 ? "glow-primary" : ""} relative overflow-hidden`}>
                  <div className="absolute -top-4 -right-1 font-display text-[90px] font-bold text-primary/8 leading-none select-none">{rec.rank}</div>
                  <div className="relative">
                    {i === 0 && <div className="font-tactical text-[9px] text-primary mb-1">★ BEST ANSWER</div>}
                    <h3 className="font-display text-lg font-bold">{rec.conceptName}</h3>
                    {concept && <p className="text-[10px] text-muted-foreground/80 font-tactical mt-0.5">{concept.family.toUpperCase()}</p>}
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{rec.whyItWorks}</p>
                    <div className="mt-3 p-2.5 rounded-md bg-primary/10 border border-primary/20">
                      <div className="font-tactical text-[9px] text-primary mb-1">EXECUTION KEY</div>
                      <p className="text-xs">{rec.executionKey}</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

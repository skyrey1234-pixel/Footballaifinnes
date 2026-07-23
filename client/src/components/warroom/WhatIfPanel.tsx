import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { FlaskConical, Loader2, TrendingUp, TrendingDown } from "lucide-react";

const PLAY_FAMILIES = [
  { id: "inside_run", label: "Inside Run" },
  { id: "outside_run", label: "Outside Run" },
  { id: "quick_pass", label: "Quick Pass" },
  { id: "deep_pass", label: "Deep Pass" },
  { id: "screen", label: "Screen" },
  { id: "rpo", label: "RPO" },
] as const;

const FITS = [
  { id: "a_gap", label: "A-Gap" },
  { id: "b_gap", label: "B-Gap" },
  { id: "c_gap", label: "C-Gap" },
  { id: "edge", label: "Edge" },
  { id: "overhang", label: "Overhang" },
  { id: "deep_middle", label: "Deep Middle" },
] as const;

export default function WhatIfPanel({ sessionId }: { sessionId: number }) {
  const [playFamily, setPlayFamily] = useState<(typeof PLAY_FAMILIES)[number]["id"]>("inside_run");
  const [fit, setFit] = useState<(typeof FITS)[number]["id"]>("a_gap");
  const [aggression, setAggression] = useState(50);
  const mutation = trpc.warRoom.whatIf.useMutation();

  const run = () => mutation.mutate({ sessionId, playFamily, fitLocation: fit, aggression });
  const d = mutation.data;

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      {/* Controls */}
      <div className="lg:col-span-2 glass-bright rounded-2xl p-6 anim-rise space-y-5 h-fit">
        <div className="font-tactical text-[10px] text-primary flex items-center gap-2">
          <FlaskConical className="h-3.5 w-3.5" /> DEFENSIVE SANDBOX
        </div>
        <div>
          <div className="font-tactical text-[10px] text-muted-foreground mb-2">THEIR PLAY FAMILY</div>
          <div className="grid grid-cols-2 gap-1.5">
            {PLAY_FAMILIES.map((p) => (
              <button key={p.id} onClick={() => setPlayFamily(p.id)} className={`h-10 rounded-lg text-xs font-medium transition-all active:scale-[0.96] ${playFamily === p.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-tactical text-[10px] text-muted-foreground mb-2">COMMIT THE FIT TO</div>
          <div className="grid grid-cols-3 gap-1.5">
            {FITS.map((f) => (
              <button key={f.id} onClick={() => setFit(f.id)} className={`h-10 rounded-lg text-xs font-medium transition-all active:scale-[0.96] ${fit === f.id ? "bg-blue-500 text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-tactical text-[10px] text-muted-foreground mb-2 flex justify-between">
            <span>FIT AGGRESSION</span><span className="text-primary font-bold">{aggression}%</span>
          </div>
          <input type="range" min={0} max={100} value={aggression} onChange={(e) => setAggression(parseInt(e.target.value))} className="w-full accent-[oklch(0.85_0.22_155)]" />
          <div className="flex justify-between font-tactical text-[9px] text-muted-foreground/60 mt-1">
            <span>READ & REACT</span><span>SHOOT THE GAP</span>
          </div>
        </div>
        <Button className="w-full h-11 gap-2 glow-primary-sm active:scale-[0.97]" onClick={run} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          Run Simulation
        </Button>
      </div>

      {/* Result */}
      <div className="lg:col-span-3 space-y-4">
        {!d && (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground text-sm anim-rise-1">
            Pick their play, commit your fit, set aggression — see the estimated stop rate change in real time.
          </div>
        )}
        {d && (
          <>
            <div className="glass-bright clip-tactical p-8 anim-rise text-center relative overflow-hidden glow-primary-sm">
              <div className="absolute inset-0 field-grid opacity-30 pointer-events-none" />
              <div className="relative">
                <div className="font-tactical text-[10px] text-muted-foreground mb-2">ESTIMATED STOP PROBABILITY</div>
                <div className="font-display text-7xl font-bold text-glow text-primary">{d.stopProbability}%</div>
                <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-bold ${d.delta >= 0 ? "bg-primary/15 text-primary" : "bg-red-500/15 text-red-400"}`}>
                  {d.delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {d.delta >= 0 ? "+" : ""}{d.delta}% vs baseline ({d.baseline}%)
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-5 anim-rise-1">
                <div className="font-tactical text-[10px] text-amber-400 mb-2">PLAY-ACTION TRADEOFF</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.tradeoff}</p>
              </div>
              <div className="glass rounded-xl p-5 anim-rise-2">
                <div className="font-tactical text-[10px] text-blue-400 mb-2">HOW THIS WAS CALCULATED</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.explanation}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


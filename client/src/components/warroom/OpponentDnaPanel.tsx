import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dna, RefreshCw, Loader2 } from "lucide-react";

function DnaBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-tactical text-[10px] text-muted-foreground">{label}</span>
        <span className="font-display text-sm font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden bar-shimmer">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
    </div>
  );
}

export default function OpponentDnaPanel({ sessionId, opponentName }: { sessionId: number; opponentName: string }) {
  const mutation = trpc.warRoom.opponentDna.useMutation();

  useEffect(() => {
    mutation.mutate({ sessionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (mutation.isPending) {
    return (
      <div className="glass rounded-2xl p-16 flex flex-col items-center gap-4 anim-rise relative overflow-hidden">
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent anim-scan" />
        <Dna className="h-10 w-10 text-primary animate-pulse" />
        <div className="font-tactical text-sm text-primary">SEQUENCING OPPONENT DNA…</div>
      </div>
    );
  }
  if (mutation.isError) {
    return (
      <div className="glass rounded-2xl p-10 text-center space-y-3">
        <div className="text-sm text-destructive">{mutation.error.message}</div>
        <Button size="sm" onClick={() => mutation.mutate({ sessionId })} className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
      </div>
    );
  }
  const dna = mutation.data;
  if (!dna) return null;

  return (
    <div className="space-y-5">
      {/* Identity statement — hero banner */}
      <div className="glass-bright clip-tactical p-6 md:p-8 relative overflow-hidden anim-rise glow-primary-sm">
        <div className="absolute inset-0 field-grid opacity-40 pointer-events-none" />
        <div className="relative">
          <div className="font-tactical text-[10px] text-primary mb-2 flex items-center gap-2">
            <Dna className="h-3.5 w-3.5" /> OPPONENT IDENTITY — {opponentName.toUpperCase()}
          </div>
          <p className="font-display text-xl md:text-2xl font-semibold leading-snug text-glow-white">"{dna.identity}"</p>
          <p className="text-[11px] text-muted-foreground mt-3">{dna.sampleNote}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Run/Pass split — big visual */}
        <div className="lg:col-span-2 glass rounded-xl p-6 anim-rise-1">
          <div className="font-tactical text-[10px] text-muted-foreground mb-5">RUN / PASS SPLIT</div>
          <div className="flex items-center gap-1 h-14 rounded-lg overflow-hidden mb-3">
            <div className="h-full flex items-center justify-center font-display font-bold text-primary-foreground bg-gradient-to-r from-primary/80 to-primary transition-all duration-700" style={{ width: `${dna.runRate}%` }}>
              {dna.runRate}%
            </div>
            <div className="h-full flex items-center justify-center font-display font-bold text-white bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700" style={{ width: `${dna.passRate}%` }}>
              {dna.passRate}%
            </div>
          </div>
          <div className="flex justify-between font-tactical text-[10px]">
            <span className="text-primary">RUN</span><span className="text-blue-400">PASS</span>
          </div>
        </div>

        {/* Tendency bars */}
        <div className="lg:col-span-3 glass rounded-xl p-6 space-y-4 anim-rise-2">
          <div className="font-tactical text-[10px] text-muted-foreground">TENDENCY RATES</div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            <DnaBar label="MOTION RATE" value={dna.motionRate} color="oklch(0.8 0.16 85)" />
            <DnaBar label="BLITZ RATE" value={dna.blitzRate} color="oklch(0.6 0.24 27)" />
            <DnaBar label="EXPLOSIVE PLAYS (15+ YDS)" value={dna.explosiveRate} color="oklch(0.85 0.22 155)" />
            <DnaBar label="NEGATIVE / NO-GAIN" value={dna.negativeRate} color="oklch(0.65 0.18 240)" />
          </div>
        </div>
      </div>

      {/* Formations / directions / fronts */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: "TOP FORMATIONS", items: dna.formations },
          { title: "RUN DIRECTIONS", items: dna.runDirections },
          { title: "DEFENSIVE FRONTS", items: dna.defensiveFronts },
        ].map((group, gi) => (
          <div key={group.title} className={`glass rounded-xl p-5 anim-rise-${gi + 3}`}>
            <div className="font-tactical text-[10px] text-muted-foreground mb-3">{group.title}</div>
            <div className="space-y-2">
              {group.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="font-display text-xl font-bold text-primary/50">{i + 1}</span>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

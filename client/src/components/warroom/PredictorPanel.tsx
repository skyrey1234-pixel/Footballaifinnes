import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2 } from "lucide-react";

const DIST_COLORS: Record<string, string> = {
  run: "oklch(0.85 0.22 155)",
  pass: "oklch(0.65 0.18 240)",
  screen: "oklch(0.8 0.16 85)",
  scramble: "oklch(0.7 0.15 300)",
};

export default function PredictorPanel({ sessionId, opponentName }: { sessionId: number; opponentName: string }) {
  const [down, setDown] = useState(1);
  const [distance, setDistance] = useState(10);
  const [formationClue, setFormationClue] = useState("");
  const mutation = trpc.warRoom.predict.useMutation();

  const predict = () => mutation.mutate({ sessionId, down, distance, formationClue: formationClue || undefined });
  const d = mutation.data;

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      {/* Situation input */}
      <div className="lg:col-span-2 glass-bright rounded-2xl p-6 anim-rise space-y-5 h-fit">
        <div className="font-tactical text-[10px] text-primary flex items-center gap-2">
          <Crosshair className="h-3.5 w-3.5" /> GAME SITUATION
        </div>
        <div>
          <div className="font-tactical text-[10px] text-muted-foreground mb-2">DOWN</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((dn) => (
              <button key={dn} onClick={() => setDown(dn)} className={`h-12 rounded-lg font-display text-lg font-bold transition-all active:scale-[0.96] ${down === dn ? "bg-primary text-primary-foreground glow-primary-sm" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                {dn}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="font-tactical text-[10px] text-muted-foreground mb-2 flex justify-between">
            <span>DISTANCE</span><span className="text-primary font-bold">{distance} YDS</span>
          </div>
          <input type="range" min={1} max={25} value={distance} onChange={(e) => setDistance(parseInt(e.target.value))} className="w-full accent-[oklch(0.85_0.22_155)]" />
        </div>
        <div>
          <div className="font-tactical text-[10px] text-muted-foreground mb-2">FORMATION CLUE (OPTIONAL)</div>
          <Input value={formationClue} onChange={(e) => setFormationClue(e.target.value)} placeholder='e.g. "trips right, RB offset"' className="bg-background/60" />
        </div>
        <Button className="w-full h-11 gap-2 glow-primary-sm active:scale-[0.97]" onClick={predict} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
          Predict Next Play
        </Button>
      </div>

      {/* Prediction output */}
      <div className="lg:col-span-3 space-y-4">
        {!d && !mutation.isPending && (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground text-sm anim-rise-1">
            Set the situation and hit <span className="text-primary font-medium">Predict</span> — the model reads {opponentName}'s tendencies off the film.
          </div>
        )}
        {mutation.isPending && (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-3 relative overflow-hidden">
            <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent anim-scan" />
            <Crosshair className="h-8 w-8 text-primary animate-pulse" />
            <span className="font-tactical text-xs text-primary">RUNNING TENDENCY MODEL…</span>
          </div>
        )}
        {d && (
          <>
            <div className="glass-bright clip-tactical p-6 anim-rise glow-primary-sm">
              <div className="font-tactical text-[10px] text-muted-foreground mb-2">MOST LIKELY CALL · CONFIDENCE {d.confidence}%</div>
              <p className="font-display text-2xl font-bold text-glow text-primary">{d.likelyCall}</p>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{d.reasoning}</p>
            </div>
            <div className="glass rounded-xl p-6 anim-rise-1 space-y-3">
              <div className="font-tactical text-[10px] text-muted-foreground">PROBABILITY DISTRIBUTION</div>
              {(["run", "pass", "screen", "scramble"] as const).map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="font-tactical text-[10px] w-20 text-muted-foreground">{k.toUpperCase()}</span>
                  <div className="flex-1 h-6 rounded-md bg-secondary overflow-hidden">
                    <div className="h-full rounded-md flex items-center px-2 transition-all duration-700" style={{ width: `${Math.max(d[k], 3)}%`, background: `linear-gradient(90deg, ${DIST_COLORS[k]}66, ${DIST_COLORS[k]})` }}>
                      <span className="font-display text-[11px] font-bold text-background">{d[k]}%</span>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/70 pt-1">Coaching estimate from film tendencies — not a guarantee.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

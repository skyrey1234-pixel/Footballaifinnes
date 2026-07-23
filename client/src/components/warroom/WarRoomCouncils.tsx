import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radio, Shield, Swords, Zap, RefreshCw, Trophy } from "lucide-react";

const UNIT_STYLE: Record<string, { color: string; icon: typeof Shield; label: string }> = {
  offense: { color: "text-primary", icon: Swords, label: "OFFENSE" },
  defense: { color: "text-blue-400", icon: Shield, label: "DEFENSE" },
  special_teams: { color: "text-amber-400", icon: Zap, label: "SPECIAL TEAMS" },
};

export default function WarRoomCouncils({ sessionId, opponentName }: { sessionId: number; opponentName: string }) {
  const mutation = trpc.warRoom.councils.useMutation();

  useEffect(() => {
    mutation.mutate({ sessionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (mutation.isPending) {
    return (
      <div className="glass rounded-2xl p-16 flex flex-col items-center gap-4 anim-rise relative overflow-hidden">
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent anim-scan" />
        <Radio className="h-10 w-10 text-primary animate-pulse" />
        <div className="font-tactical text-sm text-primary">CONVENING COORDINATOR COUNCILS…</div>
        <div className="text-xs text-muted-foreground">Offense, Defense & Special Teams are reviewing the film</div>
      </div>
    );
  }

  if (mutation.isError) {
    return (
      <div className="glass rounded-2xl p-10 text-center space-y-3">
        <div className="text-sm text-destructive">{mutation.error.message}</div>
        <Button size="sm" onClick={() => mutation.mutate({ sessionId })} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </div>
    );
  }

  const data = mutation.data;
  if (!data) return null;

  const councils = [
    { key: "offense", items: data.offense },
    { key: "defense", items: data.defense },
    { key: "special_teams", items: data.specialTeams },
  ];

  return (
    <div className="space-y-6">
      {/* Three Halftime Calls — the killshot panel */}
      <div className="relative anim-rise">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="font-tactical text-sm text-primary">THREE HALFTIME CALLS</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => mutation.mutate({ sessionId })}>
            <RefreshCw className="h-3 w-3" /> Re-run
          </Button>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {data.halftimeCalls.slice(0, 3).map((call, i) => {
            const style = UNIT_STYLE[call.unit] || UNIT_STYLE.offense;
            const Icon = style.icon;
            return (
              <div key={i} className={`glass-bright clip-tactical p-5 relative overflow-hidden anim-rise-${i + 1} ${i === 0 ? "glow-primary" : ""}`}>
                <div className="absolute -top-6 -right-2 font-display text-[110px] font-bold text-primary/8 leading-none select-none">
                  {call.rank}
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`h-4 w-4 ${style.color}`} />
                    <span className={`font-tactical text-[10px] ${style.color}`}>{style.label}</span>
                  </div>
                  <p className="font-display text-lg font-semibold leading-snug mb-4">{call.action}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-tactical text-muted-foreground">
                      <span>CONFIDENCE</span><span className="text-primary">{call.confidence}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden bar-shimmer">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${call.confidence}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">{call.evidence}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coordinator councils */}
      <div className="grid lg:grid-cols-3 gap-4">
        {councils.map(({ key, items }, ci) => {
          const style = UNIT_STYLE[key];
          const Icon = style.icon;
          return (
            <div key={key} className={`glass rounded-xl p-5 anim-rise-${ci + 2}`}>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
                <Icon className={`h-4 w-4 ${style.color}`} />
                <span className={`font-tactical text-xs ${style.color}`}>{style.label} COUNCIL</span>
              </div>
              <div className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} className="group">
                    <div className="flex items-start gap-2.5">
                      <span className={`font-display text-lg font-bold ${style.color} opacity-60 leading-none mt-0.5`}>{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <p className="text-sm font-medium leading-snug">{item.priority}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

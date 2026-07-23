import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw } from "lucide-react";

export default function MomentumPanel({ sessionId }: { sessionId: number }) {
  const mutation = trpc.warRoom.momentum.useMutation();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    mutation.mutate({ sessionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (mutation.isPending) {
    return (
      <div className="glass rounded-2xl p-16 flex flex-col items-center gap-4 anim-rise relative overflow-hidden">
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent anim-scan" />
        <Activity className="h-10 w-10 text-primary animate-pulse" />
        <div className="font-tactical text-sm text-primary">CHARTING MOMENTUM SWINGS…</div>
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
  const data = mutation.data;
  if (!data) return null;

  const events = data.events;
  const maxAbs = Math.max(10, ...events.map((e) => Math.abs(e.swing)));
  const sel = selected !== null ? events[selected] : null;

  return (
    <div className="space-y-5">
      <div className="glass rounded-xl p-5 anim-rise">
        <p className="text-sm text-muted-foreground leading-relaxed">{data.narrative}</p>
      </div>

      {/* Swing chart */}
      <div className="glass-bright rounded-2xl p-6 anim-rise-1 relative overflow-hidden">
        <div className="font-tactical text-[10px] text-muted-foreground mb-6 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" /> MOMENTUM SEQUENCE — CLICK A SWING
        </div>
        <div className="relative h-56">
          {/* Zero line */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 origin-left font-tactical text-[9px] text-muted-foreground/50 hidden md:block">US ↑ / THEM ↓</div>
          <div className="flex items-center h-full gap-1.5 md:gap-2.5 px-2">
            {events.map((e, i) => {
              const pct = (Math.abs(e.swing) / maxAbs) * 48;
              const positive = e.swing >= 0;
              const active = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(active ? null : i)}
                  className="relative flex-1 h-full group active:scale-[0.97] transition-transform"
                  title={e.label}
                >
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 w-full max-w-[34px] rounded-md transition-all duration-300 ${
                      positive
                        ? "bg-gradient-to-t from-primary/50 to-primary bottom-1/2"
                        : "bg-gradient-to-b from-red-500/50 to-red-500 top-1/2"
                    } ${active ? (positive ? "glow-primary-sm" : "glow-red") : "opacity-75 group-hover:opacity-100"}`}
                    style={{ height: `${pct}%` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        {/* Selected event detail */}
        {sel && (
          <div className="mt-4 p-4 rounded-lg bg-secondary/60 border border-border anim-rise">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className={`font-display text-lg font-bold ${sel.swing >= 0 ? "text-primary" : "text-red-400"}`}>
                  {sel.swing >= 0 ? "+" : ""}{sel.swing}
                </span>
                <span className="ml-3 font-medium text-sm">{sel.label}</span>
              </div>
              <div className="font-tactical text-[10px] text-muted-foreground">
                {sel.unit.toUpperCase()} {sel.timestamp && `· ${sel.timestamp}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

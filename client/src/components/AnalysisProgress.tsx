import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, Film, Scan, Brain, FileText, Sparkles, CircleDashed } from "lucide-react";

/**
 * AnalysisProgress — cinematic progress experience for the 1-3 minute AI
 * analysis wait. Stage timeline is time-driven (deterministic client-side
 * simulation based on elapsed time since the session was created/updated),
 * capped at 96% until the real status flips to complete.
 */
type Stage = {
  id: string;
  label: string;
  detail: string;
  icon: React.ElementType;
  at: number; // seconds elapsed when this stage starts
};

const STAGES: Stage[] = [
  { id: "ingest", label: "Ingesting film", detail: "Pulling your video from secure storage", icon: Film, at: 0 },
  { id: "frames", label: "Extracting key frames", detail: "Slicing the game into analyzable moments", icon: Scan, at: 12 },
  { id: "vision", label: "AI watching the plays", detail: "Formations, personnel, tendencies — every snap", icon: Brain, at: 30 },
  { id: "report", label: "Writing the scouting report", detail: "Tendencies, keys to victory, player intel", icon: FileText, at: 75 },
  { id: "polish", label: "Finalizing highlights", detail: "Timestamping the plays that matter", icon: Sparkles, at: 110 },
];

const EXPECTED_TOTAL = 135; // seconds — matches observed ~50s-3min pipeline

const HYPE_LINES = [
  "Great coaches steal signals. Great AI steals tendencies.",
  "Every snap tells a story — we're reading all of them.",
  "3rd & long tendencies incoming...",
  "Scanning for blitz tells and coverage rotations...",
  "Your opponent has habits. We're finding them.",
  "Film don't lie. Neither does the report.",
];

export default function AnalysisProgress({ startedAt, title = "AI Analysis in Progress" }: { startedAt?: string | Date | number | null; title?: string }) {
  const startMs = useMemo(() => {
    if (!startedAt) return Date.now();
    const t = new Date(startedAt).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }, [startedAt]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const elapsed = Math.max(0, (now - startMs) / 1000);
  // Eased progress: fast early, slows near the cap — never hits 100 until real status flips
  const pct = Math.min(96, (1 - Math.exp(-elapsed / (EXPECTED_TOTAL * 0.55))) * 104);
  const activeIdx = STAGES.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);
  const hypeLine = HYPE_LINES[Math.floor(elapsed / 10) % HYPE_LINES.length];
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);

  return (
    <Card className="relative overflow-hidden border-emerald-500/25 bg-zinc-950">
      {/* Animated field-scan backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(16,185,129,0.5) 0 1px, transparent 1px 40px), repeating-linear-gradient(0deg, rgba(16,185,129,0.35) 0 1px, transparent 1px 40px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent"
        style={{ animation: "scanSweep 3.2s cubic-bezier(0.45,0,0.55,1) infinite" }}
      />
      <style>{`
        @keyframes scanSweep { 0% { left: -12rem; } 100% { left: 110%; } }
        @keyframes pulseRing { 0% { transform: scale(0.95); opacity: 0.8; } 70% { transform: scale(1.35); opacity: 0; } 100% { opacity: 0; } }
      `}</style>

      <CardContent className="relative p-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-emerald-400/40" style={{ animation: "pulseRing 1.8s ease-out infinite" }} />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/40">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
              </span>
            </div>
            <div>
              <p className="font-semibold text-emerald-300 tracking-wide">{title}</p>
              <p className="text-xs text-muted-foreground">{hypeLine}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold font-mono text-emerald-200 tabular-nums">{Math.floor(pct)}%</p>
            <p className="text-[10px] font-mono text-zinc-500 tabular-nums">{mins}:{secs.toString().padStart(2, "0")} elapsed · ~1-3 min total</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2.5 rounded-full bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-lime-300 transition-[width] duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{ left: `${Math.max(0, pct - 8)}%`, transition: "left 1s ease-out" }}
          />
        </div>

        {/* Stage checklist */}
        <div className="grid gap-2">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-all duration-500 ${
                  active
                    ? "border-emerald-400/40 bg-emerald-500/10"
                    : done
                    ? "border-zinc-800 bg-zinc-900/40 opacity-80"
                    : "border-zinc-900 bg-transparent opacity-40"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : active ? (
                  <Icon className="h-4 w-4 text-emerald-300 animate-pulse shrink-0" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-zinc-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${active ? "text-emerald-200" : done ? "text-zinc-300" : "text-zinc-500"}`}>
                    {s.label}
                    {active && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping align-middle" />}
                  </p>
                  {active && <p className="text-[11px] text-muted-foreground truncate">{s.detail}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-zinc-500">
          Keep this page open — it refreshes automatically the moment your report is ready.
        </p>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import Play3DVisualizer from "@/components/play3d/Play3DVisualizer";
import { FormationDiagram } from "@/components/gameplan/FormationDiagram";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MistakePlay {
  title: string;
  quarter: string;
  situation: string;
  formation: string;
  playType: string;
  target: string;
  whatWentWrong: string;
  correctExecution: string;
  breakdownMoment: number;
  culprit: string;
  coachingPoint: string;
  severity: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/40",
  moderate: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  minor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
};

export default function MistakeAnalysisTab({ sessionId }: { sessionId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.mistakeAnalysis.get.useQuery({ sessionId });
  const generateMutation = trpc.mistakeAnalysis.generate.useMutation({
    onSuccess: () => {
      utils.mistakeAnalysis.get.invalidate({ sessionId });
      toast.success("Mistake analysis generated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const plays = (data?.plays as MistakePlay[] | undefined) || [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [view, setView] = useState<"actual" | "correct">("correct");
  const selected = plays[selectedIdx];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#00FF87]" />
      </div>
    );
  }

  if (plays.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <AlertTriangle className="h-12 w-12 text-orange-400 mx-auto" />
        <h3 className="text-xl font-bold text-white">Mistake Analysis Animation</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          AI reviews the film breakdown, finds the plays where things went wrong, and animates both the actual
          breakdown AND the correct execution — so your players can literally see the difference.
        </p>
        <Button
          onClick={() => generateMutation.mutate({ sessionId })}
          disabled={generateMutation.isPending}
          className="bg-[#00FF87] text-black hover:bg-[#00e07a] gap-2"
        >
          {generateMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing Mistakes...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate Mistake Analysis</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-white">Mistake Analysis Animation</h3>
            <p className="text-sm text-gray-400">Watch what went wrong vs. what should have happened — in animated 3D.</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          onClick={() => generateMutation.mutate({ sessionId })}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Re-Analyze
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Play list */}
        <Card className="border-gray-800 lg:col-span-1">
          <CardContent className="p-2 space-y-1">
            {plays.map((p, idx) => (
              <button
                key={idx}
                onClick={() => { setSelectedIdx(idx); setView("correct"); }}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-md transition-colors border",
                  idx === selectedIdx
                    ? "bg-orange-500/10 border-orange-500/40"
                    : "hover:bg-gray-800/60 border-transparent"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-medium truncate", idx === selectedIdx ? "text-orange-400" : "text-gray-200")}>
                    {p.title}
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0 shrink-0 capitalize", SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.minor)}>
                    {p.severity}
                  </Badge>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">{p.quarter} · {p.situation} · Culprit: {p.culprit}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Animated comparison */}
        {selected && (
          <div className="lg:col-span-3 space-y-3">
            {/* Toggle */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={view === "actual" ? "default" : "outline"}
                className={cn("gap-1.5 text-xs h-8", view === "actual" && "bg-red-600 hover:bg-red-700 text-white")}
                onClick={() => setView("actual")}
              >
                <XCircle className="h-3.5 w-3.5" /> What Happened
              </Button>
              <Button
                size="sm"
                variant={view === "correct" ? "default" : "outline"}
                className={cn("gap-1.5 text-xs h-8", view === "correct" && "bg-[#00FF87] hover:bg-[#00e07a] text-black")}
                onClick={() => setView("correct")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Correct Execution
              </Button>
            </div>

            <Play3DVisualizer
              key={`${selectedIdx}-${view}`}
              formation={selected.formation}
              playName={`${selected.title} — ${view === "actual" ? "ACTUAL (Breakdown)" : "CORRECT Execution"}`}
              playType={selected.playType}
              target={view === "actual" ? undefined : selected.target}
              height={400}
              showBall={view === "correct"}
              annotations={
                view === "actual"
                  ? [{ kind: "wrong", x: 50, y: 38 + (selected.breakdownMoment || 0.5) * 14, label: "BREAKDOWN" }]
                  : [{ kind: "right", x: 50, y: 32, label: "EXECUTE HERE" }]
              }
            />

            {/* Animated 2D wrong-vs-right chalkboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={cn(
                "rounded-lg border p-3 transition-all",
                view === "actual" ? "border-red-500/50 bg-red-950/20 ring-1 ring-red-500/30" : "border-gray-800 bg-gray-900/40"
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">The Breakdown</span>
                  <Badge variant="outline" className="text-[9px] ml-auto border-red-500/40 text-red-300">
                    breaks at {Math.round((selected.breakdownMoment || 0.5) * 100)}%
                  </Badge>
                </div>
                <div className="relative [&_svg]:!bg-[#2b0f0f] [filter:hue-rotate(0deg)]">
                  <div className="[&_path[stroke='#00FF87']]:!stroke-red-500 [&_marker_polygon]:!fill-red-500">
                    <FormationDiagram
                      key={`wrong-${selectedIdx}`}
                      formation={selected.formation}
                      playName="ACTUAL — what happened"
                      playType={selected.playType}
                      showBall={false}
                      defenseScheme="4-3"
                    />
                  </div>
                  {/* Breakdown burst marker */}
                  <div
                    className="absolute pointer-events-none"
                    style={{ left: "48%", top: `${34 + (selected.breakdownMoment || 0.5) * 18}%` }}
                  >
                    <span className="relative flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600/80 items-center justify-center text-[9px] font-black text-white">✕</span>
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-red-300/80 mt-2">Culprit: {selected.culprit} — red routes show the play as it actually broke down.</p>
              </div>

              <div className={cn(
                "rounded-lg border p-3 transition-all",
                view === "correct" ? "border-[#00FF87]/50 bg-emerald-950/20 ring-1 ring-[#00FF87]/30" : "border-gray-800 bg-gray-900/40"
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF87]" />
                  <span className="text-xs font-semibold text-[#00FF87] uppercase tracking-wide">The Fix</span>
                  <Badge variant="outline" className="text-[9px] ml-auto border-[#00FF87]/40 text-[#00FF87]">correct execution</Badge>
                </div>
                <FormationDiagram
                  key={`right-${selectedIdx}`}
                  formation={selected.formation}
                  playName="CORRECT — how to run it"
                  playType={selected.playType}
                  target={selected.target}
                  showBall
                  defenseScheme="4-3"
                />
                <p className="text-[11px] text-emerald-300/80 mt-2">Green routes + gold ball flight show the play executed the right way. Hit Run Play on both to compare.</p>
              </div>
            </div>

            {/* Explanation cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className={cn("border", view === "actual" ? "border-red-500/50 bg-red-950/20" : "border-gray-800 bg-gray-900/40")}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-red-400 mb-1 flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" /> What Went Wrong
                  </p>
                  <p className="text-sm text-gray-300">{selected.whatWentWrong}</p>
                </CardContent>
              </Card>
              <Card className={cn("border", view === "correct" ? "border-[#00FF87]/50 bg-emerald-950/20" : "border-gray-800 bg-gray-900/40")}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-[#00FF87] mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Correct Execution
                  </p>
                  <p className="text-sm text-gray-300">{selected.correctExecution}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-yellow-500/30 bg-yellow-950/10">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-yellow-400 mb-1">Coaching Point</p>
                <p className="text-sm text-gray-200 font-medium">{selected.coachingPoint}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

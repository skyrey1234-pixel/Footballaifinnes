import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film, Sparkles, Loader2, RefreshCw, Flame, Shield, Zap, Trophy, TrendingUp, Star, Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface Clip {
  rank: number;
  title: string;
  description: string;
  timestamp: number;
  duration: number;
  category: string;
  impactScore: number;
  players: string;
}

interface SessionInfo {
  youtubeVideoId?: string | null;
  videoUrl?: string | null;
  sourceType: string;
  opponentName: string;
}

const CATEGORY_META: Record<string, { icon: typeof Trophy; label: string; color: string }> = {
  "touchdown": { icon: Trophy, label: "Touchdown", color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10" },
  "big-play": { icon: Flame, label: "Big Play", color: "text-orange-400 border-orange-500/40 bg-orange-500/10" },
  "turnover": { icon: Zap, label: "Turnover", color: "text-red-400 border-red-500/40 bg-red-500/10" },
  "defensive-stop": { icon: Shield, label: "Defensive Stop", color: "text-blue-400 border-blue-500/40 bg-blue-500/10" },
  "special-teams": { icon: Star, label: "Special Teams", color: "text-purple-400 border-purple-500/40 bg-purple-500/10" },
  "momentum-shift": { icon: TrendingUp, label: "Momentum Shift", color: "text-[#00FF87] border-[#00FF87]/40 bg-[#00FF87]/10" },
};

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HighlightReelTab({ sessionId, session }: { sessionId: number; session: SessionInfo }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.highlightReel.get.useQuery({ sessionId });
  const generateMutation = trpc.highlightReel.generate.useMutation({
    onSuccess: () => {
      utils.highlightReel.get.invalidate({ sessionId });
      toast.success("Highlight reel generated!");
    },
    onError: (e) => toast.error(e.message),
  });
  const twinMutation = trpc.tacticalTwin.createFromFilm.useMutation({
    onSuccess: (twin) => {
      toast.success("Tactical Twin created — automatic tracking is ready");
      setLocation(`/twin/${twin.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const clips = useMemo(() => ((data?.clips as Clip[] | undefined) || []).slice().sort((a, b) => a.rank - b.rank), [data]);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = clips[activeIdx];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#00FF87]" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <Film className="h-12 w-12 text-[#00FF87] mx-auto" />
        <h3 className="text-xl font-bold text-white">Auto Highlight Reel</h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          AI scans the entire game film and pulls the best plays into a ranked highlight reel — touchdowns,
          turnovers, momentum shifts — each with a jump-to timestamp so you can watch instantly.
        </p>
        <Button
          onClick={() => generateMutation.mutate({ sessionId })}
          disabled={generateMutation.isPending}
          className="bg-[#00FF87] text-black hover:bg-[#00e07a] gap-2"
        >
          {generateMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Scanning Film...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate Highlight Reel</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-start gap-2">
          <Film className="h-5 w-5 text-[#00FF87] mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-white">Auto Highlight Reel</h3>
            <p className="text-sm text-gray-400">The {clips.length} best plays from the film, ranked by impact. Click any clip to jump to it.</p>
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
          Regenerate
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video player */}
        <div className="lg:col-span-2 space-y-3">
          <div className="aspect-video rounded-lg overflow-hidden border border-gray-800 bg-black">
            {session.youtubeVideoId ? (
              <iframe
                key={`${activeIdx}-${active?.timestamp}`}
                src={`https://www.youtube.com/embed/${session.youtubeVideoId}?start=${Math.floor(active?.timestamp || 0)}&autoplay=0`}
                className="w-full h-full"
                allowFullScreen
                title={active?.title || "Highlight"}
              />
            ) : session.videoUrl ? (
              <video
                key={`${activeIdx}-${active?.timestamp}`}
                src={`${session.videoUrl}#t=${Math.floor(active?.timestamp || 0)}`}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">No video available</div>
            )}
          </div>

          {active && (
            <Card className="border-gray-800 bg-gray-900/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge className="bg-[#00FF87] text-black font-bold">#{active.rank}</Badge>
                  {(() => {
                    const meta = CATEGORY_META[active.category] || CATEGORY_META["big-play"];
                    const Icon = meta.icon;
                    return (
                      <Badge variant="outline" className={cn("gap-1", meta.color)}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                    );
                  })()}
                  <Badge variant="outline" className="border-gray-700 text-gray-400">
                    {fmtTime(active.timestamp)} · {active.duration}s
                  </Badge>
                  <Badge variant="outline" className="border-cyan-400/25 bg-cyan-400/5 text-cyan-200">Stage 2 ready</Badge>
                  <span className="ml-auto text-xs text-gray-500">Impact: <span className="text-[#00FF87] font-bold">{active.impactScore}</span>/100</span>
                </div>
                <h4 className="font-bold text-white">{active.title}</h4>
                <p className="text-sm text-gray-400 mt-1">{active.description}</p>
                {active.players && <p className="text-xs text-gray-500 mt-2">Key players: {active.players}</p>}
                <Button
                  className="mt-4 w-full gap-2 bg-emerald-400 text-black hover:bg-emerald-300"
                  disabled={twinMutation.isPending}
                  onClick={() => twinMutation.mutate({
                    sessionId,
                    sourceKind: "highlight_reel",
                    sourceIndex: activeIdx,
                    title: active.title,
                    description: active.description,
                    startSeconds: Math.max(0, Math.floor(active.timestamp)),
                    durationSeconds: Math.max(5, Math.min(30, Math.round(active.duration || 12))),
                    confidence: Math.max(0, Math.min(100, Math.round(active.impactScore))),
                  })}
                >
                  {twinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
                  Build + Auto Track
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ranked clip list */}
        <Card className="border-gray-800 max-h-[560px] overflow-y-auto">
          <CardContent className="p-2 space-y-1">
            {clips.map((c, idx) => {
              const meta = CATEGORY_META[c.category] || CATEGORY_META["big-play"];
              const Icon = meta.icon;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md transition-colors border",
                    idx === activeIdx ? "bg-[#00FF87]/10 border-[#00FF87]/40" : "hover:bg-gray-800/60 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-lg font-black w-6 text-center shrink-0", idx === activeIdx ? "text-[#00FF87]" : "text-gray-600")}>
                      {c.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn("h-3 w-3 shrink-0", meta.color.split(" ")[0])} />
                        <span className={cn("text-sm font-medium truncate", idx === activeIdx ? "text-white" : "text-gray-300")}>
                          {c.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {fmtTime(c.timestamp)} · Impact {c.impactScore}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

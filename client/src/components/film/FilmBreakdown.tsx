import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, RefreshCw, Loader2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Star, Boxes } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import AnnotationCanvas from "./AnnotationCanvas";
import ClipPlayer from "./ClipPlayer";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Highlight = {
  timestamp: string;
  seconds: number;
  title: string;
  note: string;
  category: string;
  verdict: string;
};

// Parse timestamp string "MM:SS" to seconds as fallback
function parseTimestamp(ts: string): number {
  const parts = ts.split(":");
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hrs = parseInt(parts[0], 10) || 0;
    const mins = parseInt(parts[1], 10) || 0;
    const secs = parseInt(parts[2], 10) || 0;
    return hrs * 3600 + mins * 60 + secs;
  }
  return 0;
}

// Get accurate seconds from a highlight, using parsed timestamp as fallback
function getHighlightSeconds(h: Highlight): number {
  // If seconds is 0 or missing but timestamp exists, parse from timestamp
  if ((!h.seconds || h.seconds === 0) && h.timestamp) {
    return parseTimestamp(h.timestamp);
  }
  return h.seconds || 0;
}

type Annotation = {
  type: "circle" | "arrow" | "zone" | "label";
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  width?: number;
  height?: number;
  color: "red" | "green" | "yellow" | "blue" | "white";
  label: string;
};

type AnnotationData = {
  annotations: Annotation[];
  coaching_callout: string;
  alternative_play: string;
  verdict: "mistake" | "good_play" | "key_moment";
};

type FilmBreakdownProps = {
  session: {
    id: number;
    opponentName: string;
    sourceType: string;
    youtubeVideoId?: string | null;
    videoUrl?: string | null;
  };
  report: {
    highlights: unknown;
  };
};

const filterTabs = [
  { id: "all", label: "All" },
  { id: "mistake", label: "Mistakes" },
  { id: "good", label: "Good Plays" },
  { id: "offense", label: "Offense" },
  { id: "defense", label: "Defense" },
  { id: "special", label: "Special" },
];

export default function FilmBreakdown({ session, report }: FilmBreakdownProps) {
  const [, setLocation] = useLocation();
  const highlights = (report.highlights as Highlight[]) || [];
  // Ensure all highlights have accurate seconds values
  const processedHighlights = useMemo(() => {
    return highlights.map(h => ({
      ...h,
      seconds: getHighlightSeconds(h),
    }));
  }, [highlights]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedHighlight, setExpandedHighlight] = useState<number | null>(null);
  const [annotationCache, setAnnotationCache] = useState<Record<number, AnnotationData>>({});
  const [showOverlay, setShowOverlay] = useState<Record<number, boolean>>({});
  const [showAltPlay, setShowAltPlay] = useState<Record<number, boolean>>({});

  const annotateMutation = trpc.ai.annotateHighlight.useMutation();
  const twinMutation = trpc.tacticalTwin.createFromFilm.useMutation({
    onSuccess: (twin) => {
      toast.success("Tactical Twin created — automatic tracking is ready");
      setLocation(`/twin/${twin.id}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const reanalyzeMutation = trpc.sessions.reanalyze.useMutation({
    onSuccess: () => {
      // Reload the page to show updated analysis
      window.location.reload();
    },
  });
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const filteredHighlights = useMemo(() => {
    if (activeFilter === "all") return processedHighlights;
    if (activeFilter === "mistake") return processedHighlights.filter(h => h.verdict === "bad" || h.category === "mistake");
    if (activeFilter === "good") return processedHighlights.filter(h => h.verdict === "good");
    return processedHighlights.filter(h => h.category === activeFilter);
  }, [processedHighlights, activeFilter]);

  const stats = useMemo(() => ({
    total: processedHighlights.length,
    mistakes: processedHighlights.filter(h => h.verdict === "bad" || h.category === "mistake").length,
    good: processedHighlights.filter(h => h.verdict === "good").length,
  }), [processedHighlights]);

  const handleAnnotate = async (index: number, highlight: Highlight) => {
    if (annotationCache[index]) {
      setExpandedHighlight(index);
      setShowOverlay(prev => ({ ...prev, [index]: true }));
      return;
    }

    setExpandedHighlight(index);
    try {
      const result = await annotateMutation.mutateAsync({
        sessionId: session.id,
        highlight: {
          timestamp: highlight.timestamp,
          title: highlight.title,
          note: highlight.note,
          category: highlight.category,
          verdict: highlight.verdict,
        },
      });
      setAnnotationCache(prev => ({ ...prev, [index]: result as AnnotationData }));
      setShowOverlay(prev => ({ ...prev, [index]: true }));
    } catch {
      // Fallback handled by mutation error
    }
  };

  const handleRegenerate = async (index: number, highlight: Highlight) => {
    setAnnotationCache(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    await handleAnnotate(index, highlight);
  };

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">AI Film Breakdown</h3>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => reanalyzeMutation.mutate({ id: session.id })}
            disabled={reanalyzeMutation.isPending}
            className="text-xs"
          >
            {reanalyzeMutation.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Re-Analyzing...</>
            ) : (
              <><RefreshCw className="h-3 w-3 mr-1" /> Re-Analyze Film</>
            )}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Plays</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.mistakes}</p>
            <p className="text-xs text-muted-foreground">Mistakes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.good}</p>
            <p className="text-xs text-muted-foreground">Good Plays</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeFilter} onValueChange={setActiveFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          {filterTabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Honest timestamp note for YouTube sessions (uploads use vision-anchored times) */}
      {session.sourceType === "youtube" && (
        <p className="text-[11px] text-muted-foreground/80 -mt-1">
          Clip times on YouTube sessions are AI-estimated within the video's real duration. Upload the film directly for exact vision-anchored timestamps.
        </p>
      )}

      {/* Highlight Cards */}
      <div className="space-y-4">
        {filteredHighlights.map((highlight, idx) => {
          const originalIndex = processedHighlights.indexOf(highlight);
          const isExpanded = expandedHighlight === originalIndex;
          const annotations = annotationCache[originalIndex];
          const overlayVisible = showOverlay[originalIndex] ?? true;
          const altPlayVisible = showAltPlay[originalIndex] ?? false;

          return (
            <Card key={originalIndex} className={`transition-all ${isExpanded ? "border-primary/50" : ""}`}>
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      highlight.verdict === "bad" || highlight.category === "mistake"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-green-500/10 text-green-400"
                    }`}>
                      {highlight.verdict === "bad" || highlight.category === "mistake"
                        ? <AlertTriangle className="h-4 w-4" />
                        : <CheckCircle className="h-4 w-4" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm">{highlight.title}</p>
                      <p className="text-xs text-muted-foreground">{session.sourceType === "youtube" ? "~" : ""}{highlight.timestamp} &middot; {highlight.category}</p>
                      <Badge variant="outline" className="mt-1 border-cyan-400/25 bg-cyan-400/5 text-[9px] uppercase text-cyan-200">Stage 2 · Auto Track + Cinema</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs"
                      onClick={() => handleAnnotate(originalIndex, highlight)}
                      disabled={annotateMutation.isPending && expandedHighlight === originalIndex}
                    >
                      {annotateMutation.isPending && expandedHighlight === originalIndex ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                      Watch with AI Annotations
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2 bg-emerald-400 text-xs text-black hover:bg-emerald-300"
                      disabled={twinMutation.isPending}
                      onClick={() => twinMutation.mutate({
                        sessionId: session.id,
                        sourceKind: "film_highlight",
                        sourceIndex: originalIndex,
                        title: highlight.title,
                        description: highlight.note,
                        startSeconds: highlight.seconds,
                        durationSeconds: 12,
                      })}
                    >
                      {twinMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Boxes className="h-3 w-3" />}
                      Build + Auto Track
                    </Button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground">{highlight.note}</p>

                {/* Expanded: Video + Annotations */}
                {isExpanded && annotations && (
                  <div className="space-y-4 pt-2">
                    {/* Pre-timed clip: seeks to the play and plays ONLY that segment */}
                    <ClipPlayer
                      sourceType={session.sourceType}
                      youtubeVideoId={session.youtubeVideoId}
                      videoUrl={session.videoUrl}
                      startSeconds={highlight.seconds}
                      clipDuration={12}
                      autoPlay
                      overlay={overlayVisible ? <AnnotationCanvas annotations={annotations.annotations} /> : undefined}
                    />

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => setShowOverlay(prev => ({ ...prev, [originalIndex]: !overlayVisible }))}
                      >
                        {overlayVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {overlayVisible ? "Hide Overlays" : "Show Overlays"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleRegenerate(originalIndex, highlight)}
                        disabled={annotateMutation.isPending}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Regenerate
                      </Button>
                    </div>

                    {/* Coaching Callout */}
                    <div className={`rounded-lg p-3 border ${
                      annotations.verdict === "mistake"
                        ? "bg-red-500/5 border-red-500/30"
                        : annotations.verdict === "good_play"
                        ? "bg-green-500/5 border-green-500/30"
                        : "bg-yellow-500/5 border-yellow-500/30"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Coaching Insight
                        </span>
                      </div>
                      <p className="text-sm">{annotations.coaching_callout}</p>
                    </div>

                    {/* Alternative Play */}
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-xs w-full justify-between"
                        onClick={() => setShowAltPlay(prev => ({ ...prev, [originalIndex]: !altPlayVisible }))}
                      >
                        <span>What They Should Have Done</span>
                        {altPlayVisible ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                      {altPlayVisible && (
                        <div className="mt-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/30">
                          <p className="text-sm text-blue-200">{annotations.alternative_play}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Color Legend */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overlay Color Guide</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">Mistake</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Good Play</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-xs text-muted-foreground">Suggested</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-xs text-muted-foreground">Key Player</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-white" />
              <span className="text-xs text-muted-foreground">Neutral</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

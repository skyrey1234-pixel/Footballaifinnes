import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2, RefreshCw, Download, Image, Swords, Gamepad2, Box, AlertTriangle, Film, Radio, ClipboardList, Mic } from "lucide-react";
import { useLocation, useParams } from "wouter";
import ReportView from "@/components/report/ReportView";
import FilmBreakdown from "@/components/film/FilmBreakdown";
import AnalysisProgress from "@/components/AnalysisProgress";
import PlayerProfiles from "@/components/players/PlayerProfiles";
import { GamePlanGenerator } from "@/components/gameplan/GamePlanGenerator";
import PlayerRatingCard, { generatePlayerRatings } from "@/components/madden/PlayerRatingCard";
import MatchupScreen from "@/components/madden/MatchupScreen";
import Play3DTab from "@/components/play3d/Play3DTab";
import MistakeAnalysisTab from "@/components/mistakes/MistakeAnalysisTab";
import HighlightReelTab from "@/components/highlights/HighlightReelTab";
import { BeatThisDefenseTab } from "@/pages/BeatThisDefenseTab";
import { GameDayAssistantTab } from "@/pages/GameDayAssistantTab";
import { CallSheetTab } from "@/pages/CallSheetTab";
import { VoiceCoachTab } from "@/pages/VoiceCoachTab";
import { toast } from "sonner";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  const exportPdfMutation = trpc.reports.exportPdf.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success("Report exported! Opening in new tab — use Print > Save as PDF.");
    },
    onError: () => toast.error("Failed to export report"),
  });

  const diagramMutation = trpc.reports.generateDiagram.useMutation({
    onSuccess: (data) => {
      if (data.imageUrl) {
        window.open(data.imageUrl, "_blank");
        toast.success("Play diagram generated!");
      }
    },
    onError: () => toast.error("Failed to generate diagram"),
  });

  const utils = trpc.useUtils();
  const reanalyzeMutation = trpc.sessions.reanalyze.useMutation({
    onMutate: () => {
      toast.info("Re-analysis started — the AI is re-watching the film now.");
    },
    onSuccess: () => {
      utils.sessions.get.invalidate({ id: sessionId });
      utils.reports.getBySession.invalidate({ sessionId });
    },
    onError: (err) => toast.error(err.message || "Failed to restart analysis"),
  });

  const { data: session, isLoading: sessionLoading } = trpc.sessions.get.useQuery(
    { id: sessionId },
    { enabled: sessionId > 0, refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "analyzing" || reanalyzeMutation.isPending ? 5000 : false;
    }}
  );

  const { data: report, isLoading: reportLoading } = trpc.reports.getBySession.useQuery(
    { sessionId },
    { enabled: sessionId > 0 && session?.status === "complete" }
  );

  if (sessionLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Session not found</p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{session.opponentName}</h1>
          <p className="text-sm text-muted-foreground">
            {session.gameDate || "No date"} &middot; {session.sourceType === "youtube" ? "YouTube" : "Uploaded Video"}
          </p>
        </div>
        {session.status === "complete" && (
          <Button
            size="lg"
            className="gap-2 font-tactical text-xs glow-primary-sm active:scale-[0.97] shrink-0"
            onClick={() => setLocation(`/warroom/${sessionId}`)}
          >
            <Radio className="h-4 w-4" />
            ENTER WAR ROOM
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary-foreground/40 text-primary-foreground">
              NEW
            </Badge>
          </Button>
        )}
      </div>

      {session.status === "analyzing" && (
        <AnalysisProgress
          startedAt={session.updatedAt}
          backendStage={(session as { analysisStage?: string | null }).analysisStage}
        />
      )}

      {session.status === "failed" && !reanalyzeMutation.isPending && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium text-destructive">Analysis Failed</p>
              <p className="text-sm text-muted-foreground">
                The analysis didn't finish — this can happen if the server recycled mid-run. Hit Retry to run it again.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={reanalyzeMutation.isPending}
              onClick={() => reanalyzeMutation.mutate({ id: sessionId })}
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {session.status === "failed" && reanalyzeMutation.isPending && (
        <AnalysisProgress
          title="Re-Analysis in Progress"
          backendStage={(session as { analysisStage?: string | null }).analysisStage}
        />
      )}

      {session.status === "complete" && report && (
        <Tabs defaultValue="report" className="w-full">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="report">Scouting Report</TabsTrigger>
            <TabsTrigger value="film">AI Film Breakdown</TabsTrigger>
            <TabsTrigger value="players" className="gap-2">
              Player Profiles
            </TabsTrigger>
            <TabsTrigger value="gameplan" className="gap-2">
              <Swords className="h-3 w-3" />
              Game Plan
            </TabsTrigger>
            <TabsTrigger value="matchup" className="gap-2">
              <Gamepad2 className="h-3 w-3" />
              Matchup
            </TabsTrigger>
            <TabsTrigger value="play3d" className="gap-2">
              <Box className="h-3 w-3" />
              3D Plays
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#00FF87]/50 text-[#00FF87]">
                NEW
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="mistakes" className="gap-2">
              <AlertTriangle className="h-3 w-3" />
              Mistakes
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/50 text-orange-400">
                NEW
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="highlights" className="gap-2">
              <Film className="h-3 w-3" />
              Highlight Reel
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500/50 text-yellow-400">
                NEW
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="beatdefense" className="gap-2">
              <Swords className="h-3 w-3" />
              Beat This Defense
            </TabsTrigger>
            <TabsTrigger value="gameday" className="gap-2">
              <Radio className="h-3 w-3" />
              Game Day
            </TabsTrigger>
            <TabsTrigger value="callsheet" className="gap-2">
              <ClipboardList className="h-3 w-3" />
              Call Sheet
            </TabsTrigger>
            <TabsTrigger value="voicecoach" className="gap-2">
              <Mic className="h-3 w-3" />
              Voice Coach
            </TabsTrigger>
          </TabsList>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => exportPdfMutation.mutate({ sessionId })}
              disabled={exportPdfMutation.isPending}
            >
              {exportPdfMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const desc = report.executiveSummary?.slice(0, 200) || "Standard football formation";
                diagramMutation.mutate({ sessionId, playDescription: desc });
              }}
              disabled={diagramMutation.isPending}
            >
              {diagramMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image className="h-3 w-3" />}
              Generate Play Diagram
            </Button>
          </div>

          <TabsContent value="report" className="mt-6">
            <ReportView session={session} report={report} />
          </TabsContent>
          <TabsContent value="film" className="mt-6">
            <FilmBreakdown session={session} report={report} />
          </TabsContent>
          <TabsContent value="players" className="mt-6">
            <PlayerProfiles
              sessionId={sessionId}
              opponentName={session.opponentName}
              session={{
                sourceType: session.sourceType,
                youtubeVideoId: session.youtubeVideoId,
                videoUrl: session.videoUrl,
              }}
            />
          </TabsContent>
          <TabsContent value="gameplan" className="mt-6">
            <GamePlanGenerator sessionId={sessionId} opponentName={session.opponentName} />
          </TabsContent>
          <TabsContent value="matchup" className="mt-6">
            <MatchupTab sessionId={sessionId} opponentName={session.opponentName} />
          </TabsContent>
          <TabsContent value="play3d" className="mt-6">
            <Play3DTab sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="mistakes" className="mt-6">
            <MistakeAnalysisTab sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="highlights" className="mt-6">
            <HighlightReelTab sessionId={sessionId} session={session} />
          </TabsContent>
          <TabsContent value="beatdefense" className="mt-6">
            <BeatThisDefenseTab sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="gameday" className="mt-6">
            <GameDayAssistantTab sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="callsheet" className="mt-6">
            <CallSheetTab sessionId={sessionId} />
          </TabsContent>
          <TabsContent value="voicecoach" className="mt-6">
            <VoiceCoachTab sessionId={sessionId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Matchup Tab — shows MatchupScreen + Player Rating Cards
function MatchupTab({ sessionId, opponentName }: { sessionId: number; opponentName: string }) {
  const { data: players, isLoading: playersLoading } = trpc.players.listBySession.useQuery({ sessionId });
  const { data: report } = trpc.reports.getBySession.useQuery({ sessionId });

  const playerList = (players || []) as any[];

  // Build matchup data from report
  const matchupData = useMemo(() => {
    const yourTeam = {
      name: "Your Team",
      overall: 82,
      record: "",
      tendencies: { runPercent: 45, passPercent: 55, blitzPercent: 28 },
    };

    const opponentTeam = {
      name: opponentName,
      overall: 78,
      record: "",
      tendencies: { runPercent: 52, passPercent: 48, blitzPercent: 22 },
    };

    // Parse tendencies from report data if available
    if (report) {
      const reportData = report as any;
      if (reportData.offenseAnalysis) {
        const offText = typeof reportData.offenseAnalysis === "string" ? reportData.offenseAnalysis : "";
        if (offText.includes("run-heavy")) {
          opponentTeam.tendencies.runPercent = 60;
          opponentTeam.tendencies.passPercent = 40;
        } else if (offText.includes("pass-heavy")) {
          opponentTeam.tendencies.runPercent = 35;
          opponentTeam.tendencies.passPercent = 65;
        }
      }
    }

    // Build key matchups from top players
    const keyMatchups = playerList
      .filter((p: any) => p.threatLevel === "elite" || p.threatLevel === "high")
      .slice(0, 4)
      .map((p: any) => {
        const theirRating = p.threatLevel === "elite" ? 92 : p.threatLevel === "high" ? 85 : 78;
        const yourRating = Math.round(theirRating - 3 + Math.random() * 8);
        return {
          yourPlayer: `Your ${p.position === "QB" ? "Pass Rush" : p.position === "WR" ? "CB1" : p.position === "RB" ? "LB1" : "Defender"}`,
          yourRating,
          theirPlayer: `#${p.playerNumber} ${p.playerName || "Unknown"}`,
          theirRating,
          advantage: yourRating > theirRating ? "you" as const : yourRating < theirRating ? "them" as const : "even" as const,
          note: p.strengths?.slice(0, 50) || "",
        };
      });

    // Default matchups if no players
    if (keyMatchups.length === 0) {
      keyMatchups.push(
        { yourPlayer: "Your CB1", yourRating: 84, theirPlayer: "Their WR1", theirRating: 87, advantage: "them" as const, note: "Speed mismatch" },
        { yourPlayer: "Your Pass Rush", yourRating: 86, theirPlayer: "Their LT", theirRating: 82, advantage: "you" as const, note: "Edge advantage" },
        { yourPlayer: "Your LB1", yourRating: 80, theirPlayer: "Their RB1", theirRating: 83, advantage: "them" as const, note: "Receiving back" },
      );
    }

    const prediction = {
      winner: yourTeam.overall >= opponentTeam.overall ? "you" as const : "them" as const,
      confidence: 62 + Math.floor(Math.abs(yourTeam.overall - opponentTeam.overall) * 1.5),
      margin: `${3 + Math.floor(Math.random() * 10)} points`,
    };

    return { yourTeam, opponent: opponentTeam, keyMatchups, prediction };
  }, [opponentName, playerList, report]);

  // Generate Madden-style rating cards from player data
  const ratingCards = useMemo(() => {
    return playerList.map((p: any) => generatePlayerRatings({
      name: p.playerName || "Unknown",
      number: parseInt(p.playerNumber) || 0,
      position: p.position || "ATH",
      team: opponentName,
      threatLevel: p.threatLevel || "medium",
      xFactor: p.threatLevel === "elite" ? (p.strengths?.split(",")[0]?.trim() || "Playmaker") : undefined,
      weakness: p.weaknesses?.split(",")[0]?.trim() || undefined,
      tendency: Array.isArray(p.tendencies) && p.tendencies.length > 0 ? p.tendencies[0]?.tendency : undefined,
    }));
  }, [playerList, opponentName]);

  if (playersLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#00FF87]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Matchup Screen */}
      <MatchupScreen
        yourTeam={matchupData.yourTeam}
        opponent={matchupData.opponent}
        keyMatchups={matchupData.keyMatchups}
        prediction={matchupData.prediction}
      />

      {/* Player Rating Cards */}
      {ratingCards.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-[#00FF87]" />
            Madden-Style Player Cards
            <span className="text-xs text-gray-500 font-normal ml-2">(tap to flip)</span>
          </h3>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            {ratingCards.map((card, idx) => (
              <PlayerRatingCard key={idx} player={card} />
            ))}
          </div>
        </div>
      )}

      {ratingCards.length === 0 && (
        <Card className="border-gray-800">
          <CardContent className="p-8 text-center">
            <Gamepad2 className="h-12 w-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 text-sm mb-3">
              No player data available yet. Generate Player Profiles first to see Madden-style rating cards.
            </p>
            <p className="text-xs text-gray-500">
              Go to the "Player Profiles" tab and click "Generate Profiles" to unlock this feature.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

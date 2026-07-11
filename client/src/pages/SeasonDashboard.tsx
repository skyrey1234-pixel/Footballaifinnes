import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, Calendar, ChevronRight, ArrowLeft } from "lucide-react";

export default function SeasonDashboard() {
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const { data: stats, isLoading } = trpc.season.stats.useQuery();
  const { data: trends, isLoading: trendsLoading } = trpc.season.opponentTrends.useQuery(
    { opponentName: selectedOpponent! },
    { enabled: !!selectedOpponent }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Opponent detail view
  if (selectedOpponent && trends) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedOpponent(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-bold">{selectedOpponent} — Scouting History</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{trends.length}</p>
              <p className="text-xs text-muted-foreground">Games Scouted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">
                {trends.filter(t => t.report).length}
              </p>
              <p className="text-xs text-muted-foreground">Reports Complete</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">
                {trends.reduce((acc, t) => {
                  const h = (t.report?.highlights as Array<unknown>) || [];
                  return acc + h.length;
                }, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Highlights</p>
            </CardContent>
          </Card>
        </div>

        {/* Trend Analysis */}
        {trends.filter(t => t.report).length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Cross-Game Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Based on {trends.filter(t => t.report).length} scouted games, here are recurring patterns:
              </p>
              <div className="space-y-2">
                {trends.filter(t => t.report).slice(0, 3).map((t, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">
                        {t.session.gameDate || new Date(t.session.createdAt).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {((t.report?.highlights as Array<unknown>) || []).length} plays
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {(t.report?.executiveSummary || "").slice(0, 200)}...
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game-by-game breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Game-by-Game Reports</h3>
          {trendsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            trends.map((t, i) => (
              <Card key={i} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {t.session.gameDate || new Date(t.session.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Source: {t.session.sourceType === "youtube" ? "YouTube" : "Upload"} •{" "}
                        {t.report ? `${((t.report.highlights as Array<unknown>) || []).length} highlights` : "No report"}
                      </p>
                    </div>
                    <Badge variant={t.session.status === "complete" ? "default" : "secondary"}>
                      {t.session.status}
                    </Badge>
                  </div>
                  {t.report && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {(t.report.executiveSummary || "").slice(0, 150)}...
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // Main season overview
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Season Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track opponents across the season. Historical intel compounds — the more you scout, the smarter you get.
        </p>
      </div>

      {/* Season Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{stats?.totalGames || 0}</p>
            <p className="text-xs text-muted-foreground">Total Games Scouted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-green-400" />
            <p className="text-2xl font-bold text-green-400">{stats?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Reports Complete</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-yellow-400" />
            <p className="text-2xl font-bold text-yellow-400">{stats?.opponents?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Unique Opponents</p>
          </CardContent>
        </Card>
      </div>

      {/* Opponents List */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Opponents Scouted
        </h2>
        {!stats?.opponents?.length ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No opponents scouted yet. Create your first session to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {stats.opponents.map((opp) => (
              <Card
                key={opp.name}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setSelectedOpponent(opp.name)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{opp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {opp.games} game{opp.games > 1 ? "s" : ""} scouted • Last: {new Date(opp.lastScouted).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{opp.games}x</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

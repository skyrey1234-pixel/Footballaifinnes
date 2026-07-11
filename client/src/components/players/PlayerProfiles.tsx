import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCircle, Target, Zap, Shield, AlertTriangle } from "lucide-react";

type Tendency = {
  tendency: string;
  frequency: string;
  situation: string;
};

type PlayerProfile = {
  id: number;
  playerNumber: string;
  playerName: string | null;
  position: string | null;
  tendencies: unknown;
  strengths: string | null;
  weaknesses: string | null;
  threatLevel: string;
  notes: string | null;
};

type PlayerProfilesProps = {
  sessionId: number;
  opponentName: string;
};

const threatColors: Record<string, string> = {
  low: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  elite: "bg-red-500/10 text-red-400 border-red-500/30",
};

const threatLabels: Record<string, string> = {
  low: "Low Threat",
  medium: "Medium Threat",
  high: "High Threat",
  elite: "Elite Threat",
};

export default function PlayerProfiles({ sessionId, opponentName }: PlayerProfilesProps) {
  const { data: players, isLoading, refetch } = trpc.players.listBySession.useQuery({ sessionId });
  const generateMutation = trpc.players.generate.useMutation({
    onSuccess: () => refetch(),
  });
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const playerList = (players || []) as PlayerProfile[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Player Tendency Profiles
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            AI-generated scouting cards for key opposing players
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => generateMutation.mutate({ sessionId })}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
          {playerList.length > 0 ? "Regenerate Profiles" : "Generate Profiles"}
        </Button>
      </div>

      {playerList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UserCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm">
              No player profiles generated yet. Click "Generate Profiles" to have AI identify key opposing players.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playerList.map((player) => {
            const tendencies = (player.tendencies as Tendency[]) || [];
            const isExpanded = expandedPlayer === player.id;

            return (
              <Card
                key={player.id}
                className={`cursor-pointer transition-all ${isExpanded ? "border-primary/50 col-span-full" : "hover:border-primary/20"}`}
                onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{player.playerNumber}</span>
                      </div>
                      <div>
                        <CardTitle className="text-sm">{player.playerName || "Unknown"}</CardTitle>
                        <p className="text-xs text-muted-foreground">{player.position}</p>
                      </div>
                    </div>
                    <Badge className={`text-xs border ${threatColors[player.threatLevel] || threatColors.medium}`}>
                      {threatLabels[player.threatLevel] || "Medium"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Tendencies Preview */}
                  <div className="space-y-1.5">
                    {tendencies.slice(0, isExpanded ? tendencies.length : 2).map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Target className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-muted-foreground">{t.tendency}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{t.frequency}</Badge>
                      </div>
                    ))}
                    {!isExpanded && tendencies.length > 2 && (
                      <p className="text-[10px] text-primary">+{tendencies.length - 2} more tendencies...</p>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      {player.strengths && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Shield className="h-3 w-3 text-green-400" />
                            <span className="text-xs font-semibold text-green-400">Strengths</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{player.strengths}</p>
                        </div>
                      )}
                      {player.weaknesses && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="h-3 w-3 text-red-400" />
                            <span className="text-xs font-semibold text-red-400">Weaknesses</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{player.weaknesses}</p>
                        </div>
                      )}
                      {player.notes && (
                        <div className="p-2 rounded bg-muted/30 border border-border">
                          <p className="text-xs text-muted-foreground italic">{player.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

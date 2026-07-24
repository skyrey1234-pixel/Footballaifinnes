import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCircle, Target, Zap, Shield, AlertTriangle, Crosshair, Film } from "lucide-react";
import ClipPlayer from "@/components/film/ClipPlayer";

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
  session?: {
    sourceType: string;
    youtubeVideoId?: string | null;
    videoUrl?: string | null;
  };
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

type Spotlight = {
  highlightIndex: number;
  spotlightTitle: string;
  whatHeDoes: string;
  howToStop: string;
  circle: { x: number; y: number; radius: number };
  arrows: Array<{ x: number; y: number; x2: number; y2: number; color: "red" | "blue"; label: string }>;
  highlight: { timestamp: string; seconds: number; title: string; note: string; category: string; verdict: string } | null;
};

/** Pulsing tracking circle + attack arrows rendered over the clip */
function SpotlightOverlay({ spotlight, playerNumber }: { spotlight: Spotlight; playerNumber: string }) {
  const { circle, arrows } = spotlight;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <marker id="spot-arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
        </marker>
        <marker id="spot-arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#3b82f6" />
        </marker>
      </defs>
      {/* Tracking circle with pulse */}
      <circle cx={circle.x} cy={circle.y} r={circle.radius} fill="none" stroke="#facc15" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
        <animate attributeName="r" values={`${circle.radius};${circle.radius * 1.35};${circle.radius}`} dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx={circle.x} cy={circle.y} r={circle.radius * 0.65} fill="rgba(250,204,21,0.12)" stroke="#facc15" strokeWidth="0.35" />
      <text x={circle.x} y={circle.y - circle.radius - 2.5} textAnchor="middle" fill="#facc15" fontSize="3.6" fontWeight="700" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.85)", strokeWidth: 0.7 }}>
        #{playerNumber}
      </text>
      {/* Arrows: red = his path, blue = how to attack him */}
      {arrows.map((a, i) => (
        <g key={i}>
          <line
            x1={a.x} y1={a.y} x2={a.x2} y2={a.y2}
            stroke={a.color === "red" ? "#ef4444" : "#3b82f6"}
            strokeWidth="0.7"
            strokeDasharray={a.color === "blue" ? "2 1.2" : undefined}
            markerEnd={`url(#spot-arrow-${a.color})`}
            vectorEffect="non-scaling-stroke"
          />
          <text x={(a.x + a.x2) / 2} y={(a.y + a.y2) / 2 - 1.5} textAnchor="middle" fill={a.color === "red" ? "#fca5a5" : "#93c5fd"} fontSize="2.8" fontWeight="600" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.85)", strokeWidth: 0.6 }}>
            {a.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function PlayerProfiles({ sessionId, opponentName, session }: PlayerProfilesProps) {
  const { data: players, isLoading, refetch } = trpc.players.listBySession.useQuery({ sessionId });
  const generateMutation = trpc.players.generate.useMutation({
    onSuccess: () => refetch(),
  });
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  const [spotlights, setSpotlights] = useState<Record<number, Spotlight>>({});
  const [loadingSpotlight, setLoadingSpotlight] = useState<number | null>(null);
  const spotlightMutation = trpc.ai.playerSpotlight.useMutation();

  const loadSpotlight = async (player: PlayerProfile) => {
    if (spotlights[player.id]) return;
    setLoadingSpotlight(player.id);
    try {
      const result = await spotlightMutation.mutateAsync({
        sessionId,
        playerNumber: player.playerNumber,
        playerName: player.playerName,
        position: player.position,
        strengths: player.strengths,
        weaknesses: player.weaknesses,
      });
      setSpotlights(prev => ({ ...prev, [player.id]: result as Spotlight }));
    } catch {
      // surface nothing; button re-enables
    } finally {
      setLoadingSpotlight(null);
    }
  };

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
                      {/* Film Spotlight: his best play, circled + how to stop him */}
                      <div onClick={(e) => e.stopPropagation()}>
                        {!spotlights[player.id] ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"
                            disabled={loadingSpotlight === player.id}
                            onClick={() => loadSpotlight(player)}
                          >
                            {loadingSpotlight === player.id ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Finding his best play on film...</>
                            ) : (
                              <><Crosshair className="h-3 w-3" /> Film Spotlight — See His Best Play + How to Stop Him</>
                            )}
                          </Button>
                        ) : (
                          (() => {
                            const spot = spotlights[player.id];
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Film className="h-3.5 w-3.5 text-yellow-400" />
                                  <span className="text-xs font-semibold text-yellow-300">{spot.spotlightTitle}</span>
                                  {spot.highlight && (
                                    <Badge variant="outline" className="text-[10px] ml-auto">{spot.highlight.timestamp}</Badge>
                                  )}
                                </div>
                                {spot.highlight && session ? (
                                  <ClipPlayer
                                    sourceType={session.sourceType}
                                    youtubeVideoId={session.youtubeVideoId}
                                    videoUrl={session.videoUrl}
                                    startSeconds={spot.highlight.seconds}
                                    clipDuration={12}
                                    overlay={<SpotlightOverlay spotlight={spot} playerNumber={player.playerNumber} />}
                                  />
                                ) : (
                                  <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800">
                                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(16,185,129,0.5) 0 1px, transparent 1px 40px)" }} />
                                    <SpotlightOverlay spotlight={spot} playerNumber={player.playerNumber} />
                                  </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">What He Does</p>
                                    <p className="text-xs text-muted-foreground">{spot.whatHeDoes}</p>
                                  </div>
                                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-2.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-400 mb-1">How to Stop Him</p>
                                    <p className="text-xs text-muted-foreground">{spot.howToStop}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>

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

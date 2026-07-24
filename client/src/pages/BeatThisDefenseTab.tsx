import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { FormationDiagram } from "@/components/gameplan/FormationDiagram";

interface BeatThisDefenseTabProps {
  sessionId: number;
}

export function BeatThisDefenseTab({ sessionId }: BeatThisDefenseTabProps) {
  const [selectedPlayId, setSelectedPlayId] = useState("play-1");
  const [selectedDefense, setSelectedDefense] = useState("Cover 2");
  const [gradeResult, setGradeResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const gradeMutation = trpc.playSim.grade.useMutation();

  const handleGradePlay = async () => {
    setLoading(true);
    try {
      const result = await gradeMutation.mutateAsync({
        sessionId,
        playId: selectedPlayId,
        selectedDefense,
      });
      setGradeResult(result);
    } catch (error) {
      console.error("Grade failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const defensiveSchemes = [
    "Cover 2",
    "Cover 3",
    "Cover 4",
    "Man-to-Man",
    "Blitz Package",
    "Nickel",
    "Dime",
  ];

  const plays = [
    { id: "play-1", name: "Inside Zone", formation: "I-Form", playType: "run" },
    { id: "play-2", name: "Power Run", formation: "Shotgun", playType: "run" },
    { id: "play-3", name: "Play Action Pass", formation: "Pistol", playType: "pass" },
    { id: "play-4", name: "Screen Pass", formation: "Spread", playType: "screen" },
    { id: "play-5", name: "Four Verts", formation: "Empty", playType: "pass" },
    { id: "play-6", name: "Trips Right Flood", formation: "Trips Right", playType: "pass" },
  ];

  const selectedPlay = plays.find(p => p.id === selectedPlayId) || plays[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Beat This Defense Simulator</CardTitle>
          <CardDescription>
            Pick a play and defensive look. AI grades your call with success likelihood and coaching notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live play visualization — animated routes + ball flight vs the selected defense */}
          <div className="w-full rounded-lg border border-emerald-500/20 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-emerald-300">{selectedPlay.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPlay.formation} vs {selectedDefense}</p>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">LIVE SIM</Badge>
            </div>
            <div className="flex justify-center">
              <div className="w-full max-w-[520px]">
                <FormationDiagram
                  key={`${selectedPlayId}-${selectedDefense}`}
                  formation={selectedPlay.formation}
                  playName={selectedPlay.name}
                  playType={selectedPlay.playType}
                  defenseScheme={selectedDefense}
                  showBall
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Hit "Run Play" to watch routes develop and the ball fly. Green = your routes, gold = throw lane, red X = {selectedDefense} alignment.
            </p>
          </div>

          {/* Play & Defense Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Play</label>
              <Select value={selectedPlayId} onValueChange={setSelectedPlayId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plays.map(play => (
                    <SelectItem key={play.id} value={play.id}>
                      {play.name} ({play.formation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Opponent Defense</label>
              <Select value={selectedDefense} onValueChange={setSelectedDefense}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {defensiveSchemes.map(scheme => (
                    <SelectItem key={scheme} value={scheme}>
                      {scheme}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grade Button */}
          <Button
            onClick={handleGradePlay}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              "Grade This Play Call"
            )}
          </Button>

          {/* Grade Result */}
          {gradeResult && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>AI Coaching Analysis</span>
                  <Badge
                    variant={gradeResult.successLikelihood >= 70 ? "default" : gradeResult.successLikelihood >= 50 ? "secondary" : "destructive"}
                  >
                    {gradeResult.successLikelihood}% Success
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Coaching Notes</h4>
                  <p className="text-sm text-muted-foreground">{gradeResult.coachingNotes}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">If It Fails</h4>
                  <p className="text-sm text-muted-foreground">{gradeResult.adjustment}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

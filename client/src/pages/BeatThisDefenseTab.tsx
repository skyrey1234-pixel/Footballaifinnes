import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";

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
    { id: "play-1", name: "Inside Zone", formation: "I-Form" },
    { id: "play-2", name: "Power Run", formation: "Shotgun" },
    { id: "play-3", name: "Play Action Pass", formation: "Pistol" },
    { id: "play-4", name: "Screen Pass", formation: "Spread" },
  ];

  const selectedPlayName = plays.find(p => p.id === selectedPlayId)?.name || "Unknown";

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
          {/* 3D Field Placeholder */}
          <div className="w-full h-96 bg-gradient-to-b from-green-700 to-green-900 rounded-lg border-4 border-white flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-4xl font-bold mb-2">🏈</div>
              <p className="text-lg font-semibold">{selectedPlayName}</p>
              <p className="text-sm opacity-75">vs {selectedDefense}</p>
              <p className="text-xs opacity-50 mt-2">3D Visualization Coming Soon</p>
            </div>
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
            <Card className="bg-slate-50">
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
                  <p className="text-sm text-slate-700">{gradeResult.coachingNotes}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">If It Fails</h4>
                  <p className="text-sm text-slate-700">{gradeResult.adjustment}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

interface GameDayAssistantTabProps {
  sessionId: number;
}

interface GameLog {
  id: string;
  down: number;
  distance: number;
  playType: string;
  opponentPlay: string;
  suggestedCounter: string;
}

export function GameDayAssistantTab({ sessionId }: GameDayAssistantTabProps) {
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [down, setDown] = useState("1");
  const [distance, setDistance] = useState("10");
  const [playType, setPlayType] = useState("run");
  const [opponentPlay, setOpponentPlay] = useState("");

  const handleLogPlay = () => {
    if (!opponentPlay.trim()) return;

    const counterSuggestions: Record<string, string> = {
      run: "Shift to run defense — stack the box",
      pass: "Drop into coverage — 2-deep safety look",
      screen: "Contain edges — watch for lateral movement",
      blitz: "Adjust protection — slide line away from blitz",
    };

    const newLog: GameLog = {
      id: Date.now().toString(),
      down: parseInt(down),
      distance: parseInt(distance),
      playType,
      opponentPlay,
      suggestedCounter: counterSuggestions[playType] || "Adjust based on film",
    };

    setLogs([newLog, ...logs]);
    setOpponentPlay("");
  };

  const handleDeleteLog = (id: string) => {
    setLogs(logs.filter(log => log.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Live Game-Day Assistant</CardTitle>
          <CardDescription>
            Log opponent plays. Get instant AI counter-call suggestions from scouting tendencies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Section */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">Down</label>
                <Select value={down} onValueChange={setDown}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(d => (
                      <SelectItem key={d} value={d.toString()}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Distance (yds)</label>
                <Input
                  type="number"
                  value={distance}
                  onChange={e => setDistance(e.target.value)}
                  min="1"
                  max="20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Play Type</label>
                <Select value={playType} onValueChange={setPlayType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="run">Run</SelectItem>
                    <SelectItem value="pass">Pass</SelectItem>
                    <SelectItem value="screen">Screen</SelectItem>
                    <SelectItem value="blitz">Blitz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">What Did They Run?</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g., 'Power run left', 'Play action deep'"
                  value={opponentPlay}
                  onChange={e => setOpponentPlay(e.target.value)}
                />
                <Button onClick={handleLogPlay} variant="default">
                  Log
                </Button>
              </div>
            </div>
          </div>

          {/* Play Log */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Play Log ({logs.length})</h3>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No plays logged yet. Start logging to see counter-suggestions.</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <Card key={log.id} className="bg-white">
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex gap-2 mb-2">
                            <Badge variant="outline">{log.down}&D{log.distance}</Badge>
                            <Badge variant="secondary">{log.playType}</Badge>
                          </div>
                          <p className="font-medium text-sm mb-1">Their Play: {log.opponentPlay}</p>
                          <p className="text-sm text-green-700 font-semibold">💡 {log.suggestedCounter}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLog(log.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

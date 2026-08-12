import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamTheme } from "@/contexts/TeamThemeContext";
import { ChevronLeft, ChevronRight, Flag, Pause, Play, Radio, RotateCcw, Target, TimerReset, Trash2, Trophy, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface GameDayAssistantTabProps {
  sessionId: number;
  opponentName: string;
}

type Possession = "us" | "them";

interface GameLog {
  id: string;
  down: number;
  distance: number;
  playType: string;
  opponentPlay: string;
  suggestedCounter: string;
  quarter: number;
  clock: number;
  possession: Possession;
}

interface GameState {
  ourScore: number;
  opponentScore: number;
  possession: Possession;
  quarter: number;
  clock: number;
  down: number;
  distance: number;
  ballSpot: number;
  momentum: number;
}

const INITIAL_GAME: GameState = {
  ourScore: 0,
  opponentScore: 0,
  possession: "us",
  quarter: 1,
  clock: 12 * 60,
  down: 1,
  distance: 10,
  ballSpot: 25,
  momentum: 0,
};

function displayClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ballSpotLabel(ballSpot: number) {
  if (ballSpot === 50) return "50 YD LINE";
  return ballSpot < 50 ? `OWN ${ballSpot}` : `OPP ${100 - ballSpot}`;
}

function deriveCounter(playType: string, down: number, distance: number) {
  if (playType === "run") return down >= 3 && distance <= 3 ? "Crowd the box. Force them to win outside." : "Set firm edges and spill the ball to pursuit.";
  if (playType === "pass") return distance >= 8 ? "Show pressure, then rotate into two-high coverage." : "Contest the quick game. Rally to the catch.";
  if (playType === "screen") return "Read the release. Keep the edge defender home and trigger downhill.";
  if (playType === "blitz") return "Slide protection to the pressure and work the hot route immediately.";
  return "Use the scouting report to match the call to this game situation.";
}

export function GameDayAssistantTab({ sessionId, opponentName }: GameDayAssistantTabProps) {
  const { schoolName, primaryColor, secondaryColor } = useTeamTheme();
  const storageKey = `tacticaledge:gameday:${sessionId}`;
  const [game, setGame] = useState<GameState>(INITIAL_GAME);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [playType, setPlayType] = useState("run");
  const [opponentPlay, setOpponentPlay] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { game?: GameState; logs?: GameLog[] };
      if (parsed.game) setGame({ ...INITIAL_GAME, ...parsed.game });
      if (Array.isArray(parsed.logs)) setLogs(parsed.logs);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ game, logs }));
  }, [game, logs, storageKey]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setGame((current) => {
        if (current.clock <= 0) {
          setTimerRunning(false);
          return current;
        }
        return { ...current, clock: current.clock - 1 };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const possessionLabel = game.possession === "us" ? schoolName : opponentName;
  const momentumLabel = useMemo(() => {
    if (game.momentum >= 3) return `${schoolName} rolling`;
    if (game.momentum >= 1) return `${schoolName} edge`;
    if (game.momentum <= -3) return `${opponentName} rolling`;
    if (game.momentum <= -1) return `${opponentName} edge`;
    return "Even game";
  }, [game.momentum, opponentName, schoolName]);

  const changeScore = (points: number) => {
    setGame((current) => current.possession === "us"
      ? { ...current, ourScore: Math.max(0, current.ourScore + points) }
      : { ...current, opponentScore: Math.max(0, current.opponentScore + points) });
  };

  const logPlay = () => {
    if (!opponentPlay.trim()) return;
    const log: GameLog = {
      id: Date.now().toString(),
      down: game.down,
      distance: game.distance,
      playType,
      opponentPlay: opponentPlay.trim(),
      suggestedCounter: deriveCounter(playType, game.down, game.distance),
      quarter: game.quarter,
      clock: game.clock,
      possession: game.possession,
    };
    setLogs((current) => [log, ...current].slice(0, 25));
    setOpponentPlay("");
  };

  const resetGame = () => {
    setTimerRunning(false);
    setGame(INITIAL_GAME);
    setLogs([]);
    localStorage.removeItem(storageKey);
  };

  return (
    <div className="space-y-5">
      <div className="broadcast-ticker flex items-center justify-between gap-3 rounded-xl px-4 py-2 font-tactical text-[10px] shadow-sm">
        <span className="flex items-center gap-2"><Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE GAME DAY COMMAND</span>
        <span className="hidden sm:inline">STATE SAVES AUTOMATICALLY ON THIS DEVICE</span>
      </div>

      <section className="overflow-hidden rounded-2xl shadow-xl" style={{ background: `linear-gradient(122deg, ${primaryColor}, #102A56 48%, ${secondaryColor})` }}>
        <div className="p-4 sm:p-6 text-white bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:52px_52px]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="font-tactical text-[10px] tracking-[0.2em] text-white/65">JAGUARS-STYLE LIVE SCOREBOARD</p>
              <h2 className="font-display text-xl font-bold">Make the next call with the whole game in view.</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={resetGame} className="gap-2 text-white/80 hover:bg-white/10 hover:text-white">
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
            <div className={`text-center rounded-xl px-2 py-3 ${game.possession === "us" ? "bg-white/15 ring-1 ring-white/40" : "bg-black/10"}`}>
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-white/70">{schoolName}</p>
              <p className="font-display text-5xl font-black leading-none mt-1">{game.ourScore}</p>
              {game.possession === "us" && <Badge className="mt-2 bg-white text-[#101820] hover:bg-white">POSSESSION</Badge>}
            </div>
            <div className="text-center">
              <p className="font-tactical text-[11px] text-white/65">Q{game.quarter}</p>
              <p className="font-display text-3xl sm:text-4xl font-black tabular-nums tracking-tight">{displayClock(game.clock)}</p>
              <Button size="sm" variant="ghost" onClick={() => setTimerRunning((current) => !current)} className="mt-1 h-7 gap-1 text-white hover:bg-white/10 hover:text-white">
                {timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {timerRunning ? "PAUSE" : "START"}
              </Button>
            </div>
            <div className={`text-center rounded-xl px-2 py-3 ${game.possession === "them" ? "bg-white/15 ring-1 ring-white/40" : "bg-black/10"}`}>
              <p className="truncate text-xs font-semibold uppercase tracking-wider text-white/70">{opponentName}</p>
              <p className="font-display text-5xl font-black leading-none mt-1">{game.opponentScore}</p>
              {game.possession === "them" && <Badge className="mt-2 bg-white text-[#101820] hover:bg-white">POSSESSION</Badge>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-5">
        <Card className="broadcast-card">
          <CardContent className="p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-tactical text-[10px] text-primary uppercase tracking-[0.16em]">Game Situation</p>
                <h3 className="font-display font-bold text-lg">{game.down}{game.down === 1 ? "st" : game.down === 2 ? "nd" : game.down === 3 ? "rd" : "th"} & {game.distance} · {ballSpotLabel(game.ballSpot)}</h3>
              </div>
              <Badge className="gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"><Target className="h-3 w-3" /> {possessionLabel} ball</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-secondary/70 p-3">
                <Label className="text-[10px] uppercase text-muted-foreground">Possession</Label>
                <div className="mt-2 flex rounded-lg bg-white p-1">
                  <button onClick={() => setGame((current) => ({ ...current, possession: "us" }))} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${game.possession === "us" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>US</button>
                  <button onClick={() => setGame((current) => ({ ...current, possession: "them" }))} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold ${game.possession === "them" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>THEM</button>
                </div>
              </div>
              <div className="rounded-xl bg-secondary/70 p-3">
                <Label className="text-[10px] uppercase text-muted-foreground">Quarter</Label>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setGame((current) => ({ ...current, quarter: Math.max(1, current.quarter - 1) }))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="font-display text-lg font-bold">Q{game.quarter}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setGame((current) => ({ ...current, quarter: Math.min(5, current.quarter + 1) }))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="rounded-xl bg-secondary/70 p-3">
                <Label htmlFor="clock" className="text-[10px] uppercase text-muted-foreground">Game Clock</Label>
                <Input id="clock" className="mt-2 h-9 text-center font-display font-bold" value={displayClock(game.clock)} onChange={(event) => {
                  const [mins, secs] = event.target.value.split(":").map(Number);
                  if (Number.isFinite(mins) && Number.isFinite(secs)) setGame((current) => ({ ...current, clock: Math.max(0, mins * 60 + Math.min(59, secs)) }));
                }} />
              </div>
              <div className="rounded-xl bg-secondary/70 p-3">
                <Label className="text-[10px] uppercase text-muted-foreground">Quick Score</Label>
                <div className="mt-2 flex gap-1">
                  {[3, 6, 7].map((points) => <Button key={points} size="sm" variant="outline" className="h-9 flex-1 px-1 text-xs" onClick={() => changeScore(points)}>+{points}</Button>)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-border bg-white/70 p-4">
              <div>
                <Label className="text-xs font-semibold">Down</Label>
                <div className="mt-2 grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((down) => <button key={down} onClick={() => setGame((current) => ({ ...current, down }))} className={`rounded-md px-2 py-2 text-xs font-bold ${game.down === down ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"}`}>{down}</button>)}
                </div>
              </div>
              <div>
                <Label htmlFor="distance" className="text-xs font-semibold">Distance (yards)</Label>
                <Input id="distance" type="number" min="1" max="99" className="mt-2" value={game.distance} onChange={(event) => setGame((current) => ({ ...current, distance: Math.max(1, Math.min(99, Number(event.target.value) || 1)) }))} />
              </div>
              <div>
                <Label htmlFor="ballspot" className="text-xs font-semibold">Field position · {ballSpotLabel(game.ballSpot)}</Label>
                <input id="ballspot" type="range" min="1" max="99" value={game.ballSpot} onChange={(event) => setGame((current) => ({ ...current, ballSpot: Number(event.target.value) }))} className="mt-4 w-full accent-[var(--school-primary)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="broadcast-card overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-border bg-gradient-to-r from-primary/10 via-white to-[var(--school-secondary)]/15 p-5">
              <p className="font-tactical text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Momentum Meter</p>
              <div className="mt-3 flex items-center gap-2"><Zap className="h-5 w-5 text-[var(--school-secondary)]" /><p className="font-display text-xl font-bold">{momentumLabel}</p></div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-7 gap-1.5">
                {[-3, -2, -1, 0, 1, 2, 3].map((value) => (
                  <button key={value} onClick={() => setGame((current) => ({ ...current, momentum: value }))} className={`h-12 rounded-lg border text-xs font-black transition-transform hover:-translate-y-0.5 ${game.momentum === value ? "scale-105 border-transparent text-white shadow-lg" : "border-border bg-card text-muted-foreground"}`} style={game.momentum === value ? { background: value < 0 ? "#101820" : value > 0 ? primaryColor : "#64748B" } : undefined}>
                    {value > 0 ? `+${value}` : value}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span>{opponentName}</span><span>{schoolName}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gradient-to-r from-[#101820] via-[#D7A22A] to-[var(--school-primary)]" />
              <p className="mt-4 text-xs text-muted-foreground">Tap the momentum point that best describes the current game state. Every logged play saves this context for a smarter next-call recommendation.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="broadcast-card">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4"><Flag className="h-4 w-4 text-[#006778]" /><div><p className="font-display font-bold">Log the opponent&apos;s last call</p><p className="text-xs text-muted-foreground">TacticalEdge records the live situation, momentum, and instant counter.</p></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-3">
            <Select value={playType} onValueChange={setPlayType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="run">Run</SelectItem><SelectItem value="pass">Pass</SelectItem><SelectItem value="screen">Screen</SelectItem><SelectItem value="blitz">Pressure / Blitz</SelectItem></SelectContent>
            </Select>
            <Input value={opponentPlay} onChange={(event) => setOpponentPlay(event.target.value)} placeholder="e.g. Power run left, slot fade, boundary screen" onKeyDown={(event) => event.key === "Enter" && logPlay()} />
            <Button className="gap-2" onClick={logPlay}><TimerReset className="h-4 w-4" /> Log Play</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-display font-bold">Live Call Log</h3><Badge variant="outline">{logs.length} calls</Badge></div>
        {logs.length === 0 ? (
          <Card className="border-dashed border-border bg-card/60"><CardContent className="py-9 text-center text-sm text-muted-foreground"><Trophy className="h-7 w-7 mx-auto mb-2 text-[var(--school-secondary)]" />Start tracking the game. Every call gets saved with the exact field situation.</CardContent></Card>
        ) : logs.map((log) => (
          <Card key={log.id} className="broadcast-card"><CardContent className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 mb-2"><Badge className="bg-primary/10 text-primary hover:bg-primary/10">Q{log.quarter} · {displayClock(log.clock)}</Badge><Badge variant="outline">{log.down}{log.down === 1 ? "st" : log.down === 2 ? "nd" : log.down === 3 ? "rd" : "th"} & {log.distance}</Badge><Badge variant="secondary">{log.possession === "us" ? schoolName : opponentName} ball</Badge></div><p className="font-semibold text-sm truncate">{log.opponentPlay}</p><p className="mt-1 text-sm text-primary font-medium">Counter: {log.suggestedCounter}</p></div>
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setLogs((current) => current.filter((item) => item.id !== log.id))}><Trash2 className="h-4 w-4" /></Button>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

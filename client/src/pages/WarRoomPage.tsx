import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Radio, Shield, Swords, Zap, Dna, Activity, Search,
  Crosshair, FlaskConical, ClipboardList, Users2, Brain, Loader2,
  ChevronRight, Target, Flame,
} from "lucide-react";
import WarRoomCouncils from "@/components/warroom/WarRoomCouncils";
import OpponentDnaPanel from "@/components/warroom/OpponentDnaPanel";
import MomentumPanel from "@/components/warroom/MomentumPanel";
import AskFilmPanel from "@/components/warroom/AskFilmPanel";
import PredictorPanel from "@/components/warroom/PredictorPanel";
import CounterPlayPanel from "@/components/warroom/CounterPlayPanel";
import WhatIfPanel from "@/components/warroom/WhatIfPanel";
import PracticePanel from "@/components/warroom/PracticePanel";
import FootballIqPanel from "@/components/warroom/FootballIqPanel";

const WORKSPACES = [
  { id: "warroom", label: "War Room", icon: Radio, desc: "Coordinator councils + 3 halftime calls" },
  { id: "dna", label: "Opponent DNA", icon: Dna, desc: "Tendency profile & identity" },
  { id: "momentum", label: "Momentum", icon: Activity, desc: "Swing chart of the game" },
  { id: "askfilm", label: "Ask the Film", icon: Search, desc: "Search everything on tape" },
  { id: "predictor", label: "Next-Play Predictor", icon: Crosshair, desc: "What are they about to run?" },
  { id: "counter", label: "Counter-Play", icon: Swords, desc: "Playbook answers to their look" },
  { id: "whatif", label: "What-If Sim", icon: FlaskConical, desc: "Change the fit, see the outcome" },
  { id: "practice", label: "Practice + Scout", icon: ClipboardList, desc: "Timed plan & scout script" },
  { id: "iq", label: "Football IQ", icon: Brain, desc: "Player quiz from real film" },
] as const;

type WorkspaceId = (typeof WORKSPACES)[number]["id"];

export default function WarRoomPage() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [workspace, setWorkspace] = useState<WorkspaceId>("warroom");

  const { data: session, isLoading } = trpc.sessions.get.useQuery({ id: sessionId }, { enabled: sessionId > 0 });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Session not found.
        <Button variant="link" onClick={() => setLocation("/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-bg field-grid relative">
      {/* Cinematic header */}
      <div className="relative overflow-hidden border-b border-primary/15">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-transparent to-primary/5 pointer-events-none" />
        <div className="container py-6 relative">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={() => setLocation(`/session/${sessionId}`)}>
              <ArrowLeft className="h-4 w-4" /> Session
            </Button>
            <Badge variant="outline" className="font-tactical text-[10px] border-primary/40 text-primary anim-flicker">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
              LIVE INTEL
            </Badge>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="anim-rise">
              <div className="font-tactical text-xs text-primary/70 mb-1">TACTICAL COMMAND CENTER</div>
              <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                <span className="text-glow text-primary">WAR ROOM</span>
                <span className="text-muted-foreground/60 mx-3 font-light">vs</span>
                <span className="text-glow-white">{session.opponentName}</span>
              </h1>
            </div>
            <div className="flex items-center gap-2 anim-rise-2">
              <Flame className="h-4 w-4 text-primary" />
              <span className="font-tactical text-xs text-muted-foreground">Hudl stores the film. This tells you what to do next.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="container py-4 sticky top-0 z-20">
        <div className="glass rounded-xl p-2 flex gap-1 overflow-x-auto">
          {WORKSPACES.map((w, i) => {
            const Icon = w.icon;
            const active = workspace === w.id;
            return (
              <button
                key={w.id}
                onClick={() => setWorkspace(w.id)}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg font-tactical text-[11px] transition-all duration-200 active:scale-[0.97] ${
                  active
                    ? "bg-primary text-primary-foreground glow-primary-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
                title={w.desc}
              >
                <Icon className="h-3.5 w-3.5" />
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active workspace */}
      <div className="container pb-16 pt-2 relative z-10">
        {workspace === "warroom" && <WarRoomCouncils sessionId={sessionId} opponentName={session.opponentName} />}
        {workspace === "dna" && <OpponentDnaPanel sessionId={sessionId} opponentName={session.opponentName} />}
        {workspace === "momentum" && <MomentumPanel sessionId={sessionId} />}
        {workspace === "askfilm" && <AskFilmPanel sessionId={sessionId} />}
        {workspace === "predictor" && <PredictorPanel sessionId={sessionId} opponentName={session.opponentName} />}
        {workspace === "counter" && <CounterPlayPanel sessionId={sessionId} />}
        {workspace === "whatif" && <WhatIfPanel sessionId={sessionId} />}
        {workspace === "practice" && <PracticePanel sessionId={sessionId} />}
        {workspace === "iq" && <FootballIqPanel sessionId={sessionId} />}
      </div>
    </div>
  );
}

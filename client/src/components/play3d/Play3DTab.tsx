import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Box } from "lucide-react";
import Play3DVisualizer from "./Play3DVisualizer";
import { cn } from "@/lib/utils";

interface PlayDef {
  name: string;
  formation: string;
  type: string;
  target?: string;
  why?: string;
  source: "gameplan" | "library";
}

// Built-in play library so the 3D visualizer always has content
const PLAY_LIBRARY: PlayDef[] = [
  { name: "Four Verticals", formation: "Shotgun Spread", type: "pass", target: "X", source: "library" },
  { name: "Inside Zone", formation: "Pistol", type: "run", target: "RB", source: "library" },
  { name: "Trips Right Flood", formation: "Trips Right", type: "pass", target: "Y", source: "library" },
  { name: "Power O", formation: "I-Form", type: "run", target: "RB", source: "library" },
  { name: "RB Screen", formation: "Shotgun", type: "screen", target: "RB", source: "library" },
  { name: "Empty Quick Game", formation: "Empty 5 Wide", type: "pass", target: "H", source: "library" },
  { name: "Play Action Post", formation: "Twins 2x2", type: "play-action", target: "Z", source: "library" },
  { name: "Goal Line Dive", formation: "Goal Line Jumbo", type: "run", target: "FB", source: "library" },
];

export interface GamePlanPlays {
  scriptedPlays?: { playNumber?: number; name?: string; formation?: string; type?: string; target?: string; why?: string }[];
  opponentDefenseScheme?: string;
}

export default function Play3DTab({ gamePlan }: { sessionId?: number; gamePlan?: GamePlanPlays | null }) {

  const plays = useMemo<PlayDef[]>(() => {
    const list: PlayDef[] = [];
    const gp = gamePlan as any;
    if (gp?.scriptedPlays && Array.isArray(gp.scriptedPlays)) {
      for (const p of gp.scriptedPlays) {
        list.push({
          name: p.name || `Play ${p.playNumber}`,
          formation: p.formation || "Shotgun",
          type: p.type || "pass",
          target: p.target,
          why: p.why,
          source: "gameplan",
        });
      }
    }
    return [...list, ...PLAY_LIBRARY];
  }, [gamePlan]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = plays[selectedIdx] || PLAY_LIBRARY[0];
  const defenseScheme = (gamePlan as any)?.opponentDefenseScheme || "4-3";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Box className="h-5 w-5 text-[#00FF87] mt-0.5" />
        <div>
          <h3 className="text-lg font-bold text-white">3D Play Visualizer</h3>
          <p className="text-sm text-gray-400">
            Watch plays develop in real-time 3D. Drag to rotate, scroll to zoom, or use the camera presets.
            {(gamePlan as any)?.scriptedPlays?.length > 0
              ? " Plays from your generated game plan appear first."
              : " Generate a Game Plan to see your scripted plays here in 3D."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Play list */}
        <Card className="border-gray-800 lg:col-span-1 max-h-[600px] overflow-y-auto">
          <CardContent className="p-2 space-y-1">
            {plays.map((p, idx) => (
              <button
                key={`${p.source}-${idx}`}
                onClick={() => setSelectedIdx(idx)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-md transition-colors",
                  idx === selectedIdx
                    ? "bg-[#00FF87]/10 border border-[#00FF87]/40"
                    : "hover:bg-gray-800/60 border border-transparent"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm font-medium truncate", idx === selectedIdx ? "text-[#00FF87]" : "text-gray-200")}>
                    {p.name}
                  </span>
                  {p.source === "gameplan" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-[#00FF87]/50 text-[#00FF87] shrink-0">
                      PLAN
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {p.formation} · <span className="uppercase">{p.type}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* 3D viewer */}
        <div className="lg:col-span-3 space-y-3">
          <Play3DVisualizer
            key={`${selected.name}-${selected.formation}`}
            formation={selected.formation}
            playName={selected.name}
            playType={selected.type}
            target={selected.target}
            defenseScheme={defenseScheme}
            height={460}
            showBall
          />
          <div className="flex items-center gap-4 text-[11px] text-gray-500 px-1 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00FF87]" /> Your offense</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FF4757]" /> {defenseScheme} defense</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#FFD700]" /> Ball flight + catch point</span>
            <span className="text-gray-600">Run Play to see routes, ball throw, and the catch ring.</span>
          </div>
          {selected.why && (
            <Card className="border-gray-800 bg-gray-900/40">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Why this play</p>
                <p className="text-sm text-gray-300">{selected.why}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

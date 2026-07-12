import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Swords, Target, ShieldAlert, Users, ClipboardCheck, Zap } from "lucide-react";
import { FormationDiagram } from "./FormationDiagram";

interface GamePlanProps {
  sessionId: number;
  opponentName: string;
}

export function GamePlanGenerator({ sessionId, opponentName }: GamePlanProps) {
  const [teamStrengths, setTeamStrengths] = useState("");
  const [teamFormation, setTeamFormation] = useState("");
  const [gamePlan, setGamePlan] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("scripted");

  const generateMutation = trpc.gamePlan.generate.useMutation({
    onSuccess: (data) => setGamePlan(data),
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      sessionId,
      teamStrengths: teamStrengths || undefined,
      teamFormation: teamFormation || undefined,
    });
  };

  const typeColors: Record<string, string> = {
    run: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "play-action": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    screen: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    rpo: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Swords className="h-6 w-6 text-[#00FF87]" />
            Game Plan Generator
          </h2>
          <p className="text-gray-400 mt-1">
            AI-generated game plan based on scouting report for {opponentName}
          </p>
        </div>
      </div>

      {/* Input Section */}
      {!gamePlan && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Customize Your Game Plan</h3>
          <p className="text-sm text-gray-400">Optional: Add your team's info for a more tailored plan</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Your Team's Strengths</label>
              <Textarea
                placeholder="e.g., Fast WR corps, strong O-line run blocking, athletic QB who can scramble..."
                value={teamStrengths}
                onChange={(e) => setTeamStrengths(e.target.value)}
                className="bg-[#0D1117] border-[#30363D] text-white placeholder:text-gray-500 min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Your Base Formation</label>
              <Input
                placeholder="e.g., Spread, Pro Style, Wing-T, 3-4 Defense..."
                value={teamFormation}
                onChange={(e) => setTeamFormation(e.target.value)}
                className="bg-[#0D1117] border-[#30363D] text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="bg-[#00FF87] text-black font-bold hover:bg-[#00CC6A] w-full md:w-auto"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Game Plan...
              </>
            ) : (
              <>
                <Swords className="h-4 w-4 mr-2" />
                Generate Game Plan
              </>
            )}
          </Button>
        </div>
      )}

      {/* Game Plan Results */}
      {gamePlan && (
        <div className="space-y-6">
          {/* Overview */}
          <div className="bg-[#161B22] border border-[#00FF87]/30 rounded-lg p-5">
            <p className="text-gray-200 text-lg leading-relaxed">{gamePlan.overview}</p>
          </div>

          {/* Regenerate Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              variant="outline"
              className="border-[#30363D] text-gray-300 hover:bg-[#161B22]"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Regenerate Plan
            </Button>
          </div>

          {/* Tabbed Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#161B22] border border-[#30363D] w-full justify-start overflow-x-auto">
              <TabsTrigger value="scripted" className="data-[state=active]:bg-[#00FF87]/10 data-[state=active]:text-[#00FF87]">
                <Target className="h-4 w-4 mr-1" /> First 15
              </TabsTrigger>
              <TabsTrigger value="redzone" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
                <Zap className="h-4 w-4 mr-1" /> Red Zone
              </TabsTrigger>
              <TabsTrigger value="thirddown" className="data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400">
                <Swords className="h-4 w-4 mr-1" /> 3rd Down
              </TabsTrigger>
              <TabsTrigger value="defense" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400">
                <ShieldAlert className="h-4 w-4 mr-1" /> Defense
              </TabsTrigger>
              <TabsTrigger value="matchups" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
                <Users className="h-4 w-4 mr-1" /> Matchups
              </TabsTrigger>
              <TabsTrigger value="halftime" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
                <ClipboardCheck className="h-4 w-4 mr-1" /> Halftime
              </TabsTrigger>
            </TabsList>

            {/* Scripted Plays */}
            <TabsContent value="scripted" className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-white">First 15 Scripted Plays</h3>
              <p className="text-sm text-gray-400">Opening drive script designed to exploit their defensive weaknesses</p>
              <div className="space-y-2">
               {gamePlan.scriptedPlays?.map((play: any, i: number) => (
                 <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 hover:border-[#00FF87]/30 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Formation Diagram */}
                     <div className="shrink-0 hidden md:block">
                       <FormationDiagram
                         formation={play.formation || ""}
                         playName={play.name || ""}
                         playType={play.type || "pass"}
                         target={play.target}
                         compact
                          defenseScheme={play.defenseExpected || gamePlan.opponentDefenseScheme || "4-3"}
                       />
                      </div>
                      <div className="flex items-start justify-between gap-4 flex-1">
                        <div className="flex items-start gap-3">
                        <span className="bg-[#00FF87]/10 text-[#00FF87] font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                          {play.playNumber}
                        </span>
                        <div>
                          <h4 className="font-semibold text-white">{play.name}</h4>
                          <p className="text-sm text-gray-400 mt-0.5">{play.formation}</p>
                          <p className="text-sm text-gray-300 mt-2"><span className="text-[#00FF87]">Target:</span> {play.target}</p>
                          <p className="text-sm text-gray-400 mt-1"><span className="text-gray-300">Why:</span> {play.why}</p>
                          {play.defenseExpected && <p className="text-sm text-red-400/80 mt-1"><span className="text-red-400">vs:</span> {play.defenseExpected}</p>}
                        </div>
                        </div>
                        <Badge className={`${typeColors[play.type] || "bg-gray-500/20 text-gray-400"} shrink-0`}>
                          {play.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Red Zone */}
            <TabsContent value="redzone" className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-white">Red Zone Package</h3>
              <p className="text-sm text-gray-400">Scoring plays designed for inside the 20-yard line</p>
              <div className="space-y-2">
                {gamePlan.redZonePackage?.map((play: any, i: number) => (
                  <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 hover:border-red-500/30 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Formation Diagram */}
                      <div className="shrink-0 hidden md:block">
                        <FormationDiagram
                          formation={play.formation || ""}
                          playName={play.name || ""}
                          playType="pass"
                          target={play.target}
                          compact
                          defenseScheme={play.defenseExpected || gamePlan.opponentDefenseScheme || "4-3"}
                        />
                      </div>
                      <div className="flex items-start gap-3 flex-1">
                      <span className="bg-red-500/10 text-red-400 font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{play.name}</h4>
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">{play.situation}</Badge>
                        </div>
                        <p className="text-sm text-gray-400 mt-0.5">{play.formation}</p>
                        <p className="text-sm text-gray-300 mt-2"><span className="text-red-400">Target:</span> {play.target}</p>
                        <p className="text-sm text-gray-400 mt-1"><span className="text-gray-300">Why:</span> {play.why}</p>
                      </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* 3rd Down */}
            <TabsContent value="thirddown" className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-white">3rd Down Conversions</h3>
              <p className="text-sm text-gray-400">Money plays for critical third down situations</p>
              <div className="space-y-2">
                {gamePlan.thirdDownConversions?.map((play: any, i: number) => (
                  <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 hover:border-yellow-500/30 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Formation Diagram */}
                      <div className="shrink-0 hidden md:block">
                        <FormationDiagram
                          formation={play.formation || play.concept || ""}
                          playName={play.name || ""}
                          playType="pass"
                          target={play.target}
                          compact
                          defenseScheme={play.defenseExpected || gamePlan.opponentDefenseScheme || "nickel"}
                        />
                      </div>
                      <div className="flex items-start gap-3 flex-1">
                      <span className="bg-yellow-500/10 text-yellow-400 font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{play.name}</h4>
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">{play.situation}</Badge>
                        </div>
                        <p className="text-sm text-gray-300 mt-2"><span className="text-yellow-400">Concept:</span> {play.concept}</p>
                        <p className="text-sm text-gray-300 mt-1"><span className="text-yellow-400">Target:</span> {play.target}</p>
                        <p className="text-sm text-gray-400 mt-1"><span className="text-gray-300">Expected:</span> {play.expectedResult}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Defensive Adjustments */}
            <TabsContent value="defense" className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-white">Defensive Adjustments</h3>
              <p className="text-sm text-gray-400">Situational defensive calls to shut down their offense</p>
              <div className="space-y-2">
                {gamePlan.defensiveAdjustments?.map((adj: any, i: number) => (
                  <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 hover:border-blue-500/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="bg-blue-500/10 text-blue-400 font-bold text-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm text-blue-400 font-medium">When: {adj.situation}</p>
                        <h4 className="font-semibold text-white mt-1">{adj.adjustment}</h4>
                        <p className="text-sm text-gray-300 mt-2"><span className="text-blue-400">Key Player:</span> {adj.keyPlayer}</p>
                        <p className="text-sm text-gray-400 mt-1"><span className="text-gray-300">Why:</span> {adj.why}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Key Matchups */}
            <TabsContent value="matchups" className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-white">Key Matchups</h3>
              <p className="text-sm text-gray-400">Individual battles that will decide the game</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gamePlan.keyMatchups?.map((matchup: any, i: number) => (
                  <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-4 hover:border-purple-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-[#00FF87]/20 text-[#00FF87] border-[#00FF87]/30">{matchup.ourPlayer}</Badge>
                      <span className="text-gray-500 text-sm font-bold">VS</span>
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{matchup.theirPlayer}</Badge>
                    </div>
                    <p className="text-sm text-gray-300"><span className="text-purple-400">Strategy:</span> {matchup.strategy}</p>
                    <p className="text-sm text-yellow-400 mt-2 flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Alert: {matchup.alert}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Halftime Checklist */}
            <TabsContent value="halftime" className="mt-4 space-y-3">
              <h3 className="text-lg font-bold text-white">Halftime Checklist</h3>
              <p className="text-sm text-gray-400">Questions and adjustments to evaluate at the half</p>
              <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 space-y-3">
                {gamePlan.halftimeChecklist?.map((item: string, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded border-2 border-orange-500/50 shrink-0 mt-0.5 flex items-center justify-center">
                      <span className="text-xs text-orange-400">{i + 1}</span>
                    </div>
                    <p className="text-gray-200">{item}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Error State */}
      {generateMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">Failed to generate game plan. Please try again.</p>
        </div>
      )}
    </div>
  );
}

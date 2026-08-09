import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormationAnalytics } from "./FormationAnalytics";
import { PreSnapReadsAnalytics } from "./PreSnapReadsAnalytics";
import { TurnoverPredictorAnalytics } from "./TurnoverPredictorAnalytics";

interface AnalyticsHubProps {
  sessionId: number;
}

export function AnalyticsHub({ sessionId }: AnalyticsHubProps) {
  const [activeTab, setActiveTab] = useState("formations");

  return (
    <div className="w-full space-y-6">
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Advanced Video Analytics</h2>
          <p className="text-slate-400">Elite-level film analysis powered by AI</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800 border border-slate-700">
            <TabsTrigger
              value="formations"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Formations
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="presnap"
              className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-400"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Pre-Snap Reads
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="turnovers"
              className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-400"
            >
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Turnovers
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="formations" className="mt-6">
            <FormationAnalytics sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="presnap" className="mt-6">
            <PreSnapReadsAnalytics sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="turnovers" className="mt-6">
            <TurnoverPredictorAnalytics sessionId={sessionId} />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Info Banner */}
      <Card className="p-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/50">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-blue-400">💡 Tip:</span> These analytics are generated from your game film using advanced AI. Click "Analyze" on each tab to generate fresh insights based on the latest scouting report.
        </p>
      </Card>
    </div>
  );
}

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

interface TurnoverPredictorAnalyticsProps {
  sessionId: number;
}

export function TurnoverPredictorAnalytics({ sessionId }: TurnoverPredictorAnalyticsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: turnovers, isLoading, refetch } = trpc.analytics.getTurnovers.useQuery(
    { sessionId },
    { enabled: true }
  );

  const analyzeMutation = trpc.analytics.analyzeTurnovers.useMutation({
    onSuccess: () => {
      refetch();
      setIsAnalyzing(false);
    },
    onError: () => {
      setIsAnalyzing(false);
    },
  });

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    analyzeMutation.mutate({ sessionId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (!turnovers) {
    return (
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-4">Turnover Predictor AI</h3>
          <p className="text-slate-400 mb-6">Analyze interception, fumble, and sack vulnerability</p>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzeMutation.isPending}
            className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
          >
            {isAnalyzing || analyzeMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              "Analyze Turnover Risk"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Prepare risk summary data
  const riskSummaryData = turnovers.riskSummary
    ? [
        {
          name: "Risk Metrics",
          interception: (turnovers.riskSummary as any)?.avgInterceptionRisk || 0,
          fumble: (turnovers.riskSummary as any)?.avgFumbleRisk || 0,
          sack: (turnovers.riskSummary as any)?.avgSackVulnerability || 0,
        },
      ]
    : [];

  // Prepare individual play risks
  const playRisks = Array.isArray(turnovers.plays)
    ? turnovers.plays.slice(0, 10).map((p: any, idx: number) => ({
        play: `Play ${idx + 1}`,
        int: typeof p.interceptionRisk === 'number' ? p.interceptionRisk : 0,
        fum: typeof p.fumbleRisk === 'number' ? p.fumbleRisk : 0,
        sack: typeof p.sackVulnerability === 'number' ? p.sackVulnerability : 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Turnover Predictor</h3>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzeMutation.isPending}
            size="sm"
            className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
          >
            {isAnalyzing || analyzeMutation.isPending ? "Analyzing..." : "Re-Analyze"}
          </Button>
        </div>

        {/* Risk Summary */}
        {turnovers.riskSummary && typeof turnovers.riskSummary === 'object' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-slate-800 rounded-lg border border-red-700/50">
              <p className="text-xs font-semibold text-slate-400 mb-1">AVG INT RISK</p>
              <p className="text-2xl font-bold text-red-400">{(turnovers.riskSummary as any)?.avgInterceptionRisk || 0}%</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg border border-orange-700/50">
              <p className="text-xs font-semibold text-slate-400 mb-1">AVG FUMBLE RISK</p>
              <p className="text-2xl font-bold text-orange-400">{(turnovers.riskSummary as any)?.avgFumbleRisk || 0}%</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg border border-yellow-700/50">
              <p className="text-xs font-semibold text-slate-400 mb-1">AVG SACK RISK</p>
              <p className="text-2xl font-bold text-yellow-400">{(turnovers.riskSummary as any)?.avgSackVulnerability || 0}%</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-lg border border-red-700/50">
              <p className="text-xs font-semibold text-slate-400 mb-1">HIGH RISK PLAYS</p>
              <p className="text-2xl font-bold text-red-500">{(turnovers.riskSummary as any)?.highRiskPlays || 0}</p>
            </div>
          </div>
        )}

        {/* Risk Summary Chart */}
        {riskSummaryData.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-red-400 mb-4">Overall Risk Profile</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskSummaryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                <Legend />
                <Bar dataKey="interception" fill="#EF4444" name="INT Risk %" />
                <Bar dataKey="fumble" fill="#F97316" name="Fumble Risk %" />
                <Bar dataKey="sack" fill="#EAB308" name="Sack Risk %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Individual Play Risks */}
        {playRisks.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-orange-400 mb-4">Play-by-Play Risk Analysis</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={playRisks}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="play" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                <Legend />
                <Line type="monotone" dataKey="int" stroke="#EF4444" name="INT Risk %" dot={false} />
                <Line type="monotone" dataKey="fum" stroke="#F97316" name="Fumble Risk %" dot={false} />
                <Line type="monotone" dataKey="sack" stroke="#EAB308" name="Sack Risk %" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* High Risk Plays with Recommendations */}
        {Array.isArray(turnovers.plays) && turnovers.plays.length > 0 && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold text-yellow-400 mb-4">Play Recommendations</h4>
            <div className="space-y-3">
              {turnovers.plays.slice(0, 5).map((p: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-white">Play {idx + 1}</p>
                    <div className="flex gap-2 text-xs">
                      <span className={`px-2 py-1 rounded ${p.interceptionRisk > 50 ? 'bg-red-900 text-red-200' : 'bg-slate-700 text-slate-300'}`}>
                        INT: {p.interceptionRisk}%
                      </span>
                      <span className={`px-2 py-1 rounded ${p.fumbleRisk > 30 ? 'bg-orange-900 text-orange-200' : 'bg-slate-700 text-slate-300'}`}>
                        FUM: {p.fumbleRisk}%
                      </span>
                    </div>
                  </div>
                  <p className="text-emerald-400 text-sm">💡 {p.recommendation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

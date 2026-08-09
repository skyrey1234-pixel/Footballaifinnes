import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface FormationAnalyticsProps {
  sessionId: number;
}

const COLORS = ["#00FF87", "#00D9FF", "#FF6B9D", "#FFB800", "#7C3AED"];

export function FormationAnalytics({ sessionId }: FormationAnalyticsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: formations, isLoading, refetch } = trpc.analytics.getFormations.useQuery(
    { sessionId },
    { enabled: true }
  );

  const analyzeMutation = trpc.analytics.analyzeFormations.useMutation({
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

  if (!formations) {
    return (
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-4">Formation Recognition AI</h3>
          <p className="text-slate-400 mb-6">Analyze offensive and defensive formations from your game film</p>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzeMutation.isPending}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
          >
            {isAnalyzing || analyzeMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              "Analyze Formations"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Prepare data for charts
  const offensiveData = formations.offensiveFormations
    ? Object.entries(formations.offensiveFormations).map(([name, value]) => ({
        name,
        value: typeof value === 'number' ? value : 0,
      }))
    : [];

  const defensiveData = formations.defensiveFormations
    ? Object.entries(formations.defensiveFormations).map(([name, value]) => ({
        name,
        value: typeof value === 'number' ? value : 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Formation Recognition</h3>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzeMutation.isPending}
            size="sm"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
          >
            {isAnalyzing || analyzeMutation.isPending ? "Analyzing..." : "Re-Analyze"}
          </Button>
        </div>

        {/* Offensive Formations */}
        {offensiveData.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-emerald-400 mb-4">Offensive Formations</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={offensiveData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#00FF87"
                  dataKey="value"
                >
                  {offensiveData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Defensive Formations */}
        {defensiveData.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-cyan-400 mb-4">Defensive Formations</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={defensiveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }}
                  formatter={(value) => `${value}%`}
                />
                <Bar dataKey="value" fill="#00D9FF" name="Frequency %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Predictions */}
        {formations.predictions && typeof formations.predictions === 'object' && Object.keys(formations.predictions as any).length > 0 && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold text-purple-400 mb-4">Situational Predictions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(formations.predictions as any).map(([situation, pred]: [string, any]) => (
                <div key={situation} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <p className="text-sm font-semibold text-slate-300 mb-2">{situation}</p>
                  <p className="text-white font-bold mb-1">{pred.formation}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Confidence: {pred.confidence}%</span>
                    <span className="text-emerald-400">{pred.predictedPlay}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

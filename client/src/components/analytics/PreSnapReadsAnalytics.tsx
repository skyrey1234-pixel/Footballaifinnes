import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface PreSnapReadsAnalyticsProps {
  sessionId: number;
}

const COLORS = ["#00FF87", "#00D9FF", "#FF6B9D", "#FFB800", "#7C3AED"];

export function PreSnapReadsAnalytics({ sessionId }: PreSnapReadsAnalyticsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: preSnapReads, isLoading, refetch } = trpc.analytics.getPreSnapReads.useQuery(
    { sessionId },
    { enabled: true }
  );

  const analyzeMutation = trpc.analytics.analyzePreSnapReads.useMutation({
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

  if (!preSnapReads) {
    return (
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-4">Pre-Snap Reads & Coverage Recognition</h3>
          <p className="text-slate-400 mb-6">Analyze QB reads, coverage types, and blitz packages</p>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzeMutation.isPending}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
          >
            {isAnalyzing || analyzeMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              "Analyze Pre-Snap Reads"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  // Prepare data for charts
  const coverageData = preSnapReads.coverageTypes
    ? Object.entries(preSnapReads.coverageTypes).map(([name, value]) => ({
        name,
        value: typeof value === 'number' ? value : 0,
      }))
    : [];

  const blitzData = Array.isArray(preSnapReads.blitzTendencies)
    ? preSnapReads.blitzTendencies.map((b: any) => ({
        name: b.blitzType || "Unknown",
        frequency: typeof b.frequency === 'number' ? b.frequency : 0,
        effectiveness: typeof b.effectiveness === 'number' ? b.effectiveness : 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Pre-Snap Reads & Coverage</h3>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || analyzeMutation.isPending}
            size="sm"
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
          >
            {isAnalyzing || analyzeMutation.isPending ? "Analyzing..." : "Re-Analyze"}
          </Button>
        </div>

        {/* Coverage Types */}
        {coverageData.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-cyan-400 mb-4">Coverage Types Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={coverageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill="#00D9FF"
                  dataKey="value"
                >
                  {coverageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Blitz Tendencies */}
        {blitzData.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-orange-400 mb-4">Blitz Packages & Effectiveness</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={blitzData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94A3B8" />
                <YAxis stroke="#94A3B8" />
                <Tooltip contentStyle={{ backgroundColor: "#1E293B", border: "1px solid #475569" }} />
                <Legend />
                <Bar dataKey="frequency" fill="#FFB800" name="Frequency %" />
                <Bar dataKey="effectiveness" fill="#FF6B9D" name="Effectiveness %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Drill Questions */}
        {Array.isArray(preSnapReads.drilQuestions) && preSnapReads.drilQuestions.length > 0 && (
          <div className="mt-8">
            <h4 className="text-lg font-semibold text-purple-400 mb-4">Pre-Snap Drill Questions</h4>
            <div className="space-y-3">
              {preSnapReads.drilQuestions.map((q: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <p className="text-sm font-semibold text-slate-300 mb-2">Scenario {idx + 1}</p>
                  <p className="text-white mb-2">{q.scenario}</p>
                  <p className="text-emerald-400 text-sm mb-1">✓ {q.correctAnswer}</p>
                  <p className="text-slate-400 text-xs">{q.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

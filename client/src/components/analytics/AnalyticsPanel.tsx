// @ts-nocheck
import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis } from "recharts";

interface AnalyticsPanelProps {
  sessionId: number;
}

const COLORS = ["#00FF87", "#00D9FF", "#FF6B9D", "#FFB800", "#7C3AED", "#F43F5E", "#06B6D4", "#8B5CF6"];

function AnalyticsCard({ title, icon, gradient, children, onAnalyze, isAnalyzing, hasData }: {
  title: string; icon: string; gradient: string; children: React.ReactNode;
  onAnalyze: () => void; isAnalyzing: boolean; hasData: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={`p-4 bg-gradient-to-br ${gradient} border-slate-700/50 transition-all duration-300`}>
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {hasData && <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">✓ Analyzed</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
            disabled={isAnalyzing}
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white text-xs"
          >
            {isAnalyzing ? <><Spinner className="mr-1 h-3 w-3" /> Analyzing...</> : hasData ? "Re-Analyze" : "Analyze"}
          </Button>
          <span className="text-slate-400 text-sm">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && <div className="mt-4 pt-4 border-t border-slate-700/50">{children}</div>}
    </Card>
  );
}

function DataGrid({ data, columns }: { data: Record<string, any>; columns?: string[] }) {
  if (!data || typeof data !== 'object') return <p className="text-slate-500 text-sm">No data available</p>;
  const entries = Object.entries(data);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.slice(0, 12).map(([key, val]) => (
        <div key={key} className="p-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-400 truncate">{key.replace(/_/g, ' ')}</p>
          <p className="text-sm font-bold text-white mt-1">{typeof val === 'object' ? JSON.stringify(val).slice(0, 30) : String(val)}</p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPanel({ sessionId }: AnalyticsPanelProps) {
  // Wave 1
  const formations = trpc.analytics.getFormations.useQuery({ sessionId });
  const preSnap = trpc.analytics.getPreSnapReads.useQuery({ sessionId });
  const turnovers = trpc.analytics.getTurnovers.useQuery({ sessionId });
  // Wave 2
  const heatMaps = trpc.analytics2.getHeatMaps.useQuery({ sessionId });
  const routeTree = trpc.analytics2.getRouteTree.useQuery({ sessionId });
  const blocking = trpc.analytics2.getBlocking.useQuery({ sessionId });
  const momentum = trpc.analytics2.getMomentum.useQuery({ sessionId });
  // Wave 3
  const gaps = trpc.analytics2.getGaps.useQuery({ sessionId });
  const injury = trpc.analytics2.getInjuryImpact.useQuery({ sessionId });
  const penalties = trpc.analytics2.getPenalties.useQuery({ sessionId });
  const redZone = trpc.analytics2.getRedZone.useQuery({ sessionId });
  const thirdDown = trpc.analytics2.getThirdDown.useQuery({ sessionId });
  const twoMinute = trpc.analytics2.getTwoMinute.useQuery({ sessionId });
  const situational = trpc.analytics2.getSituational.useQuery({ sessionId });
  const playerComps = trpc.analytics2.getPlayerComparisons.useQuery({ sessionId });

  // Mutations
  const analyzeFormations = trpc.analytics.analyzeFormations.useMutation({ onSuccess: () => formations.refetch() });
  const analyzePreSnap = trpc.analytics.analyzePreSnapReads.useMutation({ onSuccess: () => preSnap.refetch() });
  const analyzeTurnovers = trpc.analytics.analyzeTurnovers.useMutation({ onSuccess: () => turnovers.refetch() });
  const analyzeHeatMaps = trpc.analytics2.analyzeHeatMaps.useMutation({ onSuccess: () => heatMaps.refetch() });
  const analyzeRouteTree = trpc.analytics2.analyzeRouteTree.useMutation({ onSuccess: () => routeTree.refetch() });
  const analyzeBlocking = trpc.analytics2.analyzeBlocking.useMutation({ onSuccess: () => blocking.refetch() });
  const analyzeMomentum = trpc.analytics2.analyzeMomentum.useMutation({ onSuccess: () => momentum.refetch() });
  const analyzeGaps = trpc.analytics2.analyzeGaps.useMutation({ onSuccess: () => gaps.refetch() });
  const analyzeInjury = trpc.analytics2.analyzeInjuryImpact.useMutation({ onSuccess: () => injury.refetch() });
  const analyzePenalties = trpc.analytics2.analyzePenalties.useMutation({ onSuccess: () => penalties.refetch() });
  const analyzeRedZone = trpc.analytics2.analyzeRedZone.useMutation({ onSuccess: () => redZone.refetch() });
  const analyzeThirdDown = trpc.analytics2.analyzeThirdDown.useMutation({ onSuccess: () => thirdDown.refetch() });
  const analyzeTwoMinute = trpc.analytics2.analyzeTwoMinute.useMutation({ onSuccess: () => twoMinute.refetch() });
  const analyzeSituational = trpc.analytics2.analyzeSituational.useMutation({ onSuccess: () => situational.refetch() });
  const analyzePlayerComps = trpc.analytics2.analyzePlayerComparisons.useMutation({ onSuccess: () => playerComps.refetch() });

  const [runningAll, setRunningAll] = useState(false);

  const runAllAnalytics = async () => {
    setRunningAll(true);
    try {
      await Promise.allSettled([
        analyzeFormations.mutateAsync({ sessionId }),
        analyzePreSnap.mutateAsync({ sessionId }),
        analyzeTurnovers.mutateAsync({ sessionId }),
        analyzeHeatMaps.mutateAsync({ sessionId }),
        analyzeRouteTree.mutateAsync({ sessionId }),
        analyzeBlocking.mutateAsync({ sessionId }),
        analyzeMomentum.mutateAsync({ sessionId }),
        analyzeGaps.mutateAsync({ sessionId }),
        analyzeInjury.mutateAsync({ sessionId }),
        analyzePenalties.mutateAsync({ sessionId }),
        analyzeRedZone.mutateAsync({ sessionId }),
        analyzeThirdDown.mutateAsync({ sessionId }),
        analyzeTwoMinute.mutateAsync({ sessionId }),
        analyzeSituational.mutateAsync({ sessionId }),
        analyzePlayerComps.mutateAsync({ sessionId }),
      ]);
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Advanced Video Analytics</h2>
          <p className="text-slate-400 text-sm mt-1">15 AI-powered analysis modules</p>
        </div>
        <Button
          onClick={runAllAnalytics}
          disabled={runningAll}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold"
        >
          {runningAll ? <><Spinner className="mr-2 h-4 w-4" /> Running All...</> : "⚡ Run All 15 Analytics"}
        </Button>
      </div>

      {/* WAVE 1: Core Intelligence */}
      <div className="mb-2">
        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Wave 1 — Core Intelligence</h3>
      </div>

      <AnalyticsCard title="Formation Recognition" icon="🎯" gradient="from-slate-900 to-emerald-950"
        onAnalyze={() => analyzeFormations.mutate({ sessionId })} isAnalyzing={analyzeFormations.isPending} hasData={!!formations.data}>
        {formations.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-emerald-400">Offensive Formations</h4>
            <DataGrid data={formations.data.offensiveFormations as any} />
            <h4 className="text-sm font-semibold text-cyan-400 mt-4">Defensive Formations</h4>
            <DataGrid data={formations.data.defensiveFormations as any} />
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to detect formations</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Pre-Snap Reads" icon="🧠" gradient="from-slate-900 to-blue-950"
        onAnalyze={() => analyzePreSnap.mutate({ sessionId })} isAnalyzing={analyzePreSnap.isPending} hasData={!!preSnap.data}>
        {preSnap.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-blue-400">Coverage Types</h4>
            <DataGrid data={preSnap.data.coverageTypes as any} />
            <h4 className="text-sm font-semibold text-purple-400 mt-4">Blitz Tendencies</h4>
            {Array.isArray(preSnap.data.blitzTendencies) && preSnap.data.blitzTendencies.map((b: any, i: number) => (
              <div key={i} className="p-2 bg-slate-800/50 rounded text-sm text-white">{b.blitzType}: {b.frequency}% freq, {Math.round(b.effectiveness * 100)}% effective</div>
            ))}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to identify coverages and blitz packages</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Turnover Predictor" icon="⚠️" gradient="from-slate-900 to-red-950"
        onAnalyze={() => analyzeTurnovers.mutate({ sessionId })} isAnalyzing={analyzeTurnovers.isPending} hasData={!!turnovers.data}>
        {turnovers.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-red-900/30 rounded-lg text-center">
                <p className="text-xs text-red-300">INT Risk</p>
                <p className="text-xl font-bold text-red-400">{(turnovers.data.riskSummary as any)?.avgInterceptionRisk || 0}%</p>
              </div>
              <div className="p-3 bg-orange-900/30 rounded-lg text-center">
                <p className="text-xs text-orange-300">Fumble Risk</p>
                <p className="text-xl font-bold text-orange-400">{(turnovers.data.riskSummary as any)?.avgFumbleRisk || 0}%</p>
              </div>
              <div className="p-3 bg-yellow-900/30 rounded-lg text-center">
                <p className="text-xs text-yellow-300">Sack Risk</p>
                <p className="text-xl font-bold text-yellow-400">{(turnovers.data.riskSummary as any)?.avgSackVulnerability || 0}%</p>
              </div>
            </div>
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to predict turnover risk</p>}
      </AnalyticsCard>

      {/* WAVE 2: Visual Intelligence */}
      <div className="mt-6 mb-2">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">Wave 2 — Visual Intelligence</h3>
      </div>

      <AnalyticsCard title="Player Heat Maps" icon="🔥" gradient="from-slate-900 to-orange-950"
        onAnalyze={() => analyzeHeatMaps.mutate({ sessionId })} isAnalyzing={analyzeHeatMaps.isPending} hasData={!!heatMaps.data}>
        {heatMaps.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-orange-400">Alignment Tendencies</h4>
            <DataGrid data={heatMaps.data.alignmentTendencies as any} />
            <h4 className="text-sm font-semibold text-yellow-400 mt-4">Motion Tracking</h4>
            {heatMaps.data.motionTracking && (
              <div className="text-sm text-slate-300">
                {Array.isArray((heatMaps.data.motionTracking as any)?.presnap) && (heatMaps.data.motionTracking as any).presnap.map((m: any, i: number) => (
                  <div key={i} className="p-2 bg-slate-800/50 rounded mb-1">{m.player}: {m.motion} ({m.frequency}%)</div>
                ))}
              </div>
            )}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to generate player positioning heat maps</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Route Tree Analyzer" icon="🌳" gradient="from-slate-900 to-green-950"
        onAnalyze={() => analyzeRouteTree.mutate({ sessionId })} isAnalyzing={analyzeRouteTree.isPending} hasData={!!routeTree.data}>
        {routeTree.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-green-400">Route Effectiveness</h4>
            {Array.isArray(routeTree.data.routes) && routeTree.data.routes.slice(0, 6).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                <span className="text-white text-sm font-medium">{r.receiver} — {r.routeType}</span>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-400">Catch: {r.catchRate}%</span>
                  <span className="text-cyan-400">Sep: {r.avgSeparation}yd</span>
                  <span className="text-yellow-400">YAC: {r.avgYAC}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to break down the route tree</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Blocking Tracker" icon="🛡️" gradient="from-slate-900 to-indigo-950"
        onAnalyze={() => analyzeBlocking.mutate({ sessionId })} isAnalyzing={analyzeBlocking.isPending} hasData={!!blocking.data}>
        {blocking.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-indigo-400">OL Grades</h4>
            <DataGrid data={blocking.data.grades as any} />
            <h4 className="text-sm font-semibold text-purple-400 mt-4">Run Fit Analysis</h4>
            <DataGrid data={blocking.data.runFitAnalysis as any} />
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to grade blocking assignments</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Momentum & Game Flow" icon="📈" gradient="from-slate-900 to-violet-950"
        onAnalyze={() => analyzeMomentum.mutate({ sessionId })} isAnalyzing={analyzeMomentum.isPending} hasData={!!momentum.data}>
        {momentum.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-violet-400">Swing Moments</h4>
            {Array.isArray(momentum.data.swingMoments) && momentum.data.swingMoments.map((s: any, i: number) => (
              <div key={i} className="p-2 bg-slate-800/50 rounded text-sm">
                <span className={`font-bold ${s.impact > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{s.impact > 0 ? '+' : ''}{s.impact}</span>
                <span className="text-white ml-2">{s.trigger}</span>
                <p className="text-slate-400 text-xs mt-1">{s.description}</p>
              </div>
            ))}
            <h4 className="text-sm font-semibold text-pink-400 mt-4">Emotional Indicators</h4>
            <DataGrid data={momentum.data.emotionalIndicators as any} />
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to track game momentum</p>}
      </AnalyticsCard>

      {/* WAVE 3: Situational Mastery */}
      <div className="mt-6 mb-2">
        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">Wave 3 — Situational Mastery</h3>
      </div>

      <AnalyticsCard title="Gap Assignment Analyzer" icon="🕳️" gradient="from-slate-900 to-amber-950"
        onAnalyze={() => analyzeGaps.mutate({ sessionId })} isAnalyzing={analyzeGaps.isPending} hasData={!!gaps.data}>
        {gaps.data ? (
          <div className="space-y-4">
            <DataGrid data={gaps.data.gapAssignments as any} />
            {Array.isArray(gaps.data.blitzPackages) && gaps.data.blitzPackages.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-amber-400 mb-2">Blitz Packages</h4>
                {gaps.data.blitzPackages.map((b: any, i: number) => (
                  <div key={i} className="p-2 bg-slate-800/50 rounded text-sm text-white mb-1">{b.package}: {b.frequency}% freq, {b.pressureRate}% pressure</div>
                ))}
              </div>
            )}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to break down gap assignments</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Injury Impact Analyzer" icon="🏥" gradient="from-slate-900 to-rose-950"
        onAnalyze={() => analyzeInjury.mutate({ sessionId })} isAnalyzing={analyzeInjury.isPending} hasData={!!injury.data}>
        {injury.data ? (
          <div className="space-y-4">
            {Array.isArray(injury.data.keyPlayers) && injury.data.keyPlayers.map((p: any, i: number) => (
              <div key={i} className="p-3 bg-slate-800/50 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">{p.player}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${p.impactScore > 80 ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>Impact: {p.impactScore}</span>
                </div>
                <p className="text-slate-400 text-xs mt-1">Backup: {p.replacement} (−{p.performanceDrop}% drop)</p>
              </div>
            ))}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to assess injury vulnerability</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Penalty Pattern Analyzer" icon="🚩" gradient="from-slate-900 to-yellow-950"
        onAnalyze={() => analyzePenalties.mutate({ sessionId })} isAnalyzing={analyzePenalties.isPending} hasData={!!penalties.data}>
        {penalties.data ? (
          <div className="space-y-4">
            {penalties.data.costAnalysis && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-yellow-900/30 rounded-lg text-center">
                  <p className="text-xs text-yellow-300">Total Yards</p>
                  <p className="text-xl font-bold text-yellow-400">{(penalties.data.costAnalysis as any)?.totalYards}</p>
                </div>
                <div className="p-3 bg-red-900/30 rounded-lg text-center">
                  <p className="text-xs text-red-300">Drive Killers</p>
                  <p className="text-xl font-bold text-red-400">{(penalties.data.costAnalysis as any)?.driveKillers}</p>
                </div>
                <div className="p-3 bg-orange-900/30 rounded-lg text-center">
                  <p className="text-xs text-orange-300">Points Cost</p>
                  <p className="text-xl font-bold text-orange-400">{(penalties.data.costAnalysis as any)?.scoringImpact}</p>
                </div>
              </div>
            )}
            <DataGrid data={penalties.data.patterns as any} />
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to identify penalty patterns</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Red Zone Efficiency" icon="🎯" gradient="from-slate-900 to-red-950"
        onAnalyze={() => analyzeRedZone.mutate({ sessionId })} isAnalyzing={analyzeRedZone.isPending} hasData={!!redZone.data}>
        {redZone.data ? (
          <div className="space-y-4">
            {redZone.data.efficiency && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-900/30 rounded-lg text-center">
                  <p className="text-xs text-emerald-300">Rate</p>
                  <p className="text-xl font-bold text-emerald-400">{(redZone.data.efficiency as any)?.rate}%</p>
                </div>
                <div className="p-3 bg-green-900/30 rounded-lg text-center">
                  <p className="text-xs text-green-300">TDs</p>
                  <p className="text-xl font-bold text-green-400">{(redZone.data.efficiency as any)?.touchdowns}</p>
                </div>
                <div className="p-3 bg-yellow-900/30 rounded-lg text-center">
                  <p className="text-xs text-yellow-300">FGs</p>
                  <p className="text-xl font-bold text-yellow-400">{(redZone.data.efficiency as any)?.fieldGoals}</p>
                </div>
                <div className="p-3 bg-red-900/30 rounded-lg text-center">
                  <p className="text-xs text-red-300">TOs</p>
                  <p className="text-xl font-bold text-red-400">{(redZone.data.efficiency as any)?.turnovers}</p>
                </div>
              </div>
            )}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to assess red zone efficiency</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Third-Down Efficiency" icon="3️⃣" gradient="from-slate-900 to-teal-950"
        onAnalyze={() => analyzeThirdDown.mutate({ sessionId })} isAnalyzing={analyzeThirdDown.isPending} hasData={!!thirdDown.data}>
        {thirdDown.data ? (
          <div className="space-y-4">
            {thirdDown.data.conversionRate && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-teal-900/30 rounded-lg text-center">
                  <p className="text-xs text-teal-300">Overall</p>
                  <p className="text-xl font-bold text-teal-400">{(thirdDown.data.conversionRate as any)?.overall}%</p>
                </div>
                <div className="p-3 bg-emerald-900/30 rounded-lg text-center">
                  <p className="text-xs text-emerald-300">Short</p>
                  <p className="text-xl font-bold text-emerald-400">{(thirdDown.data.conversionRate as any)?.short}%</p>
                </div>
                <div className="p-3 bg-yellow-900/30 rounded-lg text-center">
                  <p className="text-xs text-yellow-300">Medium</p>
                  <p className="text-xl font-bold text-yellow-400">{(thirdDown.data.conversionRate as any)?.medium}%</p>
                </div>
                <div className="p-3 bg-red-900/30 rounded-lg text-center">
                  <p className="text-xs text-red-300">Long</p>
                  <p className="text-xl font-bold text-red-400">{(thirdDown.data.conversionRate as any)?.long}%</p>
                </div>
              </div>
            )}
            <DataGrid data={thirdDown.data.byDistance as any} />
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to break down third-down efficiency</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Two-Minute Drill" icon="⏱️" gradient="from-slate-900 to-sky-950"
        onAnalyze={() => analyzeTwoMinute.mutate({ sessionId })} isAnalyzing={analyzeTwoMinute.isPending} hasData={!!twoMinute.data}>
        {twoMinute.data ? (
          <div className="space-y-4">
            {twoMinute.data.drillEfficiency && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-sky-900/30 rounded-lg text-center">
                  <p className="text-xs text-sky-300">Attempts</p>
                  <p className="text-xl font-bold text-sky-400">{(twoMinute.data.drillEfficiency as any)?.attempts}</p>
                </div>
                <div className="p-3 bg-emerald-900/30 rounded-lg text-center">
                  <p className="text-xs text-emerald-300">Scores</p>
                  <p className="text-xl font-bold text-emerald-400">{(twoMinute.data.drillEfficiency as any)?.scores}</p>
                </div>
                <div className="p-3 bg-yellow-900/30 rounded-lg text-center">
                  <p className="text-xs text-yellow-300">Avg Time</p>
                  <p className="text-xl font-bold text-yellow-400">{(twoMinute.data.drillEfficiency as any)?.avgTimeUsed}s</p>
                </div>
                <div className="p-3 bg-purple-900/30 rounded-lg text-center">
                  <p className="text-xs text-purple-300">Avg Plays</p>
                  <p className="text-xl font-bold text-purple-400">{(twoMinute.data.drillEfficiency as any)?.avgPlays}</p>
                </div>
              </div>
            )}
            {twoMinute.data.clutchPerformance && (
              <div className="mt-3">
                <h4 className="text-sm font-semibold text-sky-400 mb-2">Clutch Performance</h4>
                <DataGrid data={twoMinute.data.clutchPerformance as any} />
              </div>
            )}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to evaluate two-minute drill efficiency</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Situational Football" icon="🎲" gradient="from-slate-900 to-fuchsia-950"
        onAnalyze={() => analyzeSituational.mutate({ sessionId })} isAnalyzing={analyzeSituational.isPending} hasData={!!situational.data}>
        {situational.data ? (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-fuchsia-400">Down & Distance Tendencies</h4>
            <DataGrid data={situational.data.downAndDistance as any} />
            {situational.data.predictiveModel && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-purple-400 mb-2">Predictive Model</h4>
                <DataGrid data={situational.data.predictiveModel as any} />
              </div>
            )}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to break down situational tendencies</p>}
      </AnalyticsCard>

      <AnalyticsCard title="Player Comparison Tool" icon="👥" gradient="from-slate-900 to-lime-950"
        onAnalyze={() => analyzePlayerComps.mutate({ sessionId })} isAnalyzing={analyzePlayerComps.isPending} hasData={!!playerComps.data}>
        {playerComps.data ? (
          <div className="space-y-4">
            {Array.isArray(playerComps.data.comparisons) && playerComps.data.comparisons.map((c: any, i: number) => (
              <div key={i} className="p-3 bg-slate-800/50 rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-emerald-400 font-medium text-sm">{c.ourPlayer}</span>
                  <span className="text-slate-500 text-xs">vs</span>
                  <span className="text-red-400 font-medium text-sm">{c.theirPlayer}</span>
                </div>
                <p className="text-white text-xs">{c.advantage}</p>
              </div>
            ))}
            {playerComps.data.overallAssessment && (
              <div className="mt-3 p-3 bg-lime-900/20 rounded border border-lime-700/30">
                <p className="text-lime-400 text-sm font-semibold">Team Strength: {(playerComps.data.overallAssessment as any)?.teamStrength}</p>
                <p className="text-red-400 text-xs mt-1">Weakness: {(playerComps.data.overallAssessment as any)?.weaknesses}</p>
              </div>
            )}
          </div>
        ) : <p className="text-slate-500 text-sm">Click Analyze to compare players head-to-head</p>}
      </AnalyticsCard>
    </div>
  );
}

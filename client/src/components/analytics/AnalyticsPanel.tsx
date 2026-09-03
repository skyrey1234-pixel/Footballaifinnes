import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, BarChart3, Brain, ChevronDown, Clock3, Download,
  FileDown, Flame, GitCompareArrows, Goal, Grid3X3, Route, Shield,
  ShieldAlert, Target, TimerReset, Users, Verified, Zap,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { downloadAnalyticsCsv, extractNumericMetrics, printAnalyticsPdf } from "@/lib/analyticsExport";
import { useLocation } from "wouter";

type ModuleId = "formations" | "presnap" | "turnovers" | "heatMaps" | "routeTree" | "blocking" | "momentum" | "gaps" | "injury" | "penalties" | "redZone" | "thirdDown" | "twoMinute" | "situational" | "playerComparisons";
type QualityRun = {
  module: string;
  status: "ready" | "insufficient" | "failed";
  summary: string | null;
  confidence: number;
  dataBasis: string;
  evidence: unknown;
  missingInputs: unknown;
  limitations: unknown;
  coachVerified: number;
};
type ModuleConfig = {
  id: ModuleId;
  title: string;
  description: string;
  icon: LucideIcon;
  data: any;
  isPending: boolean;
  analyze: (context?: string) => Promise<unknown>;
};

const asStrings = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const asObjects = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)) : [];
const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const cleanAnalysis = (data: any) => data && typeof data === "object" ? Object.fromEntries(Object.entries(data).filter(([key]) => !["id", "sessionId", "createdAt", "updatedAt"].includes(key))) : data;

function QualityBadge({ quality }: { quality?: QualityRun }) {
  if (!quality) return <Badge variant="outline" className="border-white/10 text-white/35">Legacy · not audited</Badge>;
  if (quality.coachVerified) return <Badge className="border border-emerald-300/30 bg-emerald-400/15 text-emerald-200"><Verified className="mr-1 h-3 w-3" />Coach verified</Badge>;
  if (quality.status === "ready") return <Badge className="border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">AI estimate · {quality.confidence}%</Badge>;
  return <Badge className="border border-amber-300/25 bg-amber-400/10 text-amber-200"><AlertTriangle className="mr-1 h-3 w-3" />Needs data</Badge>;
}

function NumericSnapshot({ data }: { data: unknown }) {
  const rows = extractNumericMetrics(data, 8);
  if (!rows.length) return null;
  return (
    <div className="border border-white/8 bg-black/20 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Numeric snapshot · AI-estimated unless coach verified</p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 18 }}>
            <CartesianGrid stroke="rgba(255,255,255,.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis type="category" dataKey="label" width={115} tick={{ fill: "#94a3b8", fontSize: 9 }} />
            <Tooltip contentStyle={{ background: "#07100c", border: "1px solid rgba(52,211,153,.25)", fontSize: 12 }} />
            <Bar dataKey="value" fill="#10d99a" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ModuleVisualization({ module, data }: { module: ModuleId; data: any }) {
  if (module === "momentum" && Array.isArray(data?.momentumGraph) && data.momentumGraph.length) {
    return <div className="h-56 border border-white/8 bg-black/20 p-4"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.momentumGraph}><CartesianGrid stroke="rgba(255,255,255,.06)" /><XAxis dataKey="play" tick={{ fill: "#64748b", fontSize: 10 }} /><YAxis tick={{ fill: "#64748b", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#07100c", border: "1px solid rgba(52,211,153,.25)" }} /><Line type="monotone" dataKey="momentum" stroke="#10d99a" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>;
  }
  if (module === "heatMaps") {
    const zones = Object.values(data?.preSnapHeatMaps ?? {}).flatMap((player: any) => Array.isArray(player?.zones) ? player.zones : []).filter((zone: any) => Number.isFinite(Number(zone?.x)) && Number.isFinite(Number(zone?.y)));
    if (zones.length) return <div className="relative min-h-[240px] overflow-hidden border border-emerald-400/20 bg-[linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:10%_20%]"><div className="absolute inset-x-0 top-1/2 border-t border-white/15" />{zones.slice(0, 24).map((zone: any, index: number) => <div key={index} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/35 ring-1 ring-orange-200/60" style={{ left: `${Math.max(2, Math.min(98, Number(zone.x)))}%`, top: `${Math.max(2, Math.min(98, Number(zone.y)))}%`, width: `${20 + Math.min(35, Number(zone.frequency) || 10)}px`, height: `${20 + Math.min(35, Number(zone.frequency) || 10)}px` }} />)}<p className="absolute bottom-3 left-3 text-[10px] uppercase tracking-[0.15em] text-white/35">Estimated field zones · requires calibrated tracking for exact coordinates</p></div>;
  }
  if (module === "penalties") {
    const entries = Array.isArray(data?.penalties) ? data.penalties : [];
    const locations: string[] = entries.map((entry: any) => String(entry?.location ?? entry?.position ?? entry?.fieldZone ?? "").trim()).filter((location: string) => Boolean(location));
    if (!locations.length) return <div className="grid min-h-40 place-items-center border border-amber-400/15 bg-amber-400/[0.03] p-6 text-center"><div><AlertTriangle className="mx-auto h-5 w-5 text-amber-300" /><p className="mt-3 text-sm text-amber-100/70">Penalty location map needs verified field-zone or position data.</p><p className="mt-1 text-xs text-white/30">Add official penalty charting in the verified coach-data field, then re-analyze.</p></div></div>;
    const locationCounts = locations.reduce<Map<string, number>>((map, location) => map.set(location, (map.get(location) ?? 0) + 1), new Map<string, number>());
    const counts = Array.from(locationCounts.entries()).map(([location, count]) => ({ location, count }));
    return <div className="border border-white/8 bg-black/20 p-4"><p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Verified penalty locations</p><div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={counts}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} /><XAxis dataKey="location" tick={{ fill: "#94a3b8", fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} /><Tooltip contentStyle={{ background: "#07100c", border: "1px solid rgba(251,191,36,.25)", fontSize: 12 }} /><Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></div>;
  }
  return <NumericSnapshot data={data} />;
}

function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span className="text-amber-300/70">Insufficient evidence</span>;
  if (typeof value !== "object") return <span className="break-words text-white/75">{String(value)}</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-white/25">No evidence-supported entries</span>;
    return <div className="space-y-2">{value.slice(0, 20).map((item, index) => <div key={index} className="border border-white/8 bg-black/20 p-3"><ValueView value={item} depth={depth + 1} /></div>)}</div>;
  }
  return <div className={depth ? "grid gap-2 md:grid-cols-2" : "space-y-3"}>{Object.entries(value as Record<string, unknown>).slice(0, 30).map(([key, item]) => <div key={key} className="min-w-0"><p className="text-[10px] uppercase tracking-[0.14em] text-white/30">{key.replace(/_/g, " ")}</p><div className="mt-1 text-sm"><ValueView value={item} depth={depth + 1} /></div></div>)}</div>;
}

function EvidencePanel({ quality }: { quality?: QualityRun }) {
  if (!quality) return <div className="border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100/70">This saved result predates evidence auditing. Re-analyze before using it for a football decision.</div>;
  const evidence = asObjects(quality.evidence);
  const missing = asStrings(quality.missingInputs);
  const limitations = asStrings(quality.limitations);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="border border-white/8 bg-black/20 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Evidence</p><p className="mt-2 text-xs leading-5 text-white/40">{quality.dataBasis}</p><div className="mt-4 space-y-2">{evidence.length ? evidence.map((item, index) => <div key={index} className="flex gap-3 border-t border-white/8 pt-2"><span className="font-mono text-xs text-emerald-400">{formatSeconds(Number(item.startSeconds) || 0)}–{formatSeconds(Number(item.endSeconds) || 0)}</span><span className="text-xs leading-5 text-white/55">{String(item.description ?? "Evidence-linked highlight")}</span></div>) : <p className="text-xs text-white/30">No supporting highlight was strong enough to cite.</p>}</div></div>
      <div className="border border-white/8 bg-black/20 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Missing inputs and limits</p><div className="mt-3 space-y-2">{[...missing, ...limitations].length ? [...missing, ...limitations].map((item, index) => <p key={index} className="flex gap-2 text-xs leading-5 text-white/50"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />{item}</p>) : <p className="text-xs text-white/30">No additional limitations reported.</p>}</div></div>
    </div>
  );
}

function AnalyticsCard({ config, quality, onVerify, sessionId }: { config: ModuleConfig; quality?: QualityRun; onVerify: (module: ModuleId, verified: boolean) => void; sessionId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [context, setContext] = useState("");
  const data = cleanAnalysis(config.data);
  const hasData = !!config.data;
  const analyze = async () => { try { await config.analyze(context || undefined); toast.success(`${config.title} updated`); } catch (error) { toast.error(error instanceof Error ? error.message : `${config.title} failed`); } };
  return (
    <section className="border border-white/10 bg-[#090d0b]">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <button className="flex min-w-0 items-center gap-4 text-left" onClick={() => setExpanded((value) => !value)}><span className="grid h-11 w-11 shrink-0 place-items-center border border-emerald-400/20 bg-emerald-400/5"><config.icon className="h-5 w-5 text-emerald-300" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-lg font-semibold text-white">{config.title}</span><QualityBadge quality={quality} /></span><span className="mt-1 block text-sm text-white/40">{quality?.summary || config.description}</span></span><ChevronDown className={`ml-1 h-4 w-4 shrink-0 text-white/35 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
        <div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" className="border-white/10 text-white/60" disabled={!hasData} onClick={() => downloadAnalyticsCsv(config.title, data, quality)}><Download className="mr-1.5 h-3.5 w-3.5" />CSV</Button><Button size="sm" variant="outline" className="border-white/10 text-white/60" disabled={!hasData} onClick={() => { try { printAnalyticsPdf(config.title, data, quality); } catch (error) { toast.error(error instanceof Error ? error.message : "Export failed"); } }}><FileDown className="mr-1.5 h-3.5 w-3.5" />PDF</Button><Button size="sm" variant="outline" className={quality?.coachVerified ? "border-emerald-400/30 text-emerald-300" : "border-white/10 text-white/60"} disabled={!quality} onClick={() => onVerify(config.id, !quality?.coachVerified)}><Verified className="mr-1.5 h-3.5 w-3.5" />{quality?.coachVerified ? "Verified" : "Coach verify"}</Button><Button size="sm" className="bg-emerald-400 text-black hover:bg-emerald-300" disabled={config.isPending} onClick={analyze}>{config.isPending ? <><Spinner className="mr-1.5 h-3.5 w-3.5" />Analyzing</> : hasData ? "Re-analyze" : "Analyze"}</Button></div>
      </div>
      {expanded && <div className="space-y-5 border-t border-white/8 p-5"><EvidencePanel quality={quality} /><div className="border border-white/8 bg-black/20 p-4"><label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Optional verified coach data</label><p className="mt-1 text-xs leading-5 text-white/35">Paste roster, injury report, official play-by-play, referee data, tracking exports, or corrected charting here. The model will distinguish it from AI-estimated film evidence.</p><textarea className="mt-3 min-h-28 w-full resize-y border border-white/10 bg-[#050806] p-3 text-sm text-white outline-none focus:border-cyan-300/40" value={context} onChange={(event) => setContext(event.target.value)} placeholder="Example: Verified roster — #7 starting QB, #12 backup. Official third-down chart: 8 attempts, 3 conversions..." /></div>{hasData ? <><ModuleVisualization module={config.id} data={data} /><div className="border border-white/8 bg-white/[0.02] p-4"><p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Structured coaching analysis</p><ValueView value={data} /></div></> : <div className="py-10 text-center text-sm text-white/30">Run this module to generate an evidence-audited analysis.</div>}<p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Session {sessionId} · AI-generated coaching support · verify before game-day use</p></div>}
    </section>
  );
}

export function AnalyticsPanel({ sessionId }: { sessionId: number }) {
  const [, setLocation] = useLocation();
  const qualityRuns = trpc.analytics.getQualityRuns.useQuery({ sessionId });
  const formations = trpc.analytics.getFormations.useQuery({ sessionId });
  const preSnap = trpc.analytics.getPreSnapReads.useQuery({ sessionId });
  const turnovers = trpc.analytics.getTurnovers.useQuery({ sessionId });
  const heatMaps = trpc.analytics2.getHeatMaps.useQuery({ sessionId });
  const routeTree = trpc.analytics2.getRouteTree.useQuery({ sessionId });
  const blocking = trpc.analytics2.getBlocking.useQuery({ sessionId });
  const momentum = trpc.analytics2.getMomentum.useQuery({ sessionId });
  const gaps = trpc.analytics2.getGaps.useQuery({ sessionId });
  const injury = trpc.analytics2.getInjuryImpact.useQuery({ sessionId });
  const penalties = trpc.analytics2.getPenalties.useQuery({ sessionId });
  const redZone = trpc.analytics2.getRedZone.useQuery({ sessionId });
  const thirdDown = trpc.analytics2.getThirdDown.useQuery({ sessionId });
  const twoMinute = trpc.analytics2.getTwoMinute.useQuery({ sessionId });
  const situational = trpc.analytics2.getSituational.useQuery({ sessionId });
  const playerComps = trpc.analytics2.getPlayerComparisons.useQuery({ sessionId });
  const refreshQuality = () => qualityRuns.refetch();
  const analyzeFormations = trpc.analytics.analyzeFormations.useMutation({ onSuccess: () => Promise.all([formations.refetch(), refreshQuality()]) });
  const analyzePreSnap = trpc.analytics.analyzePreSnapReads.useMutation({ onSuccess: () => Promise.all([preSnap.refetch(), refreshQuality()]) });
  const analyzeTurnovers = trpc.analytics.analyzeTurnovers.useMutation({ onSuccess: () => Promise.all([turnovers.refetch(), refreshQuality()]) });
  const analyzeHeatMaps = trpc.analytics2.analyzeHeatMaps.useMutation({ onSuccess: () => Promise.all([heatMaps.refetch(), refreshQuality()]) });
  const analyzeRouteTree = trpc.analytics2.analyzeRouteTree.useMutation({ onSuccess: () => Promise.all([routeTree.refetch(), refreshQuality()]) });
  const analyzeBlocking = trpc.analytics2.analyzeBlocking.useMutation({ onSuccess: () => Promise.all([blocking.refetch(), refreshQuality()]) });
  const analyzeMomentum = trpc.analytics2.analyzeMomentum.useMutation({ onSuccess: () => Promise.all([momentum.refetch(), refreshQuality()]) });
  const analyzeGaps = trpc.analytics2.analyzeGaps.useMutation({ onSuccess: () => Promise.all([gaps.refetch(), refreshQuality()]) });
  const analyzeInjury = trpc.analytics2.analyzeInjuryImpact.useMutation({ onSuccess: () => Promise.all([injury.refetch(), refreshQuality()]) });
  const analyzePenalties = trpc.analytics2.analyzePenalties.useMutation({ onSuccess: () => Promise.all([penalties.refetch(), refreshQuality()]) });
  const analyzeRedZone = trpc.analytics2.analyzeRedZone.useMutation({ onSuccess: () => Promise.all([redZone.refetch(), refreshQuality()]) });
  const analyzeThirdDown = trpc.analytics2.analyzeThirdDown.useMutation({ onSuccess: () => Promise.all([thirdDown.refetch(), refreshQuality()]) });
  const analyzeTwoMinute = trpc.analytics2.analyzeTwoMinute.useMutation({ onSuccess: () => Promise.all([twoMinute.refetch(), refreshQuality()]) });
  const analyzeSituational = trpc.analytics2.analyzeSituational.useMutation({ onSuccess: () => Promise.all([situational.refetch(), refreshQuality()]) });
  const analyzePlayerComps = trpc.analytics2.analyzePlayerComparisons.useMutation({ onSuccess: () => Promise.all([playerComps.refetch(), refreshQuality()]) });
  const verify = trpc.analytics.setCoachVerified.useMutation({ onSuccess: refreshQuality });
  const [runProgress, setRunProgress] = useState(0);
  const [runningAll, setRunningAll] = useState(false);

  const modules: ModuleConfig[] = [
    { id: "formations", title: "Formation Recognition", description: "Observed formations, tendencies, and situation clues", icon: Target, data: formations.data, isPending: analyzeFormations.isPending, analyze: (context) => analyzeFormations.mutateAsync({ sessionId, context }) },
    { id: "presnap", title: "Pre-Snap Reads", description: "Coverage, blitz, progression, and hot-route coaching", icon: Brain, data: preSnap.data, isPending: analyzePreSnap.isPending, analyze: (context) => analyzePreSnap.mutateAsync({ sessionId, context }) },
    { id: "turnovers", title: "Turnover Risk", description: "Evidence-linked interception, fumble, sack, and pressure risk", icon: ShieldAlert, data: turnovers.data, isPending: analyzeTurnovers.isPending, analyze: (context) => analyzeTurnovers.mutateAsync({ sessionId, context }) },
    { id: "heatMaps", title: "Player Positioning", description: "Alignment zones, route areas, and motion patterns", icon: Flame, data: heatMaps.data, isPending: analyzeHeatMaps.isPending, analyze: (context) => analyzeHeatMaps.mutateAsync({ sessionId, context }) },
    { id: "routeTree", title: "Route Tree Analyzer", description: "Routes, timing windows, matchups, and effectiveness", icon: Route, data: routeTree.data, isPending: analyzeRouteTree.isPending, analyze: (context) => analyzeRouteTree.mutateAsync({ sessionId, context }) },
    { id: "blocking", title: "Blocking Tracker", description: "Assignments, breakdowns, pressure, and run-fit review", icon: Shield, data: blocking.data, isPending: analyzeBlocking.isPending, analyze: (context) => analyzeBlocking.mutateAsync({ sessionId, context }) },
    { id: "momentum", title: "Momentum & Game Flow", description: "Chronological swings and adjustment windows", icon: Activity, data: momentum.data, isPending: analyzeMomentum.isPending, analyze: (context) => analyzeMomentum.mutateAsync({ sessionId, context }) },
    { id: "gaps", title: "Gap Assignment Analyzer", description: "Fits, blitz packages, and evidence-linked breakdowns", icon: Grid3X3, data: gaps.data, isPending: analyzeGaps.isPending, analyze: (context) => analyzeGaps.mutateAsync({ sessionId, context }) },
    { id: "injury", title: "Injury Impact", description: "Role vulnerability with explicit roster and medical-data limits", icon: Users, data: injury.data, isPending: analyzeInjury.isPending, analyze: (context) => analyzeInjury.mutateAsync({ sessionId, context }) },
    { id: "penalties", title: "Penalty Patterns", description: "Charted penalties, cost, locations, and missing referee data", icon: AlertTriangle, data: penalties.data, isPending: analyzePenalties.isPending, analyze: (context) => analyzePenalties.mutateAsync({ sessionId, context }) },
    { id: "redZone", title: "Red Zone Efficiency", description: "Observed calls, outcomes, vulnerabilities, and next-call clues", icon: Goal, data: redZone.data, isPending: analyzeRedZone.isPending, analyze: (context) => analyzeRedZone.mutateAsync({ sessionId, context }) },
    { id: "thirdDown", title: "Third-Down Efficiency", description: "Distance splits, calls, coverages, and recommendations", icon: BarChart3, data: thirdDown.data, isPending: analyzeThirdDown.isPending, analyze: (context) => analyzeThirdDown.mutateAsync({ sessionId, context }) },
    { id: "twoMinute", title: "Two-Minute Drill", description: "Clock, timeout, call-sequence, and clutch-situation analysis", icon: Clock3, data: twoMinute.data, isPending: analyzeTwoMinute.isPending, analyze: (context) => analyzeTwoMinute.mutateAsync({ sessionId, context }) },
    { id: "situational", title: "Situational Football", description: "Down, score, field-position, and time-based tendencies", icon: TimerReset, data: situational.data, isPending: analyzeSituational.isPending, analyze: (context) => analyzeSituational.mutateAsync({ sessionId, context }) },
    { id: "playerComparisons", title: "Player Comparisons", description: "Evidence-backed matchup traits without invented measurements", icon: GitCompareArrows, data: playerComps.data, isPending: analyzePlayerComps.isPending, analyze: (context) => analyzePlayerComps.mutateAsync({ sessionId, context }) },
  ];

  const qualityByModule = useMemo(() => new Map((qualityRuns.data ?? []).map((run) => [run.module, run as QualityRun])), [qualityRuns.data]);
  const quality = qualityRuns.data ?? [];
  const ready = quality.filter((run) => run.status === "ready").length;
  const insufficient = quality.filter((run) => run.status === "insufficient").length;
  const verified = quality.filter((run) => run.coachVerified).length;
  const avgConfidence = quality.length ? Math.round(quality.reduce((sum, run) => sum + run.confidence, 0) / quality.length) : 0;
  const summaryPayload = {
    sessionId,
    generatedAt: new Date().toISOString(),
    auditedModules: quality.length,
    readyModules: ready,
    needsDataModules: insufficient,
    coachVerifiedModules: verified,
    averageConfidence: avgConfidence,
    modules: modules.map((module) => ({
      module: module.title,
      quality: qualityByModule.get(module.id),
      analysis: cleanAnalysis(module.data),
    })),
  };

  const runAll = async () => {
    setRunningAll(true); setRunProgress(0);
    let failures = 0;
    for (let index = 0; index < modules.length; index++) {
      try { await modules[index].analyze(); } catch { failures += 1; }
      setRunProgress(index + 1);
    }
    setRunningAll(false);
    failures ? toast.error(`${failures} module${failures === 1 ? "" : "s"} need attention`) : toast.success("All 15 evidence-audited modules finished");
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden border border-emerald-400/20 bg-[radial-gradient(circle_at_80%_0%,rgba(16,217,154,.14),transparent_36%),#070b09] p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300"><Zap className="h-4 w-4" />Evidence-audited intelligence</p><h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Advanced Video Analytics</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">Fifteen football workspaces tied to the scouting evidence that supports them. Unknown data stays unknown—no fabricated rates, roster facts, injuries, measurements, or referee tendencies.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/10 text-white/60" onClick={() => setLocation(`/analytics/${sessionId}`)}>Full-screen hub</Button><Button variant="outline" className="border-white/10 text-white/60" onClick={() => downloadAnalyticsCsv("Advanced Analytics Executive Summary", summaryPayload)}>Summary CSV</Button><Button variant="outline" className="border-white/10 text-white/60" onClick={() => { try { printAnalyticsPdf("Advanced Analytics Executive Summary", summaryPayload); } catch (error) { toast.error(error instanceof Error ? error.message : "Export failed"); } }}>Summary PDF</Button><Button className="min-w-56 bg-emerald-400 text-black hover:bg-emerald-300" disabled={runningAll} onClick={runAll}>{runningAll ? <><Spinner className="mr-2 h-4 w-4" />Running {runProgress}/15</> : "Run all 15 sequentially"}</Button></div></div>
        <div className="mt-7 grid grid-cols-2 border border-white/8 md:grid-cols-4">{[["Audited", quality.length], ["Ready", ready], ["Needs data", insufficient], ["Coach verified", verified]].map(([label, value]) => <div key={String(label)} className="border-white/8 p-4 md:border-r last:border-r-0"><p className="text-[10px] uppercase tracking-[0.16em] text-white/30">{label}</p><p className="mt-2 font-mono text-2xl text-emerald-300">{value}</p></div>)}</div>
        <div className="mt-4 flex items-center justify-between text-xs text-white/30"><span>Average model confidence across audited modules</span><span className="font-mono text-emerald-300">{avgConfidence}%</span></div><div className="mt-2 h-1.5 bg-white/8"><div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-300" style={{ width: `${avgConfidence}%` }} /></div>
      </section>
      <div className="space-y-3">{modules.map((config) => <AnalyticsCard key={config.id} config={config} quality={qualityByModule.get(config.id)} sessionId={sessionId} onVerify={(module, coachVerified) => verify.mutate({ sessionId, module, verified: coachVerified })} />)}</div>
    </div>
  );
}

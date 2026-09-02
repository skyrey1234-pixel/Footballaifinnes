import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, Activity } from "lucide-react";

type Highlight = {
  timestamp: string;
  seconds: number;
  title: string;
  note: string;
  category: string;
  verdict: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  offense: "#3b82f6",
  defense: "#a855f7",
  special: "#eab308",
  mistake: "#ef4444",
  other: "#64748b",
};

const tooltipStyle = {
  backgroundColor: "#09090b",
  border: "1px solid rgba(16,185,129,0.35)",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

export default function ReportCharts({ highlights }: { highlights: Highlight[] }) {
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const verdictData = useMemo(() => {
    const good = highlights.filter(h => h.verdict === "good").length;
    const bad = highlights.length - good;
    return [
      { name: "Good Plays", value: good, color: "#10b981" },
      { name: "Mistakes", value: bad, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [highlights]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of highlights) counts[h.category || "other"] = (counts[h.category || "other"] || 0) + 1;
    return Object.entries(counts).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      fill: CATEGORY_COLORS[name] || CATEGORY_COLORS.other,
    }));
  }, [highlights]);

  const timelineData = useMemo(
    () =>
      highlights.map(h => ({
        x: Math.round(h.seconds / 60 * 10) / 10,
        y: h.verdict === "good" ? 1 : 0,
        z: 1,
        title: h.title,
        timestamp: h.timestamp,
        verdict: h.verdict,
      })),
    [highlights],
  );

  if (highlights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Verdict donut */}
      <Card className="border-zinc-800 bg-zinc-950/60">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <PieIcon className="h-3.5 w-3.5 text-emerald-400" /> Play Verdicts
          </p>
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verdictData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  strokeWidth={0}
                  onMouseEnter={(_, i) => setActiveSlice(i)}
                  onMouseLeave={() => setActiveSlice(null)}
                >
                  {verdictData.map((d, i) => (
                    <Cell
                      key={d.name}
                      fill={d.color}
                      opacity={activeSlice === null || activeSlice === i ? 1 : 0.35}
                      style={{ transition: "opacity 200ms", filter: activeSlice === i ? `drop-shadow(0 0 8px ${d.color})` : undefined }}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 -mt-2">
            {verdictData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                {d.name}: <b className="text-zinc-200">{d.value}</b>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category bars */}
      <Card className="border-zinc-800 bg-zinc-950/60">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Phase Breakdown
          </p>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(16,185,129,0.06)" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Timeline scatter */}
      <Card className="border-zinc-800 bg-zinc-950/60">
        <CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <Activity className="h-3.5 w-3.5 text-emerald-400" /> Game Flow Timeline
          </p>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 15, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Minute"
                  unit="m"
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "dataMax + 1"]}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[-0.5, 1.5]}
                  ticks={[0, 1]}
                  tickFormatter={(v: number) => (v === 1 ? "Good" : "Mistake")}
                  tick={{ fontSize: 10, fill: "#71717a" }}
                  axisLine={false}
                  tickLine={false}
                />
                <ZAxis type="number" dataKey="z" range={[80, 80]} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value: unknown, name: string) => (name === "Minute" ? [`${value}m`, "Minute"] : [value === 1 ? "Good Play" : "Mistake", "Verdict"])}
                  labelFormatter={() => ""}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={({ payload }: any) => {
                    const p = payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <div style={tooltipStyle} className="px-3 py-2">
                        <p className="font-medium text-xs" style={{ color: p.verdict === "good" ? "#10b981" : "#ef4444" }}>{p.title}</p>
                        <p className="text-[10px] text-zinc-400">{p.timestamp} · {p.verdict === "good" ? "Good Play" : "Mistake"}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={timelineData} isAnimationActive animationDuration={900}>
                  {timelineData.map((d, i) => (
                    <Cell key={i} fill={d.verdict === "good" ? "#10b981" : "#ef4444"} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

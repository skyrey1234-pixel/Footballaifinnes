import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2, Users2, Download, Printer } from "lucide-react";

export default function PracticePanel({ sessionId }: { sessionId: number }) {
  const [duration, setDuration] = useState(90);
  const practice = trpc.warRoom.practicePlan.useMutation();
  const scout = trpc.warRoom.scoutTeam.useMutation();

  const downloadJson = () => {
    const data = { practicePlan: practice.data, scoutTeam: scout.data, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "practice-plan.json";
    a.click();
  };

  const printPlan = () => {
    const p = practice.data;
    const s = scout.data;
    const w = window.open("", "_blank");
    if (!w) return;
    const periodRows = (p?.periods || [])
      .map((per) => `<tr><td>${per.startMinute}–${per.endMinute} min</td><td><b>${per.name}</b> (${per.unit})</td><td>${per.coachingDetail}<br/><i>Drill: ${per.drillSuggestion}</i></td></tr>`)
      .join("");
    const scoutRows = (s?.periods || [])
      .map((sp) => `<tr><td><b>${sp.periodName}</b></td><td>${sp.formation}</td><td>${sp.callFamily}</td><td>${sp.repTarget} reps</td><td>${sp.coachingPoint}</td></tr>`)
      .join("");
    w.document.write(`<!doctype html><html><head><title>Practice Plan</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin-bottom:4px} h2{font-size:15px;margin-top:24px;border-bottom:2px solid #111;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
      td,th{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}
      .focus{background:#f0f0f0;padding:10px;border-left:4px solid #111;margin-top:8px;font-size:13px}
      @media print{body{padding:0}}
    </style></head><body>
      <h1>TacticalEdge — Practice Plan</h1>
      <div style="font-size:11px;color:#555">Generated ${new Date().toLocaleDateString()}</div>
      ${p ? `<div class="focus"><b>This Week's Focus:</b> ${p.focusStatement}</div><h2>Practice Periods (${duration} min)</h2><table><tr><th>Time</th><th>Period</th><th>Coaching Detail</th></tr>${periodRows}</table>` : ""}
      ${s ? `<h2>Scout-Team Script</h2><table><tr><th>Period</th><th>Formation</th><th>Call Family</th><th>Reps</th><th>Coaching Point</th></tr>${scoutRows}</table>` : ""}
      <script>window.onload=function(){window.print()}</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 anim-rise flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="font-tactical text-[10px] text-muted-foreground mb-2 flex justify-between">
            <span>PRACTICE DURATION</span><span className="text-primary font-bold">{duration} MIN</span>
          </div>
          <input type="range" min={45} max={150} step={15} value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full accent-[oklch(0.85_0.22_155)]" />
        </div>
        <div className="flex gap-2">
          <Button className="gap-2 glow-primary-sm active:scale-[0.97]" onClick={() => practice.mutate({ sessionId, durationMinutes: duration })} disabled={practice.isPending}>
            {practice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Build Practice Plan
          </Button>
          <Button variant="outline" className="gap-2 active:scale-[0.97]" onClick={() => scout.mutate({ sessionId })} disabled={scout.isPending}>
            {scout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users2 className="h-4 w-4" />}
            Scout-Team Script
          </Button>
          {(practice.data || scout.data) && (
            <>
              <Button variant="ghost" className="gap-2" onClick={downloadJson}>
                <Download className="h-4 w-4" /> JSON
              </Button>
              <Button variant="ghost" className="gap-2" onClick={printPlan}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </>
          )}
        </div>
      </div>

      {practice.data && (
        <div className="space-y-3 anim-rise">
          <div className="glass rounded-xl p-4 border-l-2 border-l-primary">
            <div className="font-tactical text-[10px] text-primary mb-1">THIS WEEK'S FOCUS</div>
            <p className="text-sm">{practice.data.focusStatement}</p>
          </div>
          {/* Timeline */}
          <div className="glass-bright rounded-2xl p-6 space-y-1">
            {practice.data.periods.map((p, i) => (
              <div key={i} className={`flex gap-4 group anim-rise-${Math.min(i + 1, 5)}`}>
                {/* Time rail */}
                <div className="flex flex-col items-center">
                  <div className="font-display text-xs font-bold text-primary w-14 text-center py-1 rounded bg-primary/10">
                    {p.startMinute}–{p.endMinute}'
                  </div>
                  {i < practice.data!.periods.length - 1 && <div className="w-px flex-1 bg-gradient-to-b from-primary/40 to-primary/5 my-1" />}
                </div>
                <div className="pb-5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-sm font-bold">{p.name}</span>
                    <span className="font-tactical text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p.unit.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{p.coachingDetail}</p>
                  <p className="text-[11px] text-primary/80 mt-1">Drill: {p.drillSuggestion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {scout.data && (
        <div className="anim-rise">
          <div className="font-tactical text-xs text-blue-400 mb-3 flex items-center gap-2">
            <Users2 className="h-3.5 w-3.5" /> SCOUT-TEAM SCRIPT — GIVE YOUR DEFENSE THEIR LOOKS
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {scout.data.periods.map((p, i) => (
              <div key={i} className={`glass rounded-xl p-4 anim-rise-${Math.min(i + 1, 5)} border-t-2 border-t-blue-500/50`}>
                <div className="font-display text-sm font-bold mb-2">{p.periodName}</div>
                <div className="space-y-1.5 text-xs">
                  <div><span className="font-tactical text-[9px] text-muted-foreground">FORMATION </span>{p.formation}</div>
                  <div><span className="font-tactical text-[9px] text-muted-foreground">CALL </span>{p.callFamily}</div>
                  <div><span className="font-tactical text-[9px] text-muted-foreground">REPS </span><span className="font-display font-bold text-blue-400">{p.repTarget}</span></div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{p.coachingPoint}</p>
                <p className="text-[9px] text-muted-foreground/60 mt-2 font-tactical">{p.sourceNote}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

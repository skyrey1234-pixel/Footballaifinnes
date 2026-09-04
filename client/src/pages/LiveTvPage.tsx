import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, BrainCircuit, Expand, Radio, ShieldAlert, Trophy, Tv } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";

type Prediction = { rank?: number; label?: string; playCall?: string; probability?: number; reason?: string; rationale?: string; counterCall?: string };
type ImpactPlayer = { playerLabel?: string; unit?: string; mentions?: number; averageConfidence?: number; reasons?: string[] };

function getTvAccess(sessionId: string) {
  if (typeof window === "undefined") return "";
  const key = `tacticaledge-tv-${sessionId}`;
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("access") ?? "";
  if (fromHash) window.sessionStorage.setItem(key, fromHash);
  return fromHash || window.sessionStorage.getItem(key) || "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
}

export default function LiveTvPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [access] = useState(() => getTvAccess(params.id));
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const query = trpc.live.tvSnapshot.useQuery(
    { id, access },
    { enabled: Number.isInteger(id) && id > 0 && Boolean(access), refetchInterval: 5_000, retry: false },
  );

  useEffect(() => {
    if (!playbackUrl && query.data?.playbackUrl) setPlaybackUrl(query.data.playbackUrl);
  }, [playbackUrl, query.data?.playbackUrl]);

  const latest = query.data?.events?.[0];
  const predictions = useMemo(() => {
    const value = latest?.nextPlayProbabilities;
    return Array.isArray(value) ? value.slice(0, 2) as Prediction[] : [];
  }, [latest?.nextPlayProbabilities]);
  const memory = asRecord(query.data?.session.gameMemory);
  const offense = asRecord(memory.offense);
  const defense = asRecord(memory.defense);
  const impactPlayers = Array.isArray(memory.impactPlayers) ? memory.impactPlayers.slice(0, 4) as ImpactPlayer[] : [];
  const situation = asRecord(query.data?.session.situation);

  if (!access || !Number.isInteger(id)) {
    return <TvError message="This TV View link is incomplete. Open it again from the coach’s Live Command Center." />;
  }
  if (query.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-black text-emerald-300"><Radio className="h-12 w-12 animate-pulse" /></div>;
  }
  if (query.error || !query.data) {
    return <TvError message={query.error?.message ?? "This TV View link is invalid or expired."} />;
  }

  const { session } = query.data;
  const canPlayFeed = session.sourceType === "upload" && Boolean(playbackUrl);

  return (
    <main className="min-h-screen bg-[#020504] text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-400/20 bg-black/80 px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-11 place-items-center border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Tv className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-400">TacticalEdge TV View</p>
            <h1 className="text-xl font-semibold">{session.name} <span className="text-white/35">vs {session.opponentName}</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${session.status === "live" ? "bg-red-500 text-white" : "bg-white/10 text-white/60"}`}><span className="h-2 w-2 animate-pulse rounded-full bg-current" />{session.status}</span>
          <Button onClick={() => void document.documentElement.requestFullscreen?.()} variant="outline" className="border-white/15 bg-black text-white"><Expand className="mr-2 h-4 w-4" />Full screen</Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-78px)] gap-px bg-white/10 xl:grid-cols-[minmax(0,1.55fr)_minmax(420px,0.8fr)]">
        <section className="bg-black p-4 lg:p-6">
          <div className="relative aspect-video overflow-hidden border border-white/10 bg-[#050807]">
            {canPlayFeed ? (
              <video src={playbackUrl ?? undefined} className="h-full w-full object-contain" controls autoPlay playsInline />
            ) : (
              <div className="grid h-full place-items-center px-8 text-center">
                <div className="max-w-xl">
                  <Radio className="mx-auto h-12 w-12 animate-pulse text-emerald-400" />
                  <h2 className="mt-5 text-3xl font-semibold">Live intelligence is connected</h2>
                  <p className="mt-3 text-base leading-7 text-white/55">Camera and Screen Share video stays on the coach&apos;s source device for privacy. Mirror or cast that Live Command Center tab to the TV to see the game feed with these predictions.</p>
                </div>
              </div>
            )}
            <div className="absolute left-4 top-4 bg-black/75 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">5-second AI read · {query.data.events.length} windows</div>
          </div>

          <div className="mt-4 grid gap-px bg-white/10 sm:grid-cols-4">
            {[
              ["Quarter", String(situation.quarter ?? "—")],
              ["Clock", String(situation.clock ?? "—")],
              ["Down / Distance", `${situation.down ?? "—"} & ${situation.distance ?? "—"}`],
              ["Field position", String(situation.yardLine ?? "—")],
            ].map(([label, value]) => <div key={label} className="bg-[#07100c] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
          </div>

          <section className="mt-4 border border-white/10 bg-[#07100c] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-300">Impact players · whole-game memory</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {impactPlayers.length ? impactPlayers.map((player, index) => (
                <div key={`${player.playerLabel}-${index}`} className="border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between"><Trophy className="h-4 w-4 text-amber-300" /><span className="text-xs text-white/35">{player.mentions ?? 0} reads</span></div>
                  <p className="mt-4 text-lg font-semibold">{player.playerLabel || "Unclear player"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-fuchsia-300">{player.unit || "unclear"}</p>
                </div>
              )) : <p className="col-span-full py-6 text-sm text-white/45">Player leaders appear after repeated visible impact across multiple reads.</p>}
            </div>
          </section>
        </section>

        <aside className="space-y-px bg-[#050807]">
          <section className="bg-[#07100c] p-6">
            <div className="flex items-center gap-2 text-emerald-300"><BrainCircuit className="h-5 w-5" /><p className="text-xs font-bold uppercase tracking-[0.22em]">Next-play predictions</p></div>
            <div className="mt-5 space-y-3">
              {predictions.length ? predictions.map((prediction, index) => (
                <article key={`${prediction.playCall}-${index}`} className={`border p-5 ${index === 0 ? "border-emerald-400/40 bg-emerald-400/10" : "border-cyan-300/25 bg-cyan-300/5"}`}>
                  <div className="flex items-start justify-between gap-4"><span className="text-3xl font-black">#{index + 1}</span><span className="text-3xl font-black text-emerald-300">{Math.round(Number(prediction.probability) || 0)}%</span></div>
                  <h2 className="mt-3 text-2xl font-semibold">{prediction.playCall || prediction.label || "Prediction pending"}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/60">{prediction.rationale || prediction.reason || latest?.predictionSummary || "The AI is studying the current series."}</p>
                  {prediction.counterCall ? <p className="mt-4 border-t border-white/10 pt-4 text-sm text-cyan-200"><strong>Counter:</strong> {prediction.counterCall}</p> : null}
                </article>
              )) : <div className="border border-white/10 bg-black/20 p-6 text-white/45">The first two predictions appear after the next completed five-second read.</div>}
            </div>
          </section>

          <section className="bg-[#07100c] p-6">
            <div className="flex items-center gap-2 text-amber-300"><ShieldAlert className="h-5 w-5" /><p className="text-xs font-bold uppercase tracking-[0.22em]">Latest live call</p></div>
            <p className="mt-4 text-xl font-semibold">{latest?.counterCall || session.latestSummary || "Waiting for verified evidence."}</p>
            {latest?.tendencyShift ? <p className="mt-3 text-sm leading-6 text-white/55">{latest.tendencyShift}</p> : null}
          </section>

          <section className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {[{ label: "Offense memory", unit: offense, tone: "text-emerald-300" }, { label: "Defense memory", unit: defense, tone: "text-cyan-300" }].map(({ label, unit, tone }) => (
              <article key={label} className="bg-[#07100c] p-6">
                <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${tone}`}>{label}</p>
                <p className="mt-3 text-base font-semibold leading-6">{String(unit.latestSummary || "Building whole-game intelligence.")}</p>
                <div className="mt-4 space-y-2">
                  {asStringList(unit.tendencies).map((item) => <p key={item} className="border-t border-white/8 pt-2 text-xs leading-5 text-white/50">{item}</p>)}
                </div>
              </article>
            ))}
          </section>
        </aside>
      </div>
    </main>
  );
}

function TvError({ message }: { message: string }) {
  return <main className="grid min-h-screen place-items-center bg-black px-6 text-center text-white"><div className="max-w-lg"><AlertTriangle className="mx-auto h-12 w-12 text-amber-300" /><h1 className="mt-5 text-3xl font-semibold">TV View unavailable</h1><p className="mt-3 leading-7 text-white/55">{message}</p></div></main>;
}

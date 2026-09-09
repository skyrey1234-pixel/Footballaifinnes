import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Clapperboard, Download, Loader2, ShieldCheck } from "lucide-react";
import { useParams } from "wouter";

export default function TacticalTwinCinematicSharePage() {
  const { token = "" } = useParams<{ token: string }>();
  const share = trpc.tacticalTwinShare.cinematic.useQuery({ token }, { retry: false, staleTime: 5 * 60 * 1000 });

  if (share.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#020605] text-white"><Loader2 className="h-9 w-9 animate-spin text-fuchsia-300" /></div>;
  }

  if (!share.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(217,70,239,.16),transparent_35%),#020605] px-6 text-center text-white">
        <div className="max-w-lg border border-red-400/20 bg-red-950/10 p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-300" />
          <h1 className="mt-5 text-2xl font-black">Replay link unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-white/45">This cinematic replay link expired, was revoked by its coach, or is no longer available.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_82%_0%,rgba(217,70,239,.17),transparent_34%),linear-gradient(150deg,#05080a,#020303_62%)] px-4 py-6 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="border border-fuchsia-400/20 bg-black/35 px-5 py-5 md:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-300"><Clapperboard className="h-4 w-4" />TacticalEdge cinematic replay</p>
              <h1 className="mt-3 text-2xl font-black md:text-4xl">{share.data.title}</h1>
              <p className="mt-2 text-sm text-white/40">{share.data.sourceTitle} · {share.data.style.replaceAll("_", " ")} · {share.data.durationSeconds}s</p>
            </div>
            <a href={share.data.videoUrl} download="tacticaledge-cinematic-replay.mp4"><Button className="gap-2 bg-fuchsia-300 text-black hover:bg-fuchsia-200"><Download className="h-4 w-4" />Download MP4</Button></a>
          </div>
        </header>

        <section className={`mt-4 bg-black ${share.data.aspectRatio === "9:16" ? "mx-auto max-w-[500px]" : ""}`}>
          <video src={share.data.videoUrl} controls playsInline preload="metadata" className={`${share.data.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video"} w-full bg-black object-contain`} />
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center border border-amber-300/20 bg-amber-300/5 p-4">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><p className="text-sm font-bold text-amber-100">Cinematic interpretation—not verified game-film evidence</p><p className="mt-1 text-xs leading-5 text-amber-100/55">{share.data.provenanceLabel}</p></div></div>
          <p className="font-mono text-[10px] uppercase text-white/30">Link expires {new Date(share.data.expiresAt).toLocaleString()}</p>
        </section>
      </div>
    </main>
  );
}


import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { QRCodeSVG } from "qrcode.react";
import { Clapperboard, Copy, Download, Film, Link2, Loader2, RefreshCw, Share2, Sparkles, Trash2, WandSparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CinematicStyle = "broadcast_cinematic" | "sideline_impact" | "all_22_orbit";
type AspectRatio = "16:9" | "9:16";

const cinematicStyles: Array<{ id: CinematicStyle; title: string; note: string }> = [
  { id: "broadcast_cinematic", title: "Broadcast Cinema", note: "Slow push-in and premium replay finish" },
  { id: "sideline_impact", title: "Sideline Impact", note: "Grounded tracking shot with a controlled speed ramp" },
  { id: "all_22_orbit", title: "All-22 Orbit", note: "Elevated camera reveal of spacing and leverage" },
];

function waitForMedia(video: HTMLVideoElement, event: "loadedmetadata" | "seeked", timeoutMs = 25_000) {
  return new Promise<void>((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("The source frame could not be decoded for cinematic export.")); };
    timer = window.setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for source film ${event}.`)); }, timeoutMs);
    video.addEventListener(event, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function captureCinematicFrame(video: HTMLVideoElement, timestampSeconds: number, aspectRatio: AspectRatio) {
  video.pause();
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    video.load();
    await waitForMedia(video, "loadedmetadata");
  }
  if (Math.abs(video.currentTime - timestampSeconds) > 0.04) {
    const waiting = waitForMedia(video, "seeked");
    video.currentTime = Math.max(0, timestampSeconds);
    await waiting;
  }
  if (!video.videoWidth || !video.videoHeight) throw new Error("No decoded source frame is available yet.");

  const canvas = document.createElement("canvas");
  canvas.width = aspectRatio === "9:16" ? 720 : 1280;
  canvas.height = aspectRatio === "9:16" ? 1280 : 720;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot prepare the cinematic source frame.");
  context.fillStyle = "#020605";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (["failed", "nsfw", "canceled"].includes(status)) return "border-red-400/25 bg-red-400/8 text-red-200";
  return "border-fuchsia-300/25 bg-fuchsia-300/8 text-fuchsia-200";
}

export function TacticalTwinCinematicPanel({
  reconstructionId,
  sourceType,
  captureUrl,
  sourceStartSeconds,
  durationSeconds,
  progress,
}: {
  reconstructionId: number;
  sourceType: string;
  captureUrl?: string | null;
  sourceStartSeconds: number;
  durationSeconds: number;
  progress: number;
}) {
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const [style, setStyle] = useState<CinematicStyle>("broadcast_cinematic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [duration, setDuration] = useState<5 | 10>(5);
  const [coachPrompt, setCoachPrompt] = useState("");
  const [selectedExportId, setSelectedExportId] = useState<number | null>(null);
  const [shareHours, setShareHours] = useState<24 | 72 | 168 | 720>(168);
  const [latestShare, setLatestShare] = useState<{ exportId: number; url: string; expiresAt: number } | null>(null);
  const configuration = trpc.tacticalTwinStage2.exportConfiguration.useQuery();
  const trackingJobs = trpc.tacticalTwinStage2.listTracking.useQuery({ reconstructionId });
  const exportsQuery = trpc.tacticalTwinStage2.listExports.useQuery({ reconstructionId }, { refetchInterval: 12_000 });
  const exports = exportsQuery.data ?? [];
  const selectedExport = exports.find((item) => item.id === selectedExportId) ?? exports.find((item) => item.status === "completed") ?? null;
  const playbackQuery = trpc.tacticalTwinStage2.exportPlayback.useQuery(
    { exportId: selectedExport?.id ?? 0 },
    { enabled: Boolean(selectedExport?.id && selectedExport.status === "completed" && selectedExport.outputFileKey), staleTime: 40 * 60 * 1000 },
  );

  const createMutation = trpc.tacticalTwinStage2.createExport.useMutation({
    onSuccess: async (cinematicExport) => {
      setSelectedExportId(cinematicExport.id);
      await exportsQuery.refetch();
      toast.success("Higgsfield cinematic replay queued");
    },
    onError: (error) => toast.error(error.message),
  });
  const refreshMutation = trpc.tacticalTwinStage2.refreshExport.useMutation({
    onSuccess: async () => { await exportsQuery.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const cancelMutation = trpc.tacticalTwinStage2.cancelExport.useMutation({
    onSuccess: async () => { await exportsQuery.refetch(); toast.success("Cinematic render canceled"); },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.tacticalTwinStage2.deleteExport.useMutation({
    onSuccess: async () => { setSelectedExportId(null); await exportsQuery.refetch(); toast.success("Cinematic export removed"); },
    onError: (error) => toast.error(error.message),
  });
  const createShareMutation = trpc.tacticalTwinStage2.createExportShare.useMutation({
    onSuccess: async (share) => {
      const url = new URL(share.url, window.location.origin).toString();
      setLatestShare({ exportId: share.exportId, url, expiresAt: share.expiresAt });
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Secure cinematic replay link copied");
    },
    onError: (error) => toast.error(error.message),
  });
  const revokeSharesMutation = trpc.tacticalTwinStage2.revokeExportShares.useMutation({
    onSuccess: () => { setLatestShare(null); toast.success("All share links for this export were revoked"); },
    onError: (error) => toast.error(error.message),
  });

  const activeExport = useMemo(() => exports.find((item) => ["queued", "in_progress"].includes(item.status)), [exports]);
  useEffect(() => {
    if (!activeExport?.id || refreshMutation.isPending) return;
    const timer = window.setTimeout(() => refreshMutation.mutate({ exportId: activeExport.id }), 8_000);
    return () => window.clearTimeout(timer);
  }, [activeExport?.id, activeExport?.status, refreshMutation]);

  const approvedTracking = trackingJobs.data?.find((job) => job.status === "approved") ?? null;
  const canCapture = sourceType === "upload" && Boolean(captureUrl);
  const canGenerate = canCapture && Boolean(configuration.data?.configured);

  const queueExport = async () => {
    if (!canGenerate || !captureVideoRef.current) {
      toast.error(configuration.data?.connectorEnabledNotice ?? "App-scoped Higgsfield authorization is required.");
      return;
    }
    try {
      const sourceImageDataUrl = await captureCinematicFrame(
        captureVideoRef.current,
        sourceStartSeconds + progress * durationSeconds,
        aspectRatio,
      );
      await createMutation.mutateAsync({
        reconstructionId,
        trackingJobId: approvedTracking?.id ?? null,
        style,
        aspectRatio,
        durationSeconds: duration,
        coachPrompt: coachPrompt.trim() || undefined,
        sourceImageDataUrl,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not prepare cinematic export");
    }
  };

  const createShare = (exportId: number) => {
    setSelectedExportId(exportId);
    createShareMutation.mutate({ exportId, expiresInHours: shareHours });
  };

  return (
    <section className="border border-fuchsia-400/20 bg-[radial-gradient(circle_at_85%_0%,rgba(217,70,239,.18),transparent_38%),linear-gradient(140deg,#110819,#050607_62%)] p-4 md:p-5">
      {captureUrl ? <video ref={captureVideoRef} src={captureUrl} crossOrigin="anonymous" muted playsInline preload="auto" className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px opacity-0" /> : null}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-300"><WandSparkles className="h-4 w-4" />Stage 2 · Higgsfield cinematic export</p>
          <h2 className="mt-2 text-xl font-black text-white">Turn The Read Into A Shareable Replay</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/45">TacticalEdge sends one approved source frame to Higgsfield, tracks the asynchronous render, then retains the completed MP4 for preview, download, and secure sharing. Generated motion is labeled as cinematic interpretation—not verified film evidence.</p>
        </div>
        <div className={`border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${configuration.data?.configured ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-300/25 bg-amber-300/8 text-amber-100"}`}>
          {configuration.isLoading ? "Checking Higgsfield…" : configuration.data?.configured ? "App bridge ready" : "Connector on · app bridge required"}
        </div>
      </div>

      {!configuration.data?.configured ? (
        <div className="mt-4 border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100/70">
          <strong className="text-amber-100">Your Higgsfield connector is already enabled.</strong> It authorizes Manus-agent work, not arbitrary production-server requests. TacticalEdge will not copy that OAuth token. One-click exports activate when an app-scoped server bridge is connected.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="grid gap-2 md:grid-cols-3">
            {cinematicStyles.map((item) => <button key={item.id} onClick={() => setStyle(item.id)} className={`border p-3 text-left ${style === item.id ? "border-fuchsia-300 bg-fuchsia-300/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}><span className="block text-xs font-bold text-white">{item.title}</span><span className="mt-1 block text-[10px] leading-4 text-white/35">{item.note}</span></button>)}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor="cinematic-aspect">Format</Label><select id="cinematic-aspect" value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)} className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm"><option value="16:9">16:9 Coach / TV</option><option value="9:16">9:16 Reels / TikTok</option></select></div>
            <div><Label htmlFor="cinematic-duration">Duration</Label><select id="cinematic-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value) as 5 | 10)} className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm"><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></div>
            <div><Label>Source moment</Label><div className="mt-2 flex h-9 items-center border border-white/10 px-3 font-mono text-xs text-fuchsia-200">{(sourceStartSeconds + progress * durationSeconds).toFixed(3)}s</div></div>
          </div>
          <div className="mt-3"><Label htmlFor="cinematic-prompt">Coach direction</Label><Textarea id="cinematic-prompt" value={coachPrompt} onChange={(event) => setCoachPrompt(event.target.value.slice(0, 500))} rows={3} placeholder="Emphasize the edge rusher bend, quarterback escape, receiver separation…" className="mt-2" /></div>
          <Button className="mt-4 w-full gap-2 bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200" disabled={!canGenerate || createMutation.isPending || Boolean(activeExport)} onClick={() => void queueExport()}>{createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{activeExport ? "Render already in progress" : "Generate Cinematic Replay"}</Button>
        </div>
        <div className="border border-white/10 bg-black/25 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Evidence boundary</p>
          <div className="mt-4 space-y-3 text-xs leading-5 text-white/45">
            <p><strong className="text-white">Source:</strong> current frame from the uploaded play.</p>
            <p><strong className="text-white">Tracking:</strong> {approvedTracking ? `coach-approved job #${approvedTracking.id}` : "not attached; source-frame-only render"}.</p>
            <p><strong className="text-white">Output:</strong> AI-generated motion for communication and promotion.</p>
            <p><strong className="text-white">Not allowed:</strong> presenting the render as proof of what happened.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55"><Clapperboard className="h-4 w-4" />Cinematic export gallery</p><div className="flex items-center gap-2"><select value={shareHours} onChange={(event) => setShareHours(Number(event.target.value) as 24 | 72 | 168 | 720)} className="h-8 border border-white/10 bg-black/30 px-2 text-[10px] text-white/60" aria-label="Share link expiration"><option value={24}>Share 24h</option><option value={72}>Share 3 days</option><option value={168}>Share 7 days</option><option value={720}>Share 30 days</option></select><Button size="sm" variant="ghost" className="gap-2" onClick={() => void exportsQuery.refetch()}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button></div></div>
        {latestShare ? (
          <div className="mt-4 grid gap-4 border border-fuchsia-300/25 bg-fuchsia-300/5 p-4 md:grid-cols-[132px_1fr]">
            <div className="grid min-h-[132px] place-items-center bg-white p-3"><QRCodeSVG value={latestShare.url} size={112} level="M" /></div>
            <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-bold text-white"><Link2 className="h-4 w-4 text-fuchsia-300" />Secure replay link ready</p><p className="mt-2 break-all font-mono text-[10px] leading-5 text-white/40">{latestShare.url}</p><p className="mt-1 text-[10px] text-white/30">Expires {new Date(latestShare.expiresAt).toLocaleString()}. The link exposes only the generated replay.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" className="gap-2 bg-fuchsia-300 text-black hover:bg-fuchsia-200" onClick={() => { void navigator.clipboard.writeText(latestShare.url); toast.success("Link copied"); }}><Copy className="h-3.5 w-3.5" />Copy link</Button><Button size="sm" variant="outline" className="gap-2 border-red-400/25 text-red-200" onClick={() => revokeSharesMutation.mutate({ exportId: latestShare.exportId })} disabled={revokeSharesMutation.isPending}><XCircle className="h-3.5 w-3.5" />Revoke all links</Button></div></div>
          </div>
        ) : null}
        {exports.length === 0 ? <div className="mt-4 grid min-h-[160px] place-items-center border border-dashed border-white/10 text-center"><div><Film className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm text-white/40">No cinematic replays yet</p><p className="mt-1 text-xs text-white/25">The real source film and Tactical Twin remain unchanged.</p></div></div> : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {exports.map((item) => (
              <article key={item.id} className="border border-white/10 bg-black/25 p-3">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">{item.style.replaceAll("_", " ")}</p><p className="mt-1 font-mono text-[9px] uppercase text-white/30">{item.aspectRatio} · {item.durationSeconds}s · #{item.id}</p></div><span className={`border px-2 py-1 text-[9px] font-bold uppercase ${statusClass(item.status)}`}>{item.status}</span></div>
                {item.id === selectedExport?.id && playbackQuery.data?.url ? <video src={playbackQuery.data.url} controls playsInline className="mt-3 aspect-video w-full bg-black object-contain" /> : null}
                {item.errorMessage ? <p className="mt-3 text-xs leading-5 text-red-200/70">{item.errorMessage}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === "completed" ? <Button size="sm" variant="outline" onClick={() => setSelectedExportId(item.id)}>Preview</Button> : null}
                  {item.status === "completed" && playbackQuery.data?.url && item.id === selectedExport?.id ? <a href={playbackQuery.data.url} download={`tactical-twin-${reconstructionId}-cinematic.mp4`} className="inline-flex h-8 items-center gap-1.5 border border-white/15 px-3 text-xs font-medium text-white/70 hover:text-white"><Download className="h-3.5 w-3.5" />Download</a> : null}
                  {["queued", "in_progress"].includes(item.status) ? <Button size="sm" variant="outline" onClick={() => refreshMutation.mutate({ exportId: item.id })} disabled={refreshMutation.isPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Check</Button> : null}
                  {["queued", "in_progress"].includes(item.status) ? <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate({ exportId: item.id })}>Cancel</Button> : null}
                  <Button size="icon" variant="ghost" aria-label={`Delete cinematic export ${item.id}`} onClick={() => deleteMutation.mutate({ exportId: item.id })}><Trash2 className="h-3.5 w-3.5 text-red-300" /></Button>
                  {item.status === "completed" ? <Button size="sm" variant="ghost" className="gap-1.5" aria-label={`Create secure share link for cinematic export ${item.id}`} onClick={() => createShare(item.id)} disabled={createShareMutation.isPending}><Share2 className="h-3.5 w-3.5" />Share</Button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

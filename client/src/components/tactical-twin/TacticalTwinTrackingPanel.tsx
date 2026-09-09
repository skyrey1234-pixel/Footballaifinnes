import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import type { TwinTrackedBall, TwinTrackedPlayer } from "@shared/tacticalTwinStage2";
import { BadgeCheck, CircleDot, Crosshair, Loader2, Play, RefreshCw, ScanLine, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CapturedFrame = {
  frameIndex: number;
  timestampMs: number;
  imageWidth: number;
  imageHeight: number;
  dataUrl: string;
};

function formatTimestamp(milliseconds: number) {
  const seconds = Math.max(0, milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
}

function waitForEvent(target: HTMLMediaElement, eventName: "loadedmetadata" | "seeked", timeoutMs = 20_000) {
  if (eventName === "loadedmetadata" && target.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };
    const onEvent = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Source film could not be decoded for automatic tracking.")); };
    timer = window.setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for source film ${eventName}.`)); }, timeoutMs);
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
    if (eventName === "loadedmetadata" && target.readyState >= HTMLMediaElement.HAVE_METADATA) queueMicrotask(onEvent);
  });
}

async function seekForCapture(video: HTMLVideoElement, time: number) {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA) await waitForEvent(video, "loadedmetadata");
  if (Math.abs(video.currentTime - time) < 0.03 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const waiting = waitForEvent(video, "seeked");
  video.currentTime = Math.max(0, time);
  await waiting;
}

function captureVideoFrame(video: HTMLVideoElement, frameIndex: number, timestampMs: number): CapturedFrame {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("The source film has no decoded frame dimensions yet.");
  const outputWidth = Math.min(960, sourceWidth);
  const outputHeight = Math.max(180, Math.round((sourceHeight / sourceWidth) * outputWidth));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot capture source-film frames.");
  context.drawImage(video, 0, 0, outputWidth, outputHeight);
  return {
    frameIndex,
    timestampMs,
    imageWidth: outputWidth,
    imageHeight: outputHeight,
    dataUrl: canvas.toDataURL("image/jpeg", 0.72),
  };
}

function TrackingOverlay({ players, ball }: { players: TwinTrackedPlayer[]; ball: TwinTrackedBall }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Automatic player and ball tracking overlay">
      {players.map((player) => {
        const box = player.bbox;
        const color = player.unit === "offense" ? "#34d399" : player.unit === "defense" ? "#fb7185" : player.unit === "official" ? "#f8fafc" : "#fbbf24";
        return (
          <g key={player.trackId}>
            <rect x={box.x * 100} y={box.y * 100} width={box.width * 100} height={box.height * 100} fill="none" stroke={color} strokeWidth="0.45" strokeDasharray={player.occluded ? "1.4 1" : undefined} vectorEffect="non-scaling-stroke" />
            <rect x={box.x * 100} y={Math.max(0, box.y * 100 - 4)} width="8" height="3.6" fill="rgba(0,0,0,.82)" />
            <text x={box.x * 100 + 0.8} y={Math.max(2.8, box.y * 100 - 1.2)} fill={color} fontSize="2.3" fontFamily="monospace">{player.label.slice(0, 8)}</text>
          </g>
        );
      })}
      {ball.visible && ball.imagePoint ? <circle cx={ball.imagePoint.x * 100} cy={ball.imagePoint.y * 100} r="1.35" fill="none" stroke="#fde047" strokeWidth="0.7" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
}

export function TacticalTwinTrackingPanel({
  reconstructionId,
  sourceType,
  captureUrl,
  sourceStartSeconds,
}: {
  reconstructionId: number;
  sourceType: string;
  captureUrl?: string | null;
  sourceStartSeconds: number;
}) {
  const utils = trpc.useUtils();
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const stoppedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Ready to scan the selected play");
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [editingPlayers, setEditingPlayers] = useState<TwinTrackedPlayer[] | null>(null);
  const [editingBall, setEditingBall] = useState<TwinTrackedBall | null>(null);

  const jobsQuery = trpc.tacticalTwinStage2.listTracking.useQuery({ reconstructionId });
  const currentJob = jobsQuery.data?.[0] ?? null;
  const trackingQuery = trpc.tacticalTwinStage2.tracking.useQuery(
    { jobId: currentJob?.id ?? 0 },
    { enabled: Boolean(currentJob?.id), refetchInterval: running ? 2_500 : false },
  );
  const frames = trackingQuery.data?.frames ?? [];
  const selectedFrame = frames[Math.max(0, Math.min(selectedFrameIndex, frames.length - 1))] ?? null;

  useEffect(() => {
    if (!selectedFrame) return;
    setEditingPlayers(Array.isArray(selectedFrame.players) ? selectedFrame.players as TwinTrackedPlayer[] : []);
    setEditingBall(selectedFrame.ball as TwinTrackedBall);
    const video = captureVideoRef.current;
    if (video?.readyState && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = sourceStartSeconds + selectedFrame.timestampMs / 1000;
    }
  }, [selectedFrame, sourceStartSeconds]);

  useEffect(() => () => { stoppedRef.current = true; }, []);

  const startMutation = trpc.tacticalTwinStage2.startTracking.useMutation();
  const analyzeMutation = trpc.tacticalTwinStage2.analyzeFrameBatch.useMutation();
  const retryMutation = trpc.tacticalTwinStage2.retryTracking.useMutation();
  const approveMutation = trpc.tacticalTwinStage2.approveTracking.useMutation({
    onSuccess: async () => {
      await jobsQuery.refetch();
      await trackingQuery.refetch();
      toast.success("Automatic tracks approved by coach");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateFrameMutation = trpc.tacticalTwinStage2.updateTrackedFrame.useMutation({
    onSuccess: async () => {
      await trackingQuery.refetch();
      toast.success("Tracked frame correction saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const canTrack = sourceType === "upload" && Boolean(captureUrl);
  const calibration = currentJob?.calibration && typeof currentJob.calibration === "object"
    ? currentJob.calibration as { quality?: string; confidence?: number; limitations?: string[] }
    : null;
  const completion = currentJob ? Math.round((currentJob.processedFrames / Math.max(1, currentJob.totalFrames)) * 100) : localProgress;
  const averageConfidence = frames.length
    ? Math.round(frames.reduce((sum, frame) => sum + frame.frameConfidence, 0) / frames.length)
    : 0;

  const runTracking = async () => {
    if (!canTrack || !captureVideoRef.current) {
      toast.error("Automatic tracking currently requires stored uploaded football film.");
      return;
    }
    stoppedRef.current = false;
    setRunning(true);
    setStatusMessage("Preparing source film for frame capture…");
    try {
      const job = await startMutation.mutateAsync({ reconstructionId, samplingFps: 2, sourceFps: 30 });
      const detail = await utils.tacticalTwinStage2.tracking.fetch({ jobId: job.id });
      const done = new Set(detail.frames.map((frame) => frame.frameIndex));
      const video = captureVideoRef.current;
      video.pause();
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
        const metadataReady = waitForEvent(video, "loadedmetadata", 45_000);
        video.load();
        await metadataReady;
      }

      const uncaptured: CapturedFrame[] = [];
      for (let index = 0; index < job.totalFrames; index += 1) {
        if (done.has(index)) continue;
        if (stoppedRef.current) throw new Error("Tracking paused by coach.");
        const timestampMs = Math.round((index / job.samplingFps) * 1000);
        setStatusMessage(`Capturing evidence frame ${index + 1} of ${job.totalFrames}…`);
        await seekForCapture(video, sourceStartSeconds + timestampMs / 1000);
        uncaptured.push(captureVideoFrame(video, index, timestampMs));
        setLocalProgress(Math.round(((index + 1) / Math.max(1, job.totalFrames)) * 35));
      }

      for (let offset = 0; offset < uncaptured.length; offset += 3) {
        if (stoppedRef.current) throw new Error("Tracking paused by coach.");
        const batch = uncaptured.slice(offset, offset + 3);
        setStatusMessage(`AI tracking frames ${batch[0].frameIndex + 1}–${batch.at(-1)!.frameIndex + 1}…`);
        await analyzeMutation.mutateAsync({ jobId: job.id, frames: batch });
        const analyzed = done.size + offset + batch.length;
        setLocalProgress(35 + Math.round((analyzed / Math.max(1, job.totalFrames)) * 65));
        await trackingQuery.refetch();
      }

      await jobsQuery.refetch();
      await trackingQuery.refetch();
      setStatusMessage("Automatic tracking complete — coach review required");
      toast.success("Player and ball tracks are ready for coach review");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Automatic tracking stopped";
      setStatusMessage(message);
      if (!message.toLowerCase().includes("paused by coach")) toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  const saveCorrection = () => {
    if (!currentJob || !selectedFrame || !editingPlayers || !editingBall) return;
    updateFrameMutation.mutate({
      jobId: currentJob.id,
      frameId: selectedFrame.id,
      players: editingPlayers.map((player) => ({ ...player, manuallyCorrected: true })),
      ball: { ...editingBall, manuallyCorrected: true },
      frameConfidence: selectedFrame.frameConfidence,
    });
  };

  const unitCounts = useMemo(() => {
    const players = editingPlayers ?? [];
    return players.reduce((counts, player) => ({ ...counts, [player.unit]: (counts[player.unit] ?? 0) + 1 }), {} as Record<string, number>);
  }, [editingPlayers]);

  return (
    <section className="border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,47,73,.5),rgba(2,8,12,.96)_58%)] p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300"><ScanLine className="h-4 w-4" />Stage 2 · Automatic tracking</p>
          <h2 className="mt-2 text-xl font-black text-white">Player + Ball Vision Grid</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/45">TacticalEdge samples the selected source play, assigns anonymous tracks, estimates field position, and flags uncertainty. This is AI-assisted evidence—not official tracking data—and requires coach approval.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentJob?.status === "failed" ? <Button variant="outline" className="gap-2 border-amber-300/30 text-amber-200" onClick={async () => { await retryMutation.mutateAsync({ jobId: currentJob.id }); await jobsQuery.refetch(); void runTracking(); }}><RefreshCw className="h-4 w-4" />Retry failed batch</Button> : null}
          <Button className="gap-2 bg-cyan-300 text-slate-950 hover:bg-cyan-200" disabled={!canTrack || running || currentJob?.status === "approved"} onClick={() => void runTracking()}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{currentJob ? "Resume Auto Track" : "Auto Track This Play"}</Button>
          {currentJob && frames.length > 0 ? <Button variant="outline" className="gap-2 border-emerald-400/30 text-emerald-200" disabled={approveMutation.isPending || currentJob.status === "approved"} onClick={() => approveMutation.mutate({ jobId: currentJob.id })}><BadgeCheck className="h-4 w-4" />{currentJob.status === "approved" ? "Coach Approved" : "Approve Tracks"}</Button> : null}
        </div>
      </div>

      {!canTrack ? <div className="mt-4 flex gap-3 border border-amber-300/20 bg-amber-300/5 p-4 text-xs leading-5 text-amber-100/70"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>Automatic tracking needs stored uploaded film. Camera and Screen Share Twins remain local-only and cannot be retroactively tracked.</span></div> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="border border-white/10 bg-black/25 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-white/30">Job state</p><p className="mt-2 text-sm font-semibold uppercase text-cyan-200">{currentJob?.status ?? "ready"}</p></div>
        <div className="border border-white/10 bg-black/25 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-white/30">Frames tracked</p><p className="mt-2 font-mono text-xl text-white">{currentJob?.processedFrames ?? 0}<span className="text-white/30">/{currentJob?.totalFrames ?? 0}</span></p></div>
        <div className="border border-white/10 bg-black/25 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-white/30">Vision confidence</p><p className="mt-2 font-mono text-xl text-white">{averageConfidence}%</p></div>
        <div className="border border-white/10 bg-black/25 p-3"><p className="text-[9px] uppercase tracking-[0.16em] text-white/30">Field calibration</p><p className="mt-2 text-sm font-semibold uppercase text-white">{calibration?.quality ?? "pending"} {calibration?.confidence ? `· ${calibration.confidence}%` : ""}</p></div>
      </div>
      <Progress value={completion} className="mt-3 h-1.5" />
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200/70">{statusMessage}</p>

      {canTrack && captureUrl && frames.length === 0 ? (
        <video ref={captureVideoRef} src={captureUrl} muted playsInline preload="metadata" className="hidden" />
      ) : null}

      {selectedFrame && editingPlayers && editingBall ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <div className="relative min-h-[320px] bg-black md:min-h-[420px]">
              <video ref={captureVideoRef} src={captureUrl ?? undefined} muted playsInline preload="metadata" className="h-[320px] w-full bg-black object-contain md:h-[420px]" controls />
              <TrackingOverlay players={editingPlayers} ball={editingBall} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input type="range" min="0" max={Math.max(0, frames.length - 1)} value={selectedFrameIndex} onChange={(event) => setSelectedFrameIndex(Number(event.target.value))} className="h-1.5 flex-1 accent-cyan-300" aria-label="Tracked evidence frame" />
              <span className="font-mono text-xs text-cyan-200">F{selectedFrame.frameIndex + 1} · {formatTimestamp(selectedFrame.timestampMs)}</span>
            </div>
          </div>

          <div className="border border-white/10 bg-black/30 p-4">
            <div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Coach correction</p><span className="font-mono text-[10px] text-white/35">O {unitCounts.offense ?? 0} · D {unitCounts.defense ?? 0} · ? {unitCounts.unknown ?? 0}</span></div>
            <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {editingPlayers.map((player, index) => (
                <div key={`${player.trackId}-${index}`} className="border border-white/8 p-2">
                  <div className="grid grid-cols-[72px_1fr_90px] gap-2">
                    <Input value={player.label} aria-label={`Track ${player.trackId} label`} onChange={(event) => setEditingPlayers((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value.slice(0, 48), manuallyCorrected: true } : item) ?? null)} />
                    <select value={player.unit} aria-label={`Track ${player.trackId} unit`} onChange={(event) => setEditingPlayers((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value as TwinTrackedPlayer["unit"], manuallyCorrected: true } : item) ?? null)} className="h-9 border border-input bg-background px-2 text-xs"><option value="offense">Offense</option><option value="defense">Defense</option><option value="official">Official</option><option value="unknown">Unknown</option></select>
                    <Input value={player.jerseyNumber ?? ""} aria-label={`Track ${player.trackId} jersey number`} placeholder="Jersey ?" onChange={(event) => setEditingPlayers((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, jerseyNumber: event.target.value.slice(0, 4) || null, manuallyCorrected: true } : item) ?? null)} />
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <Input type="number" min="0" max="1" step="0.01" value={player.fieldPoint?.x ?? ""} aria-label={`Track ${player.trackId} field x`} placeholder="Field X" onChange={(event) => setEditingPlayers((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, fieldPoint: { x: Math.max(0, Math.min(1, Number(event.target.value) || 0)), y: item.fieldPoint?.y ?? item.imagePoint.y, confidence: item.fieldPoint?.confidence ?? item.imagePoint.confidence }, manuallyCorrected: true } : item) ?? null)} />
                    <Input type="number" min="0" max="1" step="0.01" value={player.fieldPoint?.y ?? ""} aria-label={`Track ${player.trackId} field y`} placeholder="Field Y" onChange={(event) => setEditingPlayers((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, fieldPoint: { x: item.fieldPoint?.x ?? item.imagePoint.x, y: Math.max(0, Math.min(1, Number(event.target.value) || 0)), confidence: item.fieldPoint?.confidence ?? item.imagePoint.confidence }, manuallyCorrected: true } : item) ?? null)} />
                    <label className="flex items-center gap-1.5 text-[10px] uppercase text-white/45"><input type="checkbox" checked={player.occluded} onChange={(event) => setEditingPlayers((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, occluded: event.target.checked, manuallyCorrected: true } : item) ?? null)} />Occluded</label>
                  </div>
                  <p className="mt-1.5 font-mono text-[9px] uppercase text-white/30">{player.trackId} · image {player.imagePoint.confidence}% · field {player.fieldPoint?.confidence ?? 0}%</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border border-yellow-300/20 bg-yellow-300/5 p-3">
              <label className="flex items-center gap-2 text-xs text-yellow-100"><input type="checkbox" checked={editingBall.visible} onChange={(event) => setEditingBall({ ...editingBall, visible: event.target.checked, manuallyCorrected: true })} />Football visible</label>
              <div className="mt-3"><Label htmlFor="ball-possession">Possession track</Label><Input id="ball-possession" value={editingBall.possessedByTrackId ?? ""} onChange={(event) => setEditingBall({ ...editingBall, possessedByTrackId: event.target.value.slice(0, 32) || null, manuallyCorrected: true })} placeholder="O1, D4, unknown" className="mt-2" /></div>
            </div>
            <Button className="mt-4 w-full gap-2 bg-white text-black hover:bg-cyan-100" onClick={saveCorrection} disabled={updateFrameMutation.isPending}>{updateFrameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}Save frame correction</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

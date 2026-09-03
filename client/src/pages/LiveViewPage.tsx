import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { uploadVideoInChunks, type VideoUploadProgress } from "@/lib/chunkedVideoUpload";
import {
  getCompletedWindowIndex,
  selectFramesForWindow,
  shouldContinueAfterWindowFailure,
  transitionLiveRunState,
  type BufferedLiveFrame,
  type LiveRunState,
} from "@/lib/liveWindow";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Clock3,
  Crosshair,
  Eye,
  Gauge,
  Loader2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type SourceType = "upload" | "camera";
type Situation = {
  quarter: string;
  clock: string;
  down: number;
  distance: number;
  yardLine: string;
  ourScore: number;
  opponentScore: number;
  possession: "us" | "opponent" | "unknown";
  notes?: string;
};

type PendingWindow = {
  windowIndex: number;
  windowStartSeconds: number;
  windowEndSeconds: number;
  frames: string[];
};

const DEFAULT_SITUATION: Situation = {
  quarter: "1st",
  clock: "15:00",
  down: 1,
  distance: 10,
  yardLine: "50",
  ourScore: 0,
  opponentScore: 0,
  possession: "unknown",
};

const riskStyles: Record<string, string> = {
  low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  moderate: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  high: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  critical: "border-red-400/40 bg-red-400/10 text-red-300",
};

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function parseSituation(value: unknown): Situation {
  if (!value || typeof value !== "object") return DEFAULT_SITUATION;
  return { ...DEFAULT_SITUATION, ...(value as Partial<Situation>) };
}

function getInitialSessionId() {
  const raw = new URLSearchParams(window.location.search).get("session");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default function LiveViewPage() {
  const utils = trpc.useUtils();
  const [selectedId, setSelectedId] = useState<number | null>(getInitialSessionId);
  const [sourceType, setSourceType] = useState<SourceType>("upload");
  const [name, setName] = useState("Friday Night Live Test");
  const [opponentName, setOpponentName] = useState("");
  const [uploadedFileKey, setUploadedFileKey] = useState("");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState<VideoUploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const [runState, setRunState] = useState<LiveRunState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [secondsToNextRead, setSecondsToNextRead] = useState(15);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [queuedWindows, setQueuedWindows] = useState(0);
  const [situation, setSituation] = useState<Situation>(DEFAULT_SITUATION);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const captureBufferRef = useRef<BufferedLiveFrame[]>([]);
  const lastCaptureAtRef = useRef(-4);
  const lastWindowIndexRef = useRef(-1);
  const processingRef = useRef(false);
  const queuedWindowRef = useRef<PendingWindow | null>(null);
  const runStateRef = useRef<LiveRunState>("idle");
  const selectedIdRef = useRef<number | null>(null);
  const situationRef = useRef<Situation>(DEFAULT_SITUATION);
  const cameraStartedAtRef = useRef(0);
  const cameraElapsedBeforeStartRef = useRef(0);

  const sessionsQuery = trpc.live.list.useQuery();
  const sessionQuery = trpc.live.get.useQuery(
    { id: selectedId ?? 0 },
    { enabled: selectedId !== null, refetchInterval: runState === "running" ? 5_000 : false },
  );
  const eventsQuery = trpc.live.events.useQuery(
    { id: selectedId ?? 0, limit: 120 },
    { enabled: selectedId !== null, refetchInterval: runState === "running" ? 5_000 : false },
  );
  const createMutation = trpc.live.create.useMutation();
  const updateMutation = trpc.live.update.useMutation();
  const deleteMutation = trpc.live.delete.useMutation();
  const analyzeMutation = trpc.live.analyzeWindow.useMutation();

  const selectedSession = sessionQuery.data;
  const events = eventsQuery.data ?? [];
  const latestEvent = events[0];
  const videoSource = selectedSession?.sourceType === "upload"
    ? selectedSession.videoUrl || (selectedSession.videoFileKey ? `/manus-storage/${selectedSession.videoFileKey}` : "")
    : "";

  useEffect(() => {
    selectedIdRef.current = selectedId;
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("session", String(selectedId));
    else url.searchParams.delete("session");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selectedId]);

  useEffect(() => {
    situationRef.current = situation;
  }, [situation]);

  useEffect(() => {
    runStateRef.current = runState;
  }, [runState]);

  useEffect(() => {
    if (!selectedSession) return;
    setSituation(parseSituation(selectedSession.situation));
    setElapsedSeconds(selectedSession.currentVideoSecond || 0);
    if (selectedSession.status === "paused") setRunState("paused");
    else if (selectedSession.status === "complete") setRunState("complete");
    else if (selectedSession.status === "live") setRunState("paused");
  }, [selectedSession?.id]);

  useEffect(() => () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  const probabilities = useMemo(() => {
    const value = latestEvent?.nextPlayProbabilities;
    return Array.isArray(value)
      ? (value as Array<{ label: string; probability: number; reason: string }>).slice().sort((a, b) => b.probability - a.probability)
      : [];
  }, [latestEvent]);

  const tendencyRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const label = event.playCall?.trim();
      if (!label || label.toLowerCase() === "unclear") continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(1, ...rows.map(([, count]) => count));
    return rows.map(([label, count]) => ({ label, count, width: Math.round((count / max) * 100) }));
  }, [events]);

  const captureFrame = (second: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth < 2) return;
    const targetWidth = 640;
    const targetHeight = Math.max(240, Math.round((video.videoHeight / video.videoWidth) * targetWidth));
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.68);
    captureBufferRef.current.push({ second, dataUrl });
    captureBufferRef.current = captureBufferRef.current.filter((frame) => frame.second >= second - 24).slice(-10);
  };

  const processWindow = async (window: PendingWindow): Promise<void> => {
    const sessionId = selectedIdRef.current;
    if (!sessionId || window.frames.length === 0) return;
    if (processingRef.current) {
      queuedWindowRef.current = window;
      setQueuedWindows(1);
      return;
    }
    processingRef.current = true;
    setIsAnalyzing(true);
    try {
      await analyzeMutation.mutateAsync({
        id: sessionId,
        ...window,
        situation: situationRef.current,
      });
      await Promise.all([
        utils.live.events.invalidate({ id: sessionId }),
        utils.live.get.invalidate({ id: sessionId }),
        utils.live.list.invalidate(),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Live AI read failed; the next window will retry.");
      if (!shouldContinueAfterWindowFailure(runStateRef.current)) queuedWindowRef.current = null;
    } finally {
      processingRef.current = false;
      setIsAnalyzing(false);
      const next = queuedWindowRef.current;
      queuedWindowRef.current = null;
      setQueuedWindows(0);
      if (next && runStateRef.current === "running") void processWindow(next);
    }
  };

  const getCurrentSecond = () => {
    if (selectedSession?.sourceType === "upload") return videoRef.current?.currentTime ?? elapsedSeconds;
    if (runStateRef.current === "running" && cameraStartedAtRef.current > 0) {
      return cameraElapsedBeforeStartRef.current + (performance.now() - cameraStartedAtRef.current) / 1_000;
    }
    return cameraElapsedBeforeStartRef.current;
  };

  const runCaptureLoop = () => {
    if (runStateRef.current !== "running") return;
    const currentSecond = getCurrentSecond();
    setElapsedSeconds(Math.floor(currentSecond));
    const positionInWindow = currentSecond % 15;
    setSecondsToNextRead(Math.max(0, Math.ceil(15 - positionInWindow)));

    if (currentSecond - lastCaptureAtRef.current >= 3.5) {
      captureFrame(currentSecond);
      lastCaptureAtRef.current = currentSecond;
    }

    const completedWindowIndex = getCompletedWindowIndex(currentSecond);
    if (completedWindowIndex >= 0 && completedWindowIndex > lastWindowIndexRef.current) {
      const windowStartSeconds = completedWindowIndex * 15;
      const windowEndSeconds = windowStartSeconds + 15;
      const frames = selectFramesForWindow(captureBufferRef.current, completedWindowIndex);
      if (frames.length > 0) {
        lastWindowIndexRef.current = completedWindowIndex;
        void processWindow({
          windowIndex: completedWindowIndex,
          windowStartSeconds,
          windowEndSeconds,
          frames,
        });
      }
    }
    animationFrameRef.current = requestAnimationFrame(runCaptureLoop);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(null);
    setUploadedFileKey("");
    setUploadedVideoUrl("");
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(URL.createObjectURL(file));
    try {
      const result = await uploadVideoInChunks(file, setUploadProgress);
      setUploadedFileKey(result.fileKey);
      setUploadedVideoUrl(result.videoUrl);
      toast.success("Live test footage is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Video upload failed");
    } finally {
      setUploading(false);
    }
  };

  const createSession = async () => {
    if (!name.trim() || !opponentName.trim()) {
      toast.error("Add a session name and opponent.");
      return;
    }
    if (sourceType === "upload" && !uploadedFileKey) {
      toast.error("Upload game footage first.");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        opponentName: opponentName.trim(),
        sourceType,
        videoFileKey: sourceType === "upload" ? uploadedFileKey : undefined,
        videoUrl: sourceType === "upload" ? uploadedVideoUrl : undefined,
        analysisIntervalSeconds: 15,
      });
      await utils.live.list.invalidate();
      setSelectedId(result.id);
      toast.success("Live command center created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create live session");
    }
  };

  const startSession = async () => {
    if (!selectedId || !selectedSession) return;
    try {
      if (selectedSession.sourceType === "camera") {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        cameraStartedAtRef.current = performance.now();
      } else {
        if (!videoRef.current) return;
        await videoRef.current.play();
      }

      const nextState = transitionLiveRunState(runStateRef.current, "start");
      runStateRef.current = nextState;
      setRunState(nextState);
      await updateMutation.mutateAsync({ id: selectedId, status: "live", situation });
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(runCaptureLoop);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the live feed");
    }
  };

  const pauseSession = async () => {
    if (!selectedId) return;
    const currentSecond = getCurrentSecond();
    const nextState = transitionLiveRunState(runStateRef.current, "pause");
    runStateRef.current = nextState;
    setRunState(nextState);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    videoRef.current?.pause();
    if (selectedSession?.sourceType === "camera") {
      cameraElapsedBeforeStartRef.current = currentSecond;
      cameraStartedAtRef.current = 0;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    await updateMutation.mutateAsync({
      id: selectedId,
      status: "paused",
      currentVideoSecond: Math.floor(currentSecond),
      situation,
    });
    await utils.live.get.invalidate({ id: selectedId });
  };

  const endSession = async () => {
    if (!selectedId) return;
    const currentSecond = getCurrentSecond();
    const nextState = transitionLiveRunState(runStateRef.current, "end");
    runStateRef.current = nextState;
    setRunState(nextState);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    videoRef.current?.pause();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    await updateMutation.mutateAsync({
      id: selectedId,
      status: "complete",
      currentVideoSecond: Math.floor(currentSecond),
      situation,
    });
    await Promise.all([utils.live.get.invalidate({ id: selectedId }), utils.live.list.invalidate()]);
    toast.success("Live session closed. Every AI read remains in the timeline.");
  };

  const resetAnalysisPosition = () => {
    captureBufferRef.current = [];
    lastCaptureAtRef.current = -4;
    lastWindowIndexRef.current = -1;
    cameraElapsedBeforeStartRef.current = 0;
    cameraStartedAtRef.current = 0;
    setElapsedSeconds(0);
    setSecondsToNextRead(15);
    if (videoRef.current && selectedSession?.sourceType === "upload") videoRef.current.currentTime = 0;
  };

  if (!selectedId) {
    return (
      <div className="mx-auto max-w-7xl space-y-8">
        <LiveHeader />
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden border border-emerald-400/20 bg-[#070b0d] p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 field-grid opacity-20" />
            <div className="relative space-y-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">Create a live intelligence run</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Choose the feed entering the film room</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Use uploaded footage to simulate a live game now, or use this device&apos;s camera for a real sideline feed. The active browser samples evidence and requests one AI read every 15 seconds.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setSourceType("upload")} className={`p-4 text-left transition-colors ${sourceType === "upload" ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/[0.03] text-white hover:border-emerald-400/30"}`}>
                  <Upload className="h-5 w-5" />
                  <span className="mt-8 block font-semibold">Upload replay</span>
                  <span className={`mt-1 block text-xs ${sourceType === "upload" ? "text-black/65" : "text-white/45"}`}>Best for testing the full live workflow</span>
                </button>
                <button onClick={() => setSourceType("camera")} className={`p-4 text-left transition-colors ${sourceType === "camera" ? "bg-emerald-400 text-black" : "border border-white/10 bg-white/[0.03] text-white hover:border-emerald-400/30"}`}>
                  <Camera className="h-5 w-5" />
                  <span className="mt-8 block font-semibold">Live camera</span>
                  <span className={`mt-1 block text-xs ${sourceType === "camera" ? "text-black/65" : "text-white/45"}`}>Film from this phone, tablet, or laptop</span>
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="live-name">Session name</Label>
                  <Input id="live-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Friday Night — Live Test" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="live-opponent">Opponent</Label>
                  <Input id="live-opponent" value={opponentName} onChange={(event) => setOpponentName(event.target.value)} placeholder="Mandarin Mustangs" />
                </div>
              </div>

              {sourceType === "upload" ? (
                <label className="block cursor-pointer border border-dashed border-white/15 bg-white/[0.025] p-5 transition-colors hover:border-emerald-400/50">
                  <input type="file" accept="video/*" className="hidden" onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUpload(file);
                  }} />
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center bg-emerald-400/10 text-emerald-400"><Video className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{uploading ? "Uploading test footage…" : uploadedFileKey ? "Footage ready for live simulation" : "Select game footage"}</p>
                      <p className="mt-1 text-xs text-white/45">MP4, MOV, or other browser-playable video · resumable uploads up to 6GB</p>
                    </div>
                    {uploadedFileKey ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Upload className="h-5 w-5 text-white/35" />}
                  </div>
                  {uploadProgress && (
                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs text-white/50">
                        <span>{uploadProgress.doneMB.toFixed(0)} / {uploadProgress.totalMB.toFixed(0)} MB</span>
                        <span>{uploadProgress.percent}%{uploadProgress.speedMBs > 0 ? ` · ${uploadProgress.speedMBs.toFixed(1)} MB/s` : ""}</span>
                      </div>
                      <div className="h-1.5 bg-white/10"><div className="h-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${uploadProgress.percent}%` }} /></div>
                    </div>
                  )}
                </label>
              ) : (
                <div className="border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-start gap-4">
                    <Radio className="mt-1 h-5 w-5 text-red-400" />
                    <div>
                      <p className="font-medium text-white">Camera permission starts only when you press Go Live</p>
                      <p className="mt-1 text-xs leading-5 text-white/45">Keep the browser open and the field centered. TacticalEdge samples still frames; it does not store the camera video in this first live mode.</p>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={() => void createSession()} disabled={createMutation.isPending || uploading || !name.trim() || !opponentName.trim() || (sourceType === "upload" && !uploadedFileKey)} className="h-12 w-full bg-emerald-400 font-semibold text-black hover:bg-emerald-300">
                {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crosshair className="mr-2 h-4 w-4" />}
                Open Live Command Center
              </Button>
            </div>
          </section>

          <section className="border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">Recent operations</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Live sessions</h2>
              </div>
              <Badge variant="outline" className="border-white/10 text-white/55">{sessionsQuery.data?.length ?? 0} saved</Badge>
            </div>
            <div className="mt-5 space-y-2">
              {sessionsQuery.isLoading ? <div className="py-16 text-center text-sm text-white/40">Loading live sessions…</div> : null}
              {sessionsQuery.data?.length === 0 ? (
                <div className="border border-white/10 py-16 text-center"><Radio className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm text-white/40">Your first live intelligence run will appear here.</p></div>
              ) : null}
              {sessionsQuery.data?.map((session) => (
                <div key={session.id} className="group flex items-center gap-3 border border-white/8 bg-black/20 p-4 hover:border-emerald-400/30">
                  <button onClick={() => setSelectedId(session.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className={`grid h-10 w-10 place-items-center ${session.status === "live" ? "bg-red-400/15 text-red-400" : "bg-emerald-400/10 text-emerald-400"}`}>
                      {session.sourceType === "camera" ? <Camera className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{session.name}</span>
                      <span className="mt-1 block truncate text-xs text-white/40">vs {session.opponentName} · {session.sourceType}</span>
                    </span>
                    <Badge variant="outline" className="border-white/10 text-[10px] uppercase text-white/45">{session.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-emerald-400" />
                  </button>
                  <button onClick={async () => {
                    await deleteMutation.mutateAsync({ id: session.id });
                    await utils.live.list.invalidate();
                  }} aria-label={`Delete ${session.name}`} className="p-2 text-white/20 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (sessionQuery.isLoading || !selectedSession) {
    return <div className="grid min-h-[560px] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  }

  return (
    <div className="mx-auto max-w-[1560px] space-y-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <button onClick={() => {
            if (runState === "running") void pauseSession();
            setSelectedId(null);
          }} className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/40 hover:text-emerald-400"><ArrowLeft className="h-3.5 w-3.5" /> Live session list</button>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${runState === "running" ? "bg-red-500 text-white" : "bg-white/8 text-white/55"}`}><span className={`h-2 w-2 rounded-full bg-current ${runState === "running" ? "animate-pulse" : ""}`} />{runState === "running" ? "Live" : runState}</span>
            <span className="text-xs uppercase tracking-[0.18em] text-emerald-400">15-second AI cycle</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">{selectedSession.name}</h1>
          <p className="mt-1 text-sm text-white/45">vs {selectedSession.opponentName} · {selectedSession.sourceType === "upload" ? "Uploaded footage simulation" : "Device camera feed"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {runState !== "running" && runState !== "complete" ? <Button onClick={() => void startSession()} className="bg-emerald-400 text-black hover:bg-emerald-300"><Play className="mr-2 h-4 w-4" />{runState === "paused" ? "Resume Analysis" : "Go Live"}</Button> : null}
          {runState === "running" ? <Button onClick={() => void pauseSession()} variant="outline" className="border-amber-400/30 text-amber-300"><Pause className="mr-2 h-4 w-4" />Pause</Button> : null}
          {runState !== "complete" ? <Button onClick={() => void endSession()} variant="outline" className="border-red-400/30 text-red-300"><CircleStop className="mr-2 h-4 w-4" />End Session</Button> : null}
          <Button onClick={resetAnalysisPosition} variant="ghost" className="text-white/50"><RotateCcw className="mr-2 h-4 w-4" />Reset footage</Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <section className="relative overflow-hidden border border-white/10 bg-black">
            <video
              ref={videoRef}
              src={selectedSession.sourceType === "upload" ? videoSource : undefined}
              className="aspect-video w-full bg-black object-contain"
              playsInline
              controls={selectedSession.sourceType === "upload"}
              crossOrigin="anonymous"
              onLoadedMetadata={(event) => {
                if (selectedSession.sourceType !== "upload") return;
                const restoreAt = Math.min(
                  Math.max(0, selectedSession.currentVideoSecond || 0),
                  Math.max(0, event.currentTarget.duration - 0.25),
                );
                event.currentTarget.currentTime = restoreAt;
              }}
              onEnded={() => void endSession()}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${runState === "running" ? "animate-pulse bg-red-500" : "bg-white/30"}`} />
                <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-white">{runState === "running" ? "AI watching" : "Feed idle"}</span>
              </div>
              <div className="flex items-center gap-2 bg-black/55 px-3 py-2 backdrop-blur">
                <Clock3 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono text-xs text-white">{formatClock(elapsedSeconds)}</span>
              </div>
            </div>
            {runState === "running" ? <div className="pointer-events-none absolute inset-0 border border-emerald-400/25"><div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80 anim-scan" /></div> : null}
          </section>

          <section className="grid gap-px bg-white/10 md:grid-cols-4">
            <Metric icon={ScanLine} label="Next AI read" value={runState === "running" ? `${secondsToNextRead}s` : "Paused"} accent />
            <Metric icon={Activity} label="Windows analyzed" value={String(events.length)} />
            <Metric icon={Gauge} label="Latest confidence" value={latestEvent ? `${latestEvent.confidence}%` : "—"} />
            <Metric icon={BrainCircuit} label="AI queue" value={isAnalyzing ? (queuedWindows ? "1 waiting" : "Analyzing") : "Ready"} />
          </section>

          <SituationBoard situation={situation} setSituation={setSituation} disabled={runState === "complete"} />

          <TendencyChart rows={tendencyRows} windowCount={events.length} />

          <section className="border border-white/10 bg-white/[0.02] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Evidence timeline</p><h2 className="mt-1 text-xl font-semibold text-white">Every 15-second read</h2></div>
              <Badge variant="outline" className="border-emerald-400/20 text-emerald-300">AI-estimated · {selectedSession.sourceType}</Badge>
            </div>
            <div className="space-y-2">
              {events.length === 0 ? <div className="border border-white/8 py-14 text-center"><Eye className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm text-white/40">Start the feed. The first evidence-linked read arrives after 15 seconds.</p></div> : null}
              {events.map((event) => {
                const evidence = Array.isArray(event.evidence) ? event.evidence as Array<{ frameIndex: number; observation: string }> : [];
                return (
                  <button key={event.id} onClick={() => {
                    if (selectedSession.sourceType === "upload" && videoRef.current) videoRef.current.currentTime = event.windowStartSeconds;
                  }} className="grid w-full gap-3 border border-white/8 bg-black/20 p-4 text-left hover:border-emerald-400/25 md:grid-cols-[90px_1fr_auto]">
                    <div><p className="font-mono text-xs text-emerald-400">{formatClock(event.windowStartSeconds)}–{formatClock(event.windowEndSeconds)}</p><p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-white/25">AI estimate · {selectedSession.sourceType}</p></div>
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{event.playCall || event.visibleAction || "AI read"}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{event.predictionSummary}</p>{evidence[0] ? <p className="mt-2 text-[11px] text-white/30">Evidence: {evidence[0].observation}</p> : null}</div>
                    <div className="flex items-center gap-3"><span className="font-mono text-xs text-white/45">{event.confidence}%</span><Badge variant="outline" className={riskStyles[event.riskLevel] ?? riskStyles.low}>{event.riskLevel}</Badge></div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="relative overflow-hidden border border-emerald-400/25 bg-[#07100d] p-5">
            <div className="pointer-events-none absolute inset-0 field-grid opacity-15" />
            <div className="relative">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400"><Zap className="h-4 w-4" />Next-play prediction</span>{isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> : <span className="font-mono text-[10px] uppercase text-white/35">AI estimate · {selectedSession.sourceType}</span>}</div>
              <h2 className="mt-5 text-2xl font-semibold leading-tight text-white">{latestEvent?.predictionSummary || "Waiting for the first 15-second window."}</h2>
              <div className="mt-6 space-y-4">
                {probabilities.map((item, index) => (
                  <div key={`${item.label}-${index}`}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className={index === 0 ? "font-semibold text-white" : "text-white/60"}>{item.label}</span><span className="font-mono text-emerald-400">{item.probability}%</span></div>
                    <div className="h-1.5 bg-white/10"><div className={`h-full ${index === 0 ? "bg-emerald-400" : "bg-white/35"}`} style={{ width: `${item.probability}%` }} /></div>
                    {index === 0 ? <p className="mt-2 text-xs leading-5 text-white/40">{item.reason}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-px bg-white/10">
            <IntelCell label="Formation" value={latestEvent?.formation || "—"} />
            <IntelCell label="Personnel" value={latestEvent?.personnel || "—"} />
            <IntelCell label="Defense" value={latestEvent?.defensiveLook || "—"} />
            <IntelCell label="Observed call" value={latestEvent?.playCall || "—"} />
          </section>

          <section className="border border-blue-400/20 bg-blue-400/[0.06] p-5">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300"><Crosshair className="h-4 w-4" />Recommended counter</p><span className="text-[9px] uppercase tracking-[0.12em] text-white/25">AI estimate</span></div>
            <p className="mt-3 text-base leading-7 text-white">{latestEvent?.counterCall || "The counter call appears after the AI has visible evidence."}</p>
          </section>

          <section className="border border-amber-400/20 bg-amber-400/[0.05] p-5">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300"><Activity className="h-4 w-4" />Tendency shift</p><span className="text-[9px] uppercase tracking-[0.12em] text-white/25">AI estimate</span></div>
            <p className="mt-3 text-sm leading-6 text-white/70">{latestEvent?.tendencyShift || "No confirmed shift yet."}</p>
          </section>

          <section className="border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45"><ShieldAlert className="h-4 w-4" />Live alerts</p><span className="text-[9px] uppercase tracking-[0.12em] text-white/25">AI estimate</span></div>
            <div className="mt-4 space-y-2">
              {Array.isArray(latestEvent?.alerts) && (latestEvent.alerts as string[]).length > 0 ? (latestEvent.alerts as string[]).map((alert, index) => <div key={index} className="flex gap-3 border border-red-400/15 bg-red-400/[0.05] p-3 text-sm leading-5 text-red-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />{alert}</div>) : <p className="text-sm text-white/35">No urgent risk alerts.</p>}
            </div>
          </section>

          <p className="border-t border-white/10 pt-4 text-xs leading-5 text-white/30">Live insights are AI-generated estimates based on sampled visual frames and the situation you enter. Coaches should verify every recommendation against the field and their own call sheet.</p>
        </aside>
      </div>
    </div>
  );
}

function LiveHeader() {
  return (
    <header className="relative overflow-hidden border-b border-white/10 pb-7 pt-2">
      <div className="absolute left-1/2 top-0 h-52 w-[720px] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-red-400"><Radio className="h-4 w-4" />Live football intelligence</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">See the next call<br /><span className="text-emerald-400">before it happens.</span></h1><p className="mt-4 max-w-2xl text-base leading-7 text-white/50">Film a live game or replay uploaded footage. TacticalEdge samples the feed, reads formation and tendencies, then updates next-play probabilities every 15 seconds.</p></div>
        <div className="grid min-w-[280px] grid-cols-3 gap-px bg-white/10"><MiniStat value="15s" label="AI cycle" /><MiniStat value="4–6" label="Frames/read" /><MiniStat value="Live" label="Evidence" /></div>
      </div>
    </header>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return <div className="bg-[#080c0f] p-4 text-center"><p className="font-mono text-lg font-semibold text-emerald-400">{value}</p><p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p></div>;
}

function Metric({ icon: Icon, label, value, accent = false }: { icon: typeof Activity; label: string; value: string; accent?: boolean }) {
  return <div className="bg-[#080c0f] p-4"><Icon className={`h-4 w-4 ${accent ? "text-emerald-400" : "text-white/35"}`} /><p className="mt-4 text-xs uppercase tracking-[0.14em] text-white/30">{label}</p><p className={`mt-1 font-mono text-lg font-semibold ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p></div>;
}

function IntelCell({ label, value }: { label: string; value: string }) {
  return <div className="min-h-28 bg-[#080c0f] p-4"><div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-[0.16em] text-white/30">{label}</p><span className="text-[8px] uppercase tracking-[0.1em] text-emerald-400/45">AI est.</span></div><p className="mt-4 text-sm font-semibold text-white">{value}</p></div>;
}

function TendencyChart({ rows, windowCount }: { rows: Array<{ label: string; count: number; width: number }>; windowCount: number }) {
  return (
    <section className="border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Live tendency chart</p><h2 className="mt-1 text-xl font-semibold text-white">Detected play-call frequency</h2></div><Badge variant="outline" className="border-emerald-400/20 text-emerald-300">AI-estimated · {windowCount} windows</Badge></div>
      {rows.length === 0 ? <div className="mt-5 border border-white/8 py-9 text-center text-sm text-white/35">The chart builds as verified 15-second windows arrive.</div> : <div className="mt-6 space-y-4">{rows.map((row) => <div key={row.label} className="grid grid-cols-[minmax(100px,180px)_1fr_38px] items-center gap-3"><span className="truncate text-sm text-white/65">{row.label}</span><div className="h-2 bg-white/8"><div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${row.width}%` }} /></div><span className="text-right font-mono text-xs text-emerald-400">{row.count}</span></div>)}</div>}
      <p className="mt-5 text-[11px] leading-5 text-white/30">Source: AI labels from this session’s sampled visual windows. Counts are not official play-charting statistics until a coach verifies them.</p>
    </section>
  );
}

function SituationBoard({ situation, setSituation, disabled }: { situation: Situation; setSituation: (value: Situation) => void; disabled: boolean }) {
  const set = <K extends keyof Situation>(key: K, value: Situation[K]) => setSituation({ ...situation, [key]: value });
  return (
    <section className="border border-white/10 bg-white/[0.02] p-5">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Game state</p><h2 className="mt-1 text-xl font-semibold text-white">Situation board</h2></div><Badge variant="outline" className="border-emerald-400/20 text-emerald-300">Sent with every read</Badge></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <SituationField label="Quarter"><select disabled={disabled} value={situation.quarter} onChange={(event) => set("quarter", event.target.value)} className="h-10 w-full border border-white/10 bg-black/40 px-2 text-sm text-white"><option>1st</option><option>2nd</option><option>Halftime</option><option>3rd</option><option>4th</option><option>OT</option></select></SituationField>
        <SituationField label="Clock"><Input disabled={disabled} value={situation.clock} onChange={(event) => set("clock", event.target.value)} className="font-mono" /></SituationField>
        <SituationField label="Down"><Input disabled={disabled} type="number" min={1} max={4} value={situation.down} onChange={(event) => set("down", Number(event.target.value))} /></SituationField>
        <SituationField label="Distance"><Input disabled={disabled} type="number" min={0} max={99} value={situation.distance} onChange={(event) => set("distance", Number(event.target.value))} /></SituationField>
        <SituationField label="Yard line"><Input disabled={disabled} value={situation.yardLine} onChange={(event) => set("yardLine", event.target.value)} /></SituationField>
        <SituationField label="Our score"><Input disabled={disabled} type="number" min={0} value={situation.ourScore} onChange={(event) => set("ourScore", Number(event.target.value))} /></SituationField>
        <SituationField label="Their score"><Input disabled={disabled} type="number" min={0} value={situation.opponentScore} onChange={(event) => set("opponentScore", Number(event.target.value))} /></SituationField>
        <SituationField label="Possession"><select disabled={disabled} value={situation.possession} onChange={(event) => set("possession", event.target.value as Situation["possession"])} className="h-10 w-full border border-white/10 bg-black/40 px-2 text-sm text-white"><option value="unknown">Unknown</option><option value="us">Us</option><option value="opponent">Opponent</option></select></SituationField>
      </div>
    </section>
  );
}

function SituationField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-2"><span className="text-[10px] uppercase tracking-[0.14em] text-white/35">{label}</span>{children}</label>;
}

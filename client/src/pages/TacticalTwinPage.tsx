import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Play3DVisualizer from "@/components/play3d/Play3DVisualizer";
import { TacticalTwinMap, type TwinEditorTool } from "@/components/tactical-twin/TacticalTwinMap";
import { trpc } from "@/lib/trpc";
import {
  buildDefaultBallPath,
  buildDefaultTwinPlayers,
  toPlayerPos,
  type TacticalTwinMarker,
  type TacticalTwinPlayer,
  type TacticalTwinPlayType,
  type TacticalTwinPoint,
  type TacticalTwinSourceType,
} from "@shared/tacticalTwin";
import {
  ArrowLeft,
  BadgeCheck,
  CircleDot,
  Crosshair,
  Film,
  Flag,
  Loader2,
  Move,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  VideoOff,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

type TwinDraftState = {
  title: string;
  formation: string;
  playType: TacticalTwinPlayType;
  target: string;
  defenseScheme: string;
  players: TacticalTwinPlayer[];
  ballPath: TacticalTwinPoint[];
  markers: TacticalTwinMarker[];
  coachingNotes: string;
  confidence: number;
  coachVerified: boolean;
};

const tools: Array<{ id: TwinEditorTool; label: string; icon: typeof Move }> = [
  { id: "select", label: "Move", icon: Move },
  { id: "route", label: "Route", icon: Route },
  { id: "ball", label: "Ball", icon: CircleDot },
  { id: "mistake", label: "Mistake", icon: Flag },
  { id: "correction", label: "Fix", icon: BadgeCheck },
  { id: "key", label: "Key", icon: Crosshair },
];

const playTypes: TacticalTwinPlayType[] = ["pass", "run", "screen", "rpo", "special_teams", "unknown"];

function formatClock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

type TwinFilmHandle = {
  play: () => Promise<void> | null;
  pause: () => void;
  seek: (progress: number) => void;
};

const TwinFilmPane = forwardRef<TwinFilmHandle, {
  sourceType: TacticalTwinSourceType;
  youtubeVideoId?: string | null;
  videoUrl?: string | null;
  startSeconds: number;
  endSeconds: number;
  progress: number;
  playing: boolean;
  onProgress: (progress: number) => void;
}>(function TwinFilmPane({
  sourceType,
  youtubeVideoId,
  videoUrl,
  startSeconds,
  endSeconds,
  progress,
  playing,
  onProgress,
}, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mediaState, setMediaState] = useState<"loading" | "ready" | "playing" | "error">("loading");
  const [mediaMessage, setMediaMessage] = useState("Loading source film…");
  const duration = Math.max(1, endSeconds - startSeconds);
  const desiredTime = startSeconds + progress * duration;
  const playbackVideoUrl = videoUrl ? `${videoUrl}#t=${Math.max(0, startSeconds).toFixed(3)}` : null;

  const seekMedia = useCallback((nextProgress: number) => {
    const normalized = Math.max(0, Math.min(1, nextProgress));
    const nextTime = startSeconds + normalized * duration;
    if (videoRef.current) videoRef.current.currentTime = nextTime;
    if (iframeRef.current && sourceType === "youtube") {
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [nextTime, true] }), "*");
    }
  }, [duration, sourceType, startSeconds]);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (videoRef.current) {
        setMediaMessage("Starting source film…");
        return videoRef.current.play()
          .then(() => {
            setMediaState("playing");
            setMediaMessage("Source film playing");
          })
          .catch((error: unknown) => {
            setMediaState("error");
            setMediaMessage(error instanceof Error ? error.message : "The source film could not start.");
            throw error;
          });
      }
      if (iframeRef.current && sourceType === "youtube") {
        iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
      return null;
    },
    pause: () => {
      videoRef.current?.pause();
      if (iframeRef.current && sourceType === "youtube") {
        iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      }
    },
    seek: seekMedia,
  }), [seekMedia, sourceType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) video.pause();
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    if (Math.abs(video.currentTime - desiredTime) > (playing ? 0.9 : 0.15)) video.currentTime = desiredTime;
  }, [desiredTime, playing]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || sourceType !== "youtube") return;
    frame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [desiredTime, true] }), "*");
    if (!playing) frame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
  }, [desiredTime, playing, sourceType]);

  if (sourceType === "youtube" && youtubeVideoId) {
    return (
      <iframe
        ref={iframeRef}
        src={`https://www.youtube.com/embed/${youtubeVideoId}?start=${Math.floor(startSeconds)}&end=${Math.ceil(endSeconds)}&enablejsapi=1&rel=0`}
        title="Tactical Twin source film"
        className="min-h-[520px] w-full bg-black"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (sourceType === "upload" && playbackVideoUrl) {
    return (
      <div className="relative min-h-[520px] bg-black">
          <video
            ref={videoRef}
            src={playbackVideoUrl}
          className="h-[520px] w-full bg-black object-contain"
          playsInline
          controls
          preload="auto"
          onLoadStart={() => { setMediaState("loading"); setMediaMessage("Loading source film…"); }}
          onLoadedData={(event) => {
            if (Math.abs(event.currentTarget.currentTime - desiredTime) > 0.5) {
              setMediaState("loading");
              setMediaMessage("Seeking to source play…");
              event.currentTarget.currentTime = desiredTime;
              return;
            }
            setMediaState("ready");
            setMediaMessage("Source film ready");
          }}
          onSeeked={(event) => {
            if (event.currentTarget.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              setMediaState(event.currentTarget.paused ? "ready" : "playing");
              setMediaMessage(event.currentTarget.paused ? "Source film ready" : "Source film playing");
            }
          }}
          onCanPlay={() => { setMediaState((current) => current === "playing" ? current : "ready"); setMediaMessage((current) => current === "Source film playing" ? current : "Source film ready"); }}
          onPlaying={() => { setMediaState("playing"); setMediaMessage("Source film playing"); }}
          onWaiting={() => { setMediaState("loading"); setMediaMessage("Buffering source film…"); }}
          onError={(event) => {
            const code = event.currentTarget.error?.code;
            setMediaState("error");
            setMediaMessage(code ? `Source film error ${code}. Reopen the original session or retry.` : "Source film could not be loaded.");
          }}
          onTimeUpdate={(event) => {
            if (!playing) return;
            const next = (event.currentTarget.currentTime - startSeconds) / duration;
            if (next >= 1) onProgress(1);
            else if (next >= 0) onProgress(next);
          }}
        />
        <div className={`pointer-events-none absolute left-3 top-3 border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] backdrop-blur ${mediaState === "error" ? "border-red-400/40 bg-red-950/85 text-red-200" : mediaState === "playing" ? "border-emerald-400/40 bg-emerald-950/85 text-emerald-200" : "border-white/15 bg-black/75 text-white/60"}`}>
          {mediaMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[520px] place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.12),transparent_38%),#020605] px-8 text-center">
      <div className="max-w-md">
        <VideoOff className="mx-auto h-12 w-12 text-emerald-400/55" />
        <h3 className="mt-5 text-xl font-semibold text-white">Original footage is local-only</h3>
        <p className="mt-3 text-sm leading-6 text-white/45">Camera and Screen Share video is never stored by TacticalEdge. The verified five-second AI evidence remains attached, while the tactical map and 3D reconstruction stay fully editable.</p>
      </div>
    </div>
  );
});

export default function TacticalTwinPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id || 0);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.tacticalTwin.get.useQuery({ id }, { enabled: id > 0 });
  const playback = trpc.tacticalTwin.playbackUrl.useQuery(
    { id },
    { enabled: Boolean(id > 0 && data?.sourceType === "upload"), staleTime: 4 * 60 * 1000 },
  );
  const [draft, setDraft] = useState<TwinDraftState | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<TwinEditorTool>("select");
  const [view, setView] = useState<"film" | "map" | "3d">("map");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playbackFrameRef = useRef<number | null>(null);
  const playbackStartedAtRef = useRef(0);
  const playbackStartProgressRef = useRef(0);
  const filmHandleRef = useRef<TwinFilmHandle>(null);
  const nativeFilmTimeline = view === "film" && data?.sourceType === "upload";

  useEffect(() => {
    if (!data) return;
    const players = Array.isArray(data.players) ? data.players as TacticalTwinPlayer[] : [];
    setDraft({
      title: data.title,
      formation: data.formation,
      playType: data.playType as TacticalTwinPlayType,
      target: data.target ?? "",
      defenseScheme: data.defenseScheme,
      players,
      ballPath: Array.isArray(data.ballPath) ? data.ballPath as TacticalTwinPoint[] : [],
      markers: Array.isArray(data.markers) ? data.markers as TacticalTwinMarker[] : [],
      coachingNotes: data.coachingNotes ?? "",
      confidence: data.confidence,
      coachVerified: Boolean(data.coachVerified),
    });
    setSelectedPlayerId(players[0]?.id ?? null);
  }, [data]);

  const duration = Math.max(1, (data?.sourceEndSeconds ?? 1) - (data?.sourceStartSeconds ?? 0));
  useEffect(() => {
    if (!playing || nativeFilmTimeline) {
      if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = null;
      return;
    }
    playbackStartedAtRef.current = performance.now();
    playbackStartProgressRef.current = progress >= 1 ? 0 : progress;
    if (progress >= 1) setProgress(0);
    const tick = (now: number) => {
      const next = playbackStartProgressRef.current + (now - playbackStartedAtRef.current) / (duration * 1000);
      if (next >= 1) {
        setProgress(1);
        setPlaying(false);
        return;
      }
      setProgress(next);
      playbackFrameRef.current = requestAnimationFrame(tick);
    };
    playbackFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (playbackFrameRef.current !== null) cancelAnimationFrame(playbackFrameRef.current);
    };
  }, [duration, nativeFilmTimeline, playing]);

  const updateMutation = trpc.tacticalTwin.update.useMutation({
    onSuccess: async () => {
      await utils.tacticalTwin.get.invalidate({ id });
      await utils.tacticalTwin.list.invalidate();
      toast.success("Tactical Twin saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.tacticalTwin.delete.useMutation({
    onSuccess: async () => {
      await utils.tacticalTwin.list.invalidate();
      toast.success("Tactical Twin deleted");
      setLocation("/twins");
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedPlayer = draft?.players.find((item) => item.id === selectedPlayerId) ?? null;
  const updatePlayer = useCallback((playerId: string, patch: Partial<TacticalTwinPlayer>) => {
    setDraft((current) => current ? {
      ...current,
      coachVerified: false,
      players: current.players.map((player) => player.id === playerId ? { ...player, ...patch } : player),
    } : current);
  }, []);

  const save = () => {
    if (!draft) return;
    updateMutation.mutate({
      id,
      ...draft,
      target: draft.target.trim() || null,
      coachingNotes: draft.coachingNotes.trim() || null,
    });
  };

  const togglePlayback = () => {
    if (playing) {
      filmHandleRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (view !== "film") {
      setPlaying(true);
      return;
    }
    const playRequest = filmHandleRef.current?.play();
    if (!playRequest) {
      setPlaying(true);
      return;
    }
    playRequest
      .then(() => setPlaying(true))
      .catch((error: unknown) => {
        setPlaying(false);
        toast.error(error instanceof Error ? error.message : "Source film could not start");
      });
  };

  if (isLoading || !draft || !data) {
    return <div className="grid min-h-[70vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  }

  const videoUrl = data.sourceType === "upload" ? playback.data?.url ?? null : data.videoUrl;
  const threePlayers = draft.players.map(toPlayerPos);
  const threeAnnotations = draft.markers.map((marker) => ({
    kind: marker.kind === "mistake" ? "wrong" as const : "right" as const,
    x: marker.x,
    y: marker.y,
    label: marker.label,
  }));

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden border border-emerald-400/20 bg-[#050a08] px-5 py-5 md:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(16,185,129,0.13),transparent_45%),repeating-linear-gradient(90deg,transparent,transparent_47px,rgba(255,255,255,0.025)_48px)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/twins")} aria-label="Back to Tactical Twin library"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-400"><Sparkles className="h-3.5 w-3.5" />Tactical Twin · Stage 1</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">{draft.title}</h1>
              <p className="mt-2 text-sm text-white/40">{data.sourceTitle} · {formatClock(data.sourceStartSeconds)}–{formatClock(data.sourceEndSeconds)} · Coach-assisted reconstruction</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${draft.coachVerified ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>
              {draft.coachVerified ? "Coach verified" : `AI draft · ${draft.confidence}%`}
            </span>
            <Button variant="outline" className="gap-2 border-red-400/20 text-red-300 hover:bg-red-400/10" onClick={() => deleteMutation.mutate({ id })} disabled={deleteMutation.isPending}><Trash2 className="h-4 w-4" />Delete</Button>
            <Button className="gap-2 bg-emerald-400 text-black hover:bg-emerald-300" onClick={save} disabled={updateMutation.isPending}>{updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Twin</Button>
          </div>
        </div>
      </header>

      <section className="grid gap-px bg-white/10 lg:grid-cols-[1fr_auto_1fr]">
        <div className="bg-[#070b09] px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">Source evidence</p><p className="mt-1 truncate text-sm font-medium text-white">{data.sourceTitle}</p>
        </div>
        <div className="flex items-center justify-center gap-2 bg-[#070b09] px-5 py-3">
          <Button size="icon" variant="ghost" onClick={togglePlayback} aria-label={playing ? "Pause synchronized playback" : "Play synchronized reconstruction"}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
          <Button size="icon" variant="ghost" onClick={() => { filmHandleRef.current?.pause(); filmHandleRef.current?.seek(0); setPlaying(false); setProgress(0); }} aria-label="Restart synchronized reconstruction"><RotateCcw className="h-4 w-4" /></Button>
          <span className="font-mono text-xs text-emerald-300">{formatClock(data.sourceStartSeconds + progress * duration)}</span>
        </div>
        <div className="flex items-center gap-3 bg-[#070b09] px-4 py-3">
          <input className="h-1.5 flex-1 cursor-pointer accent-emerald-400" aria-label="Synchronized play timeline" type="range" min="0" max="1000" value={Math.round(progress * 1000)} onChange={(event) => { const next = Number(event.target.value) / 1000; filmHandleRef.current?.pause(); filmHandleRef.current?.seek(next); setPlaying(false); setProgress(next); }} />
          <span className="font-mono text-xs text-white/40">{Math.round(progress * 100)}%</span>
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          <div className="grid grid-cols-3 gap-px bg-white/10">
            {(["film", "map", "3d"] as const).map((item) => (
              <button key={item} onClick={() => { if (item === "film" && view !== "film" && playing) setPlaying(false); setView(item); }} className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${view === item ? "bg-emerald-400 text-black" : "bg-[#080d0a] text-white/45 hover:text-white"}`}>
                {item === "film" ? "Original Film" : item === "map" ? "Tactical Map" : "3D Twin"}
              </button>
            ))}
          </div>

          {view === "film" ? (
            <TwinFilmPane ref={filmHandleRef} sourceType={data.sourceType as TacticalTwinSourceType} youtubeVideoId={data.youtubeVideoId} videoUrl={videoUrl} startSeconds={data.sourceStartSeconds} endSeconds={data.sourceEndSeconds} progress={progress} playing={playing} onProgress={setProgress} />
          ) : null}
          {view === "map" ? (
            <TacticalTwinMap
              players={draft.players}
              ballPath={draft.ballPath}
              markers={draft.markers}
              progress={progress}
              selectedPlayerId={selectedPlayerId}
              tool={tool}
              onSelectPlayer={setSelectedPlayerId}
              onMovePlayer={(playerId, point) => updatePlayer(playerId, point)}
              onAddRoutePoint={(playerId, point) => updatePlayer(playerId, { route: [...(draft.players.find((item) => item.id === playerId)?.route ?? []), point] })}
              onAddBallPoint={(point) => setDraft((current) => current ? { ...current, coachVerified: false, ballPath: [...current.ballPath, point] } : current)}
              onAddMarker={(kind, point) => setDraft((current) => current ? { ...current, coachVerified: false, markers: [...current.markers, { id: `${kind}-${Date.now()}`, kind, label: kind === "mistake" ? "BREAKDOWN" : kind === "correction" ? "COACHING FIX" : "KEY READ", ...point }] } : current)}
            />
          ) : null}
          {view === "3d" ? (
            <Play3DVisualizer formation={draft.formation} playName={draft.title} playType={draft.playType} target={draft.target || undefined} defenseScheme={draft.defenseScheme} customPlayers={threePlayers} height={560} showBall externalProgress={progress} onProgressChange={setProgress} hideTransport annotations={threeAnnotations} />
          ) : null}

          <div className="grid gap-px bg-white/10 md:grid-cols-3">
            <div className="bg-[#080d0a] p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-white/30">Players mapped</p><p className="mt-1 font-mono text-2xl text-white">{draft.players.length}</p></div>
            <div className="bg-[#080d0a] p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-white/30">Route points</p><p className="mt-1 font-mono text-2xl text-white">{draft.players.reduce((sum, player) => sum + player.route.length, 0)}</p></div>
            <div className="bg-[#080d0a] p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-white/30">Coach markers</p><p className="mt-1 font-mono text-2xl text-white">{draft.markers.length}</p></div>
          </div>
        </main>

        <aside className="space-y-4">
          <section className="border border-white/10 bg-[#080d0a] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Editor tools</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {tools.map(({ id: toolId, label, icon: Icon }) => <button key={toolId} onClick={() => setTool(toolId)} className={`grid min-h-16 place-items-center border text-[10px] font-semibold uppercase tracking-[0.1em] ${tool === toolId ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/10 bg-black/20 text-white/45 hover:border-white/25 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}
            </div>
            <p className="mt-3 text-xs leading-5 text-white/35">Select and drag a player. Route/Ball/Marker tools add points wherever you click on the field.</p>
          </section>

          <section className="space-y-4 border border-white/10 bg-[#080d0a] p-4">
            <div><Label htmlFor="twin-title">Play title</Label><Input id="twin-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value, coachVerified: false })} className="mt-2" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="twin-formation">Formation</Label><Input id="twin-formation" value={draft.formation} onChange={(event) => setDraft({ ...draft, formation: event.target.value, coachVerified: false })} className="mt-2" /></div>
              <div><Label htmlFor="twin-defense">Defense</Label><Input id="twin-defense" value={draft.defenseScheme} onChange={(event) => setDraft({ ...draft, defenseScheme: event.target.value, coachVerified: false })} className="mt-2" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="twin-type">Play type</Label><select id="twin-type" value={draft.playType} onChange={(event) => setDraft({ ...draft, playType: event.target.value as TacticalTwinPlayType, coachVerified: false })} className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm">{playTypes.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></div>
              <div><Label htmlFor="twin-target">Primary target</Label><Input id="twin-target" value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value, coachVerified: false })} className="mt-2" placeholder="Y, Z, RB…" /></div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => {
              const players = buildDefaultTwinPlayers(draft.formation, draft.playType, draft.target);
              setDraft({ ...draft, players, ballPath: buildDefaultBallPath(players, draft.playType), markers: [], coachVerified: false });
              setSelectedPlayerId(players[0]?.id ?? null);
            }}><RotateCcw className="h-4 w-4" />Reset 22 from formation</Button>
          </section>

          {selectedPlayer ? (
            <section className="space-y-4 border border-amber-400/20 bg-amber-400/[0.04] p-4">
              <div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[0.18em] text-amber-200/60">Selected player</p><p className="mt-1 font-mono text-xl font-bold text-amber-200">{selectedPlayer.label}</p></div><Button size="icon" variant="ghost" aria-label="Delete selected player" onClick={() => { setDraft({ ...draft, players: draft.players.filter((item) => item.id !== selectedPlayer.id), coachVerified: false }); setSelectedPlayerId(null); }}><Trash2 className="h-4 w-4 text-red-300" /></Button></div>
              <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="player-label">Label</Label><Input id="player-label" value={selectedPlayer.label} onChange={(event) => updatePlayer(selectedPlayer.id, { label: event.target.value.slice(0, 16) })} className="mt-2" /></div><div><Label htmlFor="player-side">Unit</Label><select id="player-side" value={selectedPlayer.side} onChange={(event) => updatePlayer(selectedPlayer.id, { side: event.target.value as TacticalTwinPlayer["side"] })} className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm"><option value="offense">Offense</option><option value="defense">Defense</option></select></div></div>
              <div><Label htmlFor="route-type">Assignment</Label><select id="route-type" value={selectedPlayer.routeType} onChange={(event) => updatePlayer(selectedPlayer.id, { routeType: event.target.value as TacticalTwinPlayer["routeType"] })} className="mt-2 h-9 w-full border border-input bg-background px-3 text-sm"><option value="route">Route</option><option value="block">Block</option><option value="blitz">Blitz</option><option value="zone">Zone</option></select></div>
              <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="gap-2" onClick={() => updatePlayer(selectedPlayer.id, { route: selectedPlayer.route.slice(0, -1) })}><Undo2 className="h-4 w-4" />Undo point</Button><Button variant="outline" onClick={() => updatePlayer(selectedPlayer.id, { route: [] })}>Clear route</Button></div>
            </section>
          ) : (
            <Button variant="outline" className="w-full gap-2" onClick={() => {
              const idValue = `custom-${Date.now()}`;
              const next: TacticalTwinPlayer = { id: idValue, label: "ATH", side: "offense", x: 50, y: 60, routeType: "route", route: [] };
              setDraft({ ...draft, players: [...draft.players, next], coachVerified: false });
              setSelectedPlayerId(idValue);
            }}><Plus className="h-4 w-4" />Add player</Button>
          )}

          <section className="space-y-3 border border-white/10 bg-[#080d0a] p-4">
            <div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Paths & markers</p><span className="font-mono text-[10px] text-white/30">{draft.ballPath.length} ball · {draft.markers.length} marks</span></div>
            <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setDraft({ ...draft, ballPath: draft.ballPath.slice(0, -1), coachVerified: false })}>Undo ball</Button><Button variant="outline" onClick={() => setDraft({ ...draft, ballPath: [], coachVerified: false })}>Clear ball</Button></div>
            {draft.markers.length > 0 ? <div className="space-y-1">{draft.markers.map((marker) => <button key={marker.id} className="flex w-full items-center justify-between border border-white/8 px-3 py-2 text-left text-xs text-white/55 hover:border-red-400/30" onClick={() => setDraft({ ...draft, markers: draft.markers.filter((item) => item.id !== marker.id), coachVerified: false })}><span>{marker.label}</span><Trash2 className="h-3.5 w-3.5" /></button>)}</div> : null}
          </section>

          <section className="space-y-3 border border-white/10 bg-[#080d0a] p-4"><Label htmlFor="coach-notes">Coaching notes</Label><Textarea id="coach-notes" value={draft.coachingNotes} onChange={(event) => setDraft({ ...draft, coachingNotes: event.target.value, coachVerified: false })} rows={5} placeholder="Explain the read, breakdown, correction, or coaching point…" /><button onClick={() => setDraft({ ...draft, coachVerified: !draft.coachVerified })} className={`flex w-full items-center gap-3 border px-3 py-3 text-left ${draft.coachVerified ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10"}`}><ShieldCheck className={`h-5 w-5 ${draft.coachVerified ? "text-emerald-400" : "text-white/30"}`} /><span><span className="block text-sm font-semibold text-white">Coach verified</span><span className="mt-0.5 block text-[11px] text-white/35">Confirms the geometry was reviewed against film.</span></span></button></section>
        </aside>
      </div>
    </div>
  );
}

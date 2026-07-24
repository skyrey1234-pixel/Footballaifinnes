import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Youtube, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function NewSession() {
  const [, setLocation] = useLocation();
  const [opponentName, setOpponentName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [sourceType, setSourceType] = useState<"youtube" | "upload">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileKey, setUploadedFileKey] = useState("");
  const [uploadStats, setUploadStats] = useState<{ doneMB: number; totalMB: number; speedMBs: number } | null>(null);

  const analyzeMutation = trpc.sessions.analyze.useMutation();

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: (data) => {
      toast.success("Analysis started! AI is generating your scouting report.");
      // Kick off the awaited analysis request (keeps the serverless instance
      // alive for the full pipeline) but don't block navigation on it.
      analyzeMutation.mutate({ id: data.id });
      setLocation(`/session/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create session");
    },
  });

  const extractYoutubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 6GB hard cap — enough for 28+ min of 1080p60 game film
    if (file.size > 6 * 1024 * 1024 * 1024) {
      toast.error("Video is too large (max 6GB). Try trimming it or use a YouTube link instead.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      // The production infrastructure rejects request bodies over ~32MB,
      // so large files are sliced into chunks and reassembled server-side.
      const CHUNK_SIZE = 25 * 1024 * 1024; // 25MB — safely under the gate
      // Deterministic uploadId per file (name+size+mtime) so retrying the
      // same file resumes instead of restarting from chunk 0.
      const sig = `${file.name}|${file.size}|${file.lastModified}`;
      let hash = 0;
      for (let i = 0; i < sig.length; i++) hash = (Math.imul(hash, 31) + sig.charCodeAt(i)) | 0;
      const uploadId = `u${(hash >>> 0).toString(36)}x${file.size.toString(36)}`.slice(0, 40);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const totalMB = file.size / (1024 * 1024);

      // Progress bookkeeping across parallel chunks.
      const chunkDone: number[] = new Array(totalChunks).fill(0);
      const startedAt = Date.now();
      const reportProgress = () => {
        const done = chunkDone.reduce((a, b) => a + b, 0);
        const elapsed = (Date.now() - startedAt) / 1000;
        setUploadProgress(Math.min(99, Math.round((done / file.size) * 100)));
        setUploadStats({
          doneMB: done / (1024 * 1024),
          totalMB,
          speedMBs: elapsed > 1 ? done / (1024 * 1024) / elapsed : 0,
        });
      };

      const putChunk = (index: number, blob: Blob, attempt = 0): Promise<void> =>
        new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(
            "POST",
            `/api/upload/chunk?uploadId=${uploadId}&index=${index}`,
          );
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.timeout = 120000; // 2 min per 25MB chunk is generous
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              chunkDone[index] = evt.loaded;
              reportProgress();
            }
          };
          const retryOrFail = (err: Error) => {
            chunkDone[index] = 0;
            if (attempt < 5) {
              // exponential backoff (1.5s → 24s) rides out serverless cold starts
              setTimeout(() => {
                putChunk(index, blob, attempt + 1).then(resolve, reject);
              }, Math.min(24000, 1500 * 2 ** attempt));
            } else {
              reject(err);
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              chunkDone[index] = blob.size;
              reportProgress();
              resolve();
            }
            else retryOrFail(new Error(`Chunk ${index + 1}/${totalChunks} failed (${xhr.status})`));
          };
          xhr.onerror = () =>
            retryOrFail(new Error(`Network error on chunk ${index + 1}/${totalChunks}`));
          xhr.ontimeout = () =>
            retryOrFail(new Error(`Timeout on chunk ${index + 1}/${totalChunks}`));
          xhr.send(blob);
        });

      // Resume: skip chunks that already made it to storage on a prior attempt.
      let already = new Set<number>();
      if (totalChunks > 1) {
        try {
          const st = await fetch(
            `/api/upload/status?uploadId=${uploadId}&totalChunks=${totalChunks}`,
          );
          if (st.ok) {
            const { have } = (await st.json()) as { have: number[] };
            already = new Set(have);
            for (const i of have) {
              chunkDone[i] =
                Math.min((i + 1) * CHUNK_SIZE, file.size) - i * CHUNK_SIZE;
            }
            if (have.length > 0) {
              toast.info(`Resuming upload — ${have.length}/${totalChunks} chunks already saved`);
              reportProgress();
            }
          }
        } catch {
          /* resume check is best-effort */
        }
      }

      // Upload 4 chunks in parallel — much faster and less wall-clock time
      // exposed to serverless instance recycling.
      const pending = Array.from({ length: totalChunks }, (_, i) => i).filter(
        (i) => !already.has(i),
      );
      const PARALLEL = 4;
      let cursor = 0;
      const worker = async () => {
        for (;;) {
          const i = cursor++;
          if (i >= pending.length) return;
          const idx = pending[i];
          const blob = file.slice(
            idx * CHUNK_SIZE,
            Math.min((idx + 1) * CHUNK_SIZE, file.size),
          );
          await putChunk(idx, blob);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, pending.length) }, worker),
      );

      // Ask the server to stitch the chunks into the final video.
      const completeResp = await fetch(
        `/api/upload/complete?uploadId=${uploadId}` +
          `&totalChunks=${totalChunks}` +
          `&totalSize=${file.size}` +
          `&filename=${encodeURIComponent(file.name)}` +
          `&contentType=${encodeURIComponent(file.type || "video/mp4")}`,
        { method: "POST" },
      );
      if (!completeResp.ok) {
        const body = (await completeResp.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Failed to finalize upload (${completeResp.status})`);
      }
      const { fileKey } = (await completeResp.json()) as { fileKey: string };
      setUploadProgress(100);

      setUploadedFileKey(fileKey);
      toast.success("Video uploaded successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `${err.message} — select the same file again to resume where it left off.`
          : "Failed to upload video. Select the same file again to resume.",
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStats(null);
    }
  };

  const handleSubmit = () => {
    if (!opponentName.trim()) {
      toast.error("Please enter the opponent's name");
      return;
    }

    if (sourceType === "youtube") {
      const videoId = extractYoutubeId(youtubeUrl);
      if (!videoId) {
        toast.error("Please enter a valid YouTube URL or video ID");
        return;
      }
      createMutation.mutate({
        opponentName: opponentName.trim(),
        gameDate: gameDate || undefined,
        sourceType: "youtube",
        youtubeVideoId: videoId,
      });
    } else {
      if (!uploadedFileKey) {
        toast.error("Please upload a video file first");
        return;
      }
      createMutation.mutate({
        opponentName: opponentName.trim(),
        gameDate: gameDate || undefined,
        sourceType: "upload",
        videoFileKey: uploadedFileKey,
        videoUrl: `/manus-storage/${uploadedFileKey}`,
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Analysis</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Game Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="opponent">Opponent Name</Label>
            <Input
              id="opponent"
              placeholder="e.g. Riverside Eagles"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Game Date (optional)</Label>
            <Input
              id="date"
              type="date"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Footage Source</Label>
            <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as "youtube" | "upload")}>
              <TabsList className="w-full">
                <TabsTrigger value="youtube" className="flex-1 gap-2">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1 gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
              </TabsList>
              <TabsContent value="youtube" className="mt-3">
                <Input
                  placeholder="Paste YouTube URL or video ID..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Supports youtube.com/watch?v=... or youtu.be/... links
                </p>
              </TabsContent>
              <TabsContent value="upload" className="mt-3">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Uploading... {uploadProgress > 0 ? `${uploadProgress}%` : ""}
                      </p>
                      {uploadStats && (
                        <p className="text-xs text-muted-foreground font-mono">
                          {uploadStats.doneMB.toFixed(0)} / {uploadStats.totalMB.toFixed(0)} MB
                          {uploadStats.speedMBs > 0 && ` · ${uploadStats.speedMBs.toFixed(1)} MB/s`}
                        </p>
                      )}
                      <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${uploadProgress}%`, transition: "width 200ms cubic-bezier(0.23, 1, 0.32, 1)" }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 max-w-xs">
                        Big files upload in parallel chunks with auto-retry — keep this tab open.
                        If it fails, pick the same file again to resume.
                      </p>
                    </div>
                  ) : uploadedFileKey ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-sm text-primary font-medium">Video uploaded</p>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload game footage</p>
                      <p className="text-xs text-muted-foreground">MP4, MOV, or AVI — up to 6GB (full game films welcome)</p>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !opponentName.trim()}
            className="w-full"
            size="lg"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting Analysis...
              </>
            ) : (
              "Start AI Analysis"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

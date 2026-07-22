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
  const [uploadedFileKey, setUploadedFileKey] = useState("");

  const createMutation = trpc.sessions.create.useMutation({
    onSuccess: (data) => {
      toast.success("Breakdown started! AI is generating your fight report.");
      setLocation(`/session/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create breakdown");
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

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedFileKey(data.fileKey);
      toast.success("Video uploaded successfully!");
    } catch {
      toast.error("Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!opponentName.trim()) {
      toast.error("Please enter the fighter's name");
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
      <h1 className="text-2xl font-bold mb-6">New Breakdown</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fight Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="opponent">Fighter Name</Label>
            <Input
              id="opponent"
              placeholder="e.g. Ilia Topuria"
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Fight Date (optional)</Label>
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
                      <p className="text-sm text-muted-foreground">Uploading...</p>
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
                      <p className="text-sm text-muted-foreground">Click to upload fight footage</p>
                      <p className="text-xs text-muted-foreground">MP4, MOV, or AVI</p>
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
                Starting Breakdown...
              </>
            ) : (
              "Run AI Breakdown"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

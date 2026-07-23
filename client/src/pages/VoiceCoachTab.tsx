import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Volume2, Download } from "lucide-react";

interface VoiceCoachTabProps {
  sessionId: number;
}

export function VoiceCoachTab({ sessionId }: VoiceCoachTabProps) {
  const [voicePreset, setVoicePreset] = useState("broadcast");
  const [generatingFor, setGeneratingFor] = useState<"highlights" | "mistakes" | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);

  const handleGenerateVoice = async (type: "highlights" | "mistakes") => {
    setGeneratingFor(type);
    // Simulate voice generation
    setTimeout(() => {
      const mockScript = type === "highlights"
        ? "These are the top plays from the game. Watch how the offense executes in space, the defense makes key stops, and special teams contribute to the win. This is championship-level football."
        : "Let's break down the mistakes. On this play, the linebacker misses the gap assignment. Here, the receiver runs the wrong route. And here, poor tackling technique leads to a missed opportunity.";

      setScript(mockScript);
      setAudioUrl(`data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==`);
      setGeneratingFor(null);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Voice Coach</CardTitle>
          <CardDescription>
            Generate broadcast-style voiceover commentary for highlights and mistake breakdowns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Voice Preset Selection */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Voice Style</label>
            <Select value={voicePreset} onValueChange={setVoicePreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="broadcast">Broadcast Hype (Energetic)</SelectItem>
                <SelectItem value="coordinator">Calm Coordinator (Analytical)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generation Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleGenerateVoice("highlights")}
              disabled={generatingFor !== null}
              variant={generatingFor === "highlights" ? "secondary" : "default"}
              className="w-full"
            >
              {generatingFor === "highlights" ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Voice Highlight Reel
                </>
              )}
            </Button>
            <Button
              onClick={() => handleGenerateVoice("mistakes")}
              disabled={generatingFor !== null}
              variant={generatingFor === "mistakes" ? "secondary" : "default"}
              className="w-full"
            >
              {generatingFor === "mistakes" ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating...
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 h-4 w-4" />
                  Voice Mistake Analysis
                </>
              )}
            </Button>
          </div>

          {/* Audio Player & Script */}
          {audioUrl && script && (
            <Card className="bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge>Generated</Badge>
                  {voicePreset === "broadcast" ? "🎙️ Broadcast" : "📊 Coordinator"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Audio Player */}
                <div>
                  <label className="text-xs font-semibold mb-2 block">Audio</label>
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/wav" />
                    Your browser does not support the audio element.
                  </audio>
                </div>

                {/* Script */}
                <div>
                  <label className="text-xs font-semibold mb-2 block">Script</label>
                  <p className="text-sm text-slate-700 bg-white p-3 rounded border">{script}</p>
                </div>

                {/* Download Button */}
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download MP3
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card className="bg-slate-50">
            <CardContent className="pt-4">
              <p className="text-xs text-slate-600">
                💡 <strong>Tip:</strong> Use the broadcast voice for social media and recruiting. Use the coordinator voice for internal coaching breakdowns.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Clock, MessageSquare, Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";
import ReportCharts from "./ReportCharts";

type Highlight = {
  timestamp: string;
  seconds: number;
  title: string;
  note: string;
  category: string;
  verdict: string;
};

type ReportViewProps = {
  session: {
    id: number;
    opponentName: string;
    sourceType: string;
    youtubeVideoId?: string | null;
    videoUrl?: string | null;
  };
  report: {
    executiveSummary: string | null;
    offenseAnalysis: string | null;
    defenseAnalysis: string | null;
    specialSituations: string | null;
    mistakes: string | null;
    predictions: string | null;
    highlights: unknown;
  };
};

export default function ReportView({ session, report }: ReportViewProps) {
  const highlights = (report.highlights as Highlight[]) || [];
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    },
  });

  const handleSendChat = () => {
    if (!chatInput.trim() || chatMutation.isPending) return;
    const message = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: message }]);
    setChatInput("");
    chatMutation.mutate({
      sessionId: session.id,
      message,
      history: chatMessages,
    });
  };

  const sections = [
    { key: "executiveSummary", title: "Executive Summary", content: report.executiveSummary },
    { key: "offenseAnalysis", title: "Offense Analysis", content: report.offenseAnalysis },
    { key: "defenseAnalysis", title: "Defense Analysis", content: report.defenseAnalysis },
    { key: "specialSituations", title: "Special Situations", content: report.specialSituations },
    { key: "mistakes", title: "Mistakes & Weaknesses", content: report.mistakes },
    { key: "predictions", title: "Predictions & Strategy", content: report.predictions },
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "offense": return "border-blue-500/50 text-blue-400 bg-blue-500/10";
      case "defense": return "border-purple-500/50 text-purple-400 bg-purple-500/10";
      case "special": return "border-yellow-500/50 text-yellow-400 bg-yellow-500/10";
      case "mistake": return "border-red-500/50 text-red-400 bg-red-500/10";
      default: return "border-muted-foreground/50 text-muted-foreground";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      {/* Main Content */}
      <div className="space-y-6">
        {/* Video Player */}
        {session.sourceType === "youtube" && session.youtubeVideoId && (
          <Card className="overflow-hidden">
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${session.youtubeVideoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </Card>
        )}
        {session.sourceType === "upload" && session.videoUrl && (
          <Card className="overflow-hidden">
            <div className="aspect-video">
              <video src={session.videoUrl} controls className="w-full h-full object-cover" />
            </div>
          </Card>
        )}

        {/* Interactive Data Dashboard */}
        <ReportCharts highlights={highlights} />

        {/* Report Sections */}
        {sections.map(section => (
          section.content && (
            <Card key={section.key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
                  <Streamdown>{section.content}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )
        ))}

        {/* AI Chat */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Ask the Analyst
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {chatMessages.length > 0 && (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}>
                        {msg.role === "assistant" ? (
                          <Streamdown>{msg.content}</Streamdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {chatMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2.5">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Ask about formations, tendencies, key players..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              />
              <Button
                size="icon"
                onClick={handleSendChat}
                disabled={!chatInput.trim() || chatMutation.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Highlights Sidebar */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Key Moments ({highlights.length})
        </h3>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-3 pr-4">
            {highlights.map((highlight, i) => (
              <Card key={i} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getCategoryColor(highlight.category)}>
                      {highlight.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {highlight.timestamp}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{highlight.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{highlight.note}</p>
                  <Badge
                    variant="outline"
                    className={highlight.verdict === "good"
                      ? "border-green-500/50 text-green-400 bg-green-500/10"
                      : "border-red-500/50 text-red-400 bg-red-500/10"
                    }
                  >
                    {highlight.verdict === "good" ? "Good Play" : "Mistake"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

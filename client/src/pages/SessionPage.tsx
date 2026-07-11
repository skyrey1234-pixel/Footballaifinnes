import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useLocation, useParams } from "wouter";
import ReportView from "@/components/report/ReportView";
import FilmBreakdown from "@/components/film/FilmBreakdown";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  const { data: session, isLoading: sessionLoading } = trpc.sessions.get.useQuery(
    { id: sessionId },
    { enabled: sessionId > 0, refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "analyzing" ? 5000 : false;
    }}
  );

  const { data: report, isLoading: reportLoading } = trpc.reports.getBySession.useQuery(
    { sessionId },
    { enabled: sessionId > 0 && session?.status === "complete" }
  );

  if (sessionLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Session not found</p>
        <Button variant="outline" onClick={() => setLocation("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{session.opponentName}</h1>
          <p className="text-sm text-muted-foreground">
            {session.gameDate || "No date"} &middot; {session.sourceType === "youtube" ? "YouTube" : "Uploaded Video"}
          </p>
        </div>
      </div>

      {session.status === "analyzing" && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-4 p-6">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-400">AI Analysis in Progress</p>
              <p className="text-sm text-muted-foreground">
                Generating your scouting report... This usually takes 30-60 seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {session.status === "failed" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium text-destructive">Analysis Failed</p>
              <p className="text-sm text-muted-foreground">
                Something went wrong during the analysis. Please try again.
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {session.status === "complete" && report && (
        <Tabs defaultValue="report" className="w-full">
          <TabsList>
            <TabsTrigger value="report">Scouting Report</TabsTrigger>
            <TabsTrigger value="film" className="gap-2">
              AI Film Breakdown
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/50 text-primary">
                NEW
              </Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="report" className="mt-6">
            <ReportView session={session} report={report} />
          </TabsContent>
          <TabsContent value="film" className="mt-6">
            <FilmBreakdown session={session} report={report} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}


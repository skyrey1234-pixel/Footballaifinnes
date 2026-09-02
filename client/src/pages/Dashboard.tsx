import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Calendar, Crosshair, Radio, ChevronRight, Film } from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();
  const utils = trpc.useUtils();
  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => utils.sessions.list.invalidate(),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "analyzing":
        return <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 bg-yellow-500/10">analyzing</Badge>;
      case "complete":
        return <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">complete</Badge>;
      case "failed":
        return <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Game Sessions</h1>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] gap-6 overflow-hidden rounded-2xl mesh-bg">
        <div className="absolute inset-0 field-grid opacity-40 pointer-events-none" />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center glow-primary-sm anim-rise">
            <Crosshair className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold anim-rise-1">No Game Sessions Yet</h2>
          <p className="text-muted-foreground max-w-sm anim-rise-2">
            Start by creating your first analysis session. Upload game footage or paste a YouTube link to generate an AI scouting report.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setLocation("/new")} size="lg" className="gap-2 glow-primary-sm active:scale-[0.97] anim-rise-3">
            <PlusCircle className="h-5 w-5" />
            New Analysis
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Command-center hero header */}
      <div className="relative overflow-hidden rounded-2xl mesh-bg p-6 md:p-8 anim-rise">
        <div className="absolute inset-0 field-grid opacity-40 pointer-events-none" />
        <div className="absolute -top-24 left-1/3 h-48 w-96 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-tactical text-[10px] text-primary mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> FILM INTELLIGENCE COMMAND
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              Game <span className="text-primary text-glow">Sessions</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {sessions.length} opponent{sessions.length === 1 ? "" : "s"} broken down · every session unlocks a full War Room
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setLocation("/new")} className="gap-2 glow-primary-sm active:scale-[0.97]">
              <PlusCircle className="h-4 w-4" />
              New Analysis
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {sessions.map((session, idx) => (
          <Card
            key={session.id}
            className={`glass hover:border-primary/40 transition-all cursor-pointer group anim-rise-${Math.min(idx + 1, 5)} hover:translate-x-1`}
            onClick={() => setLocation(`/session/${session.id}`)}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:glow-primary-sm transition-shadow">
                  <Crosshair className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold group-hover:text-primary transition-colors">
                    {session.opponentName}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    {session.gameDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {session.gameDate}
                      </span>
                    )}
                    <span className="capitalize flex items-center gap-1"><Film className="h-3 w-3" />{session.sourceType}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {session.status === "complete" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 font-tactical text-[10px] border-primary/30 text-primary hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity active:scale-[0.97]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/warroom/${session.id}`);
                    }}
                  >
                    <Radio className="h-3 w-3" /> WAR ROOM
                  </Button>
                )}
                {getStatusBadge(session.status)}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this session and its report?")) {
                        deleteMutation.mutate({ id: session.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

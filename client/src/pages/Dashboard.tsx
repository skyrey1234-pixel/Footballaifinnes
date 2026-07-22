import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Trash2, Calendar, Swords } from "lucide-react";
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
          <h1 className="text-2xl font-bold">Fight Breakdowns</h1>
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Swords className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">No Fight Breakdowns Yet</h2>
          <p className="text-muted-foreground max-w-sm">
            Start by breaking down your first fight. Upload fight footage or paste a YouTube link to generate an AI fight report.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setLocation("/new")} size="lg" className="gap-2">
            <PlusCircle className="h-5 w-5" />
            New Breakdown
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fight Breakdowns</h1>
        {isAdmin && (
          <Button onClick={() => setLocation("/new")} size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            New Breakdown
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {sessions.map(session => (
          <Card
            key={session.id}
            className="hover:border-primary/30 transition-colors cursor-pointer group"
            onClick={() => setLocation(`/session/${session.id}`)}
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Swords className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium group-hover:text-primary transition-colors">
                    {session.opponentName}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    {session.gameDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {session.gameDate}
                      </span>
                    )}
                    <span className="capitalize">{session.sourceType}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

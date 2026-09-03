import { useLocation, useParams } from "wouter";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalyticsPanel } from "@/components/analytics/AnalyticsPanel";

export default function AnalyticsPage() {
  const params = useParams<{ id: string }>();
  const sessionId = Number(params.id);
  const [, setLocation] = useLocation();
  if (!Number.isFinite(sessionId) || sessionId <= 0) return <div className="p-8 text-white/50">Invalid analytics session.</div>;
  return (
    <div className="min-h-screen bg-[#050806] p-4 md:p-7">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-5 flex items-center justify-between border-b border-white/8 pb-4">
          <Button variant="ghost" className="text-white/55 hover:text-white" onClick={() => setLocation(`/session/${sessionId}`)}><ArrowLeft className="mr-2 h-4 w-4" />Back to film room</Button>
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-300"><ShieldCheck className="h-4 w-4" />Evidence-audited workspace</p>
        </div>
        <AnalyticsPanel sessionId={sessionId} />
      </div>
    </div>
  );
}

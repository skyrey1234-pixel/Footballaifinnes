import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { runAnalysis } from '@/lib/analysis';
import VideoPlayer from '@/components/report/VideoPlayer';
import ReportSection from '@/components/report/ReportSection';
import HighlightCard from '@/components/report/HighlightCard';
import ReportChat from '@/components/report/ReportChat';
import { format } from 'date-fns';
import { ArrowLeft, Swords, Shield, Timer, AlertTriangle, TrendingUp, Sparkles, RefreshCw, Film } from 'lucide-react';

const sections = [
  { key: 'executive_summary', title: 'Executive Summary', icon: Sparkles, accent: { bg: 'bg-[#00FF87]/10', text: 'text-[#00FF87]' } },
  { key: 'offense_analysis', title: 'Their Offense', icon: Swords, accent: { bg: 'bg-blue-500/10', text: 'text-blue-400' } },
  { key: 'defense_analysis', title: 'Their Defense', icon: Shield, accent: { bg: 'bg-red-500/10', text: 'text-red-400' } },
  { key: 'special_situations', title: 'Special Situations', icon: Timer, accent: { bg: 'bg-amber-400/10', text: 'text-amber-400' } },
  { key: 'mistakes', title: 'Mistakes & Missed Opportunities', icon: AlertTriangle, accent: { bg: 'bg-purple-500/10', text: 'text-purple-400' } },
  { key: 'predictions', title: 'What To Expect Next', icon: TrendingUp, accent: { bg: 'bg-[#00FF87]/10', text: 'text-[#00FF87]' } },
];

export default function Session() {
  const id = new URLSearchParams(window.location.search).get('id');
  const [session, setSession] = useState(null);
  const [report, setReport] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [seek, setSeek] = useState(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const s = await base44.entities.GameSession.get(id);
    setSession(s);
    const reports = await base44.entities.ScoutingReport.filter({ session_id: id });
    if (reports.length > 0) {
      setReport(reports[0]);
      return;
    }
    if (s.status !== 'failed') await analyze(s);
  }

  async function analyze(s) {
    setAnalyzing(true);
    try {
      const r = await runAnalysis(s);
      setReport(r);
      setSession({ ...s, status: 'complete' });
    } catch {
      await base44.entities.GameSession.update(s.id, { status: 'failed' });
      setSession({ ...s, status: 'failed' });
    }
    setAnalyzing(false);
  }

  if (!session) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-7 h-7 border-2 border-white/10 border-t-[#00FF87] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> All sessions
      </Link>

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#00FF87] mb-1">Scouting Report</p>
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-white tracking-tight">vs {session.opponent_name}</h1>
        {session.game_date && <p className="text-sm text-slate-500 mt-1">{format(new Date(session.game_date), 'MMMM d, yyyy')}</p>}
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          <VideoPlayer session={session} seek={seek} />

          {analyzing && (
            <div className="bg-[#161B22] border border-white/5 rounded-xl p-10 text-center">
              <div className="w-10 h-10 border-2 border-white/10 border-t-[#00FF87] rounded-full animate-spin mx-auto mb-4" />
              <h2 className="font-heading font-semibold text-white">Breaking down the film...</h2>
              <p className="text-sm text-slate-500 mt-1.5">The AI is watching the footage and building your full scouting report. This can take a minute or two.</p>
            </div>
          )}

          {!analyzing && session.status === 'failed' && !report && (
            <div className="bg-[#161B22] border border-red-500/20 rounded-xl p-10 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <h2 className="font-heading font-semibold text-white">Analysis failed</h2>
              <p className="text-sm text-slate-500 mt-1.5 mb-5">Something went wrong while breaking down the footage.</p>
              <button
                onClick={() => analyze(session)}
                className="inline-flex items-center gap-2 bg-[#00FF87] text-[#0D1117] font-heading font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#00FF87]/90 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Retry Analysis
              </button>
            </div>
          )}

          {report && sections.map((s) => (
            <ReportSection key={s.key} title={s.title} icon={s.icon} accent={s.accent} content={report[s.key]} />
          ))}
        </div>

        <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-6">
          {report?.highlights?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Film className="w-4 h-4 text-[#00FF87]" />
                <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-white">Key Moments</h2>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {report.highlights.map((h, i) => (
                  <HighlightCard key={i} highlight={h} onJump={(seconds) => setSeek({ seconds, key: Date.now() })} />
                ))}
              </div>
            </div>
          )}
          {report && <ReportChat session={session} report={report} />}
        </div>
      </div>
    </div>
  );
}
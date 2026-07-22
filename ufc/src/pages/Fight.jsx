import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { runAnalysis } from '@/lib/analysis';
import VideoPlayer from '@/components/report/VideoPlayer';
import ReportSection from '@/components/report/ReportSection';
import HighlightCard from '@/components/report/HighlightCard';
import ReportChat from '@/components/report/ReportChat';
import FilmBreakdown from '@/components/film/FilmBreakdown';
import { format } from 'date-fns';
import {
  ArrowLeft, Swords, Grab, Fingerprint, AlertTriangle,
  TrendingUp, Sparkles, RefreshCw, Film, FileText
} from 'lucide-react';

const sections = [
  { key: 'executive_summary', title: 'Executive Summary',       icon: Sparkles,      accent: { bg: 'bg-[#FF2D2D]/10', text: 'text-[#FF2D2D]' } },
  { key: 'striking_analysis', title: 'Striking',                icon: Swords,        accent: { bg: 'bg-orange-500/10', text: 'text-orange-400' } },
  { key: 'grappling_analysis', title: 'Grappling',              icon: Grab,          accent: { bg: 'bg-blue-500/10',  text: 'text-blue-400'  } },
  { key: 'clinch_and_cage',   title: 'Clinch & Cage Control',   icon: Fingerprint,   accent: { bg: 'bg-amber-400/10', text: 'text-amber-400' } },
  { key: 'vulnerabilities',   title: 'Vulnerabilities',         icon: AlertTriangle, accent: { bg: 'bg-purple-500/10', text: 'text-purple-400' } },
  { key: 'game_plan',         title: 'Game Plan To Beat Them',  icon: TrendingUp,    accent: { bg: 'bg-[#FF2D2D]/10', text: 'text-[#FF2D2D]' } },
];

const TABS = [
  { id: 'report', label: 'Fight Report', icon: FileText },
  { id: 'film',   label: 'AI Film Breakdown', icon: Film },
];

export default function Fight() {
  const id = new URLSearchParams(window.location.search).get('id');
  const [session, setSession]   = useState(null);
  const [report, setReport]     = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [seek, setSeek]         = useState(null);
  const [activeTab, setActiveTab] = useState('report');

  useEffect(() => { load(); }, [id]);

  async function load() {
    const s = await base44.entities.FightSession.get(id);
    setSession(s);
    const reports = await base44.entities.FightReport.filter({ session_id: id });
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
      await base44.entities.FightSession.update(s.id, { status: 'failed' });
      setSession({ ...s, status: 'failed' });
    }
    setAnalyzing(false);
  }

  if (!session) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-7 h-7 border-2 border-white/10 border-t-[#FF2D2D] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> All breakdowns
      </Link>

      {/* Page Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#FF2D2D] mb-1">Fight Report</p>
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-white tracking-tight">
          {session.fighter_name}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {[session.division, session.fight_date && format(new Date(session.fight_date), 'MMMM d, yyyy')].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* Tab Switcher */}
      {report && (
        <div className="flex items-center gap-1 mb-8 bg-[#161B22] border border-white/5 rounded-xl p-1 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#FF2D2D] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'film' && isActive && (
                  <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">NEW</span>
                )}
                {tab.id === 'film' && !isActive && (
                  <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">NEW</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── FIGHT REPORT TAB ── */}
      {activeTab === 'report' && (
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          {/* Left: Video + Report Sections */}
          <div className="lg:col-span-3 space-y-6">
            <VideoPlayer session={session} seek={seek} />

            {analyzing && (
              <div className="bg-[#161B22] border border-white/5 rounded-xl p-10 text-center">
                <div className="w-10 h-10 border-2 border-white/10 border-t-[#FF2D2D] rounded-full animate-spin mx-auto mb-4" />
                <h2 className="font-heading font-semibold text-white">Breaking down the tape...</h2>
                <p className="text-sm text-slate-500 mt-1.5">
                  The AI is watching the footage and building your full fight report. This can take a minute or two.
                </p>
              </div>
            )}

            {!analyzing && session.status === 'failed' && !report && (
              <div className="bg-[#161B22] border border-red-500/20 rounded-xl p-10 text-center">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <h2 className="font-heading font-semibold text-white">Analysis failed</h2>
                <p className="text-sm text-slate-500 mt-1.5 mb-5">
                  Something went wrong while breaking down the footage.
                </p>
                <button
                  onClick={() => analyze(session)}
                  className="inline-flex items-center gap-2 bg-[#FF2D2D] text-white font-heading font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#FF2D2D]/90 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Analysis
                </button>
              </div>
            )}

            {report && sections.map((s) => (
              <ReportSection key={s.key} title={s.title} icon={s.icon} accent={s.accent} content={report[s.key]} />
            ))}
          </div>

          {/* Right: Key Moments + Chat */}
          <div className="lg:col-span-2 space-y-6 lg:sticky lg:top-6">
            {report?.highlights?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-[#FF2D2D]" />
                  <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-white">Key Moments</h2>
                </div>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {report.highlights.map((h, i) => (
                    <HighlightCard
                      key={i}
                      highlight={h}
                      session={session}
                      onJump={(seconds) => setSeek({ seconds, key: Date.now() })}
                    />
                  ))}
                </div>
              </div>
            )}
            {report && <ReportChat session={session} report={report} />}
          </div>
        </div>
      )}

      {/* ── AI FILM BREAKDOWN TAB ── */}
      {activeTab === 'film' && report && (
        <FilmBreakdown session={session} report={report} />
      )}
    </div>
  );
}

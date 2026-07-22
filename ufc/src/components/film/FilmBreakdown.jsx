import { useState } from 'react';
import { Film, AlertTriangle, CheckCircle2, Swords, Grab, Fingerprint, Filter } from 'lucide-react';
import AnnotatedHighlightCard from './AnnotatedHighlightCard';

const FILTERS = [
  { id: 'all', label: 'All Exchanges', icon: Film },
  { id: 'mistake', label: 'Got Caught', icon: AlertTriangle },
  { id: 'good', label: 'Clean', icon: CheckCircle2 },
  { id: 'striking', label: 'Striking', icon: Swords },
  { id: 'grappling', label: 'Grappling', icon: Grab },
  { id: 'clinch', label: 'Clinch', icon: Fingerprint },
];

export default function FilmBreakdown({ session, report }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const highlights = report?.highlights || [];

  const filteredHighlights = highlights.filter((h) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'mistake') return h.verdict === 'bad' || h.category === 'mistake';
    if (activeFilter === 'good') return h.verdict === 'good';
    return h.category === activeFilter;
  });

  // Stats
  const mistakeCount = highlights.filter((h) => h.verdict === 'bad' || h.category === 'mistake').length;
  const goodCount = highlights.filter((h) => h.verdict === 'good').length;
  const strikingCount = highlights.filter((h) => h.category === 'striking').length;
  const grapplingCount = highlights.filter((h) => h.category === 'grappling').length;

  if (!highlights.length) {
    return (
      <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
        <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No key moments available for film breakdown.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Film className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="font-heading font-bold text-white text-lg">AI Film Breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any exchange to watch with AI circles, arrows, and coaching overlays
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Exchanges', value: highlights.length, color: 'text-white', bg: 'bg-white/5' },
          { label: 'Got Caught', value: mistakeCount, color: 'text-red-400', bg: 'bg-red-500/5' },
          { label: 'Clean', value: goodCount, color: 'text-[#FF2D2D]', bg: 'bg-[#FF2D2D]/5' },
          { label: 'Striking', value: strikingCount, color: 'text-orange-400', bg: 'bg-orange-500/5' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} border border-white/5 rounded-xl px-4 py-3`}>
            <p className={`font-heading font-bold text-2xl ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        {FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                isActive
                  ? 'bg-[#FF2D2D]/10 text-[#FF2D2D] border-[#FF2D2D]/30'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <Icon className="w-3 h-3" />
              {f.label}
              {f.id !== 'all' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#FF2D2D]/20' : 'bg-white/10'}`}>
                  {f.id === 'mistake' ? mistakeCount :
                   f.id === 'good' ? goodCount :
                   f.id === 'striking' ? strikingCount :
                   f.id === 'grappling' ? grapplingCount :
                   highlights.filter(h => h.category === f.id).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Highlight Cards */}
      {filteredHighlights.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
          <p className="text-sm text-slate-500">No exchanges match this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHighlights.map((highlight, i) => (
            <AnnotatedHighlightCard
              key={`${highlight.timestamp}-${i}`}
              highlight={highlight}
              session={session}
              report={report}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Footer tip */}
      <div className="flex items-start gap-3 px-4 py-3 bg-purple-500/5 border border-purple-500/15 rounded-xl">
        <Swords className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-purple-400 font-semibold">Pro tip:</span> Click "Watch with AI Annotations" on any exchange to see circles, arrows, and coaching overlays drawn directly on the tape. Red = got caught, Green = clean technique, Blue = suggested counter.
        </p>
      </div>
    </div>
  );
}

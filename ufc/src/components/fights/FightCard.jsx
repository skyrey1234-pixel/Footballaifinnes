import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Youtube, FileVideo, Trash2, ChevronRight, Loader2 } from 'lucide-react';

const statusStyles = {
  analyzing: 'bg-amber-400/10 text-amber-400',
  complete: 'bg-[#FF2D2D]/10 text-[#FF2D2D]',
  failed: 'bg-red-500/10 text-red-400',
};

export default function FightCard({ session, canDelete, onDelete }) {
  const SourceIcon = session.source_type === 'youtube' ? Youtube : FileVideo;
  const subtitle = [session.division, session.fight_date && format(new Date(session.fight_date), 'MMM d, yyyy')]
    .filter(Boolean).join(' · ') || 'No details set';
  return (
    <Link
      to={`/fight?id=${session.id}`}
      className="group flex items-center gap-4 bg-[#161B22] border border-white/5 rounded-xl p-5 hover:border-[#FF2D2D]/30 transition-colors"
    >
      <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <SourceIcon className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-white truncate">{session.fighter_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusStyles[session.status] || statusStyles.analyzing}`}>
        {session.status === 'analyzing' && <Loader2 className="w-3 h-3 animate-spin" />}
        {session.status}
      </span>
      {canDelete && (
        <button
          onClick={(e) => { e.preventDefault(); onDelete(session); }}
          className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#FF2D2D] transition-colors" />
    </Link>
  );
}

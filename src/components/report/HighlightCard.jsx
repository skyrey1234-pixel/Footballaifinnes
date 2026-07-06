import { Play } from 'lucide-react';

const categoryStyles = {
  offense: 'bg-blue-500/10 text-blue-400',
  defense: 'bg-red-500/10 text-red-400',
  special: 'bg-amber-400/10 text-amber-400',
  mistake: 'bg-purple-500/10 text-purple-400',
};

export default function HighlightCard({ highlight, onJump }) {
  return (
    <button
      onClick={() => onJump(highlight.seconds ?? 0)}
      className="group text-left bg-[#161B22] border border-white/5 rounded-xl p-4 hover:border-[#00FF87]/30 transition-colors w-full"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#00FF87] bg-[#00FF87]/10 px-2 py-1 rounded-md group-hover:bg-[#00FF87]/20 transition-colors">
          <Play className="w-3 h-3" />
          {highlight.timestamp}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${categoryStyles[highlight.category] || categoryStyles.offense}`}>
          {highlight.category}
        </span>
      </div>
      <p className="font-heading font-semibold text-sm text-white">{highlight.title}</p>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{highlight.note}</p>
    </button>
  );
}
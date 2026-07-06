import { useState } from 'react';
import { Play, Video, CheckCircle2, XCircle, ChevronUp } from 'lucide-react';

const categoryStyles = {
  offense: 'bg-blue-500/10 text-blue-400',
  defense: 'bg-red-500/10 text-red-400',
  special: 'bg-amber-400/10 text-amber-400',
  mistake: 'bg-purple-500/10 text-purple-400',
};

const verdictStyles = {
  good: { border: 'border-l-[#00FF87]', text: 'text-[#00FF87]', icon: CheckCircle2, label: 'Went well' },
  bad: { border: 'border-l-red-500', text: 'text-red-400', icon: XCircle, label: 'Went wrong' },
};

export default function HighlightCard({ highlight, session, onJump }) {
  const [showClip, setShowClip] = useState(false);
  const seconds = Math.floor(highlight.seconds ?? 0);
  const verdict = verdictStyles[highlight.verdict || (highlight.category === 'mistake' ? 'bad' : '')];
  const VerdictIcon = verdict?.icon;

  return (
    <div className={`bg-[#161B22] border border-white/5 rounded-xl p-4 ${verdict ? `border-l-2 ${verdict.border}` : ''}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <button
          onClick={() => onJump(seconds)}
          className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#00FF87] bg-[#00FF87]/10 px-2 py-1 rounded-md hover:bg-[#00FF87]/20 transition-colors"
        >
          <Play className="w-3 h-3" />
          {highlight.timestamp}
        </button>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${categoryStyles[highlight.category] || categoryStyles.offense}`}>
          {highlight.category}
        </span>
        {verdict && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${verdict.text}`}>
            <VerdictIcon className="w-3.5 h-3.5" />
            {verdict.label}
          </span>
        )}
      </div>
      <p className="font-heading font-semibold text-sm text-white">{highlight.title}</p>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{highlight.note}</p>

      <button
        onClick={() => setShowClip(!showClip)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-[#00FF87] transition-colors"
      >
        {showClip ? <ChevronUp className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
        {showClip ? 'Hide clip' : 'Watch this play'}
      </button>

      {showClip && (
        <div className="mt-3 aspect-video rounded-lg overflow-hidden bg-black border border-white/10">
          {session.source_type === 'youtube' ? (
            <iframe
              src={`https://www.youtube.com/embed/${session.youtube_video_id}?start=${seconds}&autoplay=1`}
              title={highlight.title}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={session.video_url}
              controls
              autoPlay
              className="w-full h-full"
              onLoadedMetadata={(e) => { e.target.currentTime = seconds; }}
            />
          )}
        </div>
      )}
    </div>
  );
}
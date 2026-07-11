import { useState, useRef } from 'react';
import { Play, Pause, Eye, EyeOff, Loader2, Sparkles, AlertTriangle, CheckCircle2, Zap, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import AnnotationCanvas from './AnnotationCanvas';
import { generateHighlightAnnotations } from '@/lib/filmAnnotation';

const CATEGORY_STYLES = {
  offense: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  defense: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  special: { bg: 'bg-amber-400/10', text: 'text-amber-400', border: 'border-amber-400/30' },
  mistake: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
};

const VERDICT_STYLES = {
  bad: {
    border: 'border-l-red-500',
    badge: 'bg-red-500/10 text-red-400',
    icon: AlertTriangle,
    label: 'Mistake',
    headerBg: 'from-red-500/10 to-transparent',
  },
  good: {
    border: 'border-l-[#00FF87]',
    badge: 'bg-[#00FF87]/10 text-[#00FF87]',
    icon: CheckCircle2,
    label: 'Good Play',
    headerBg: 'from-[#00FF87]/10 to-transparent',
  },
};

export default function AnnotatedHighlightCard({ highlight, session, report, index }) {
  const [showClip, setShowClip] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [annotationData, setAnnotationData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [showAlternative, setShowAlternative] = useState(false);
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const seconds = Math.floor(highlight.seconds ?? 0);
  const verdict = VERDICT_STYLES[highlight.verdict] || VERDICT_STYLES.bad;
  const VerdictIcon = verdict.icon;
  const catStyle = CATEGORY_STYLES[highlight.category] || CATEGORY_STYLES.offense;

  const handleWatchPlay = async () => {
    setShowClip(true);
    if (!annotationData && !isGenerating) {
      setIsGenerating(true);
      setGenError(null);
      try {
        const reportContext = `${report?.executive_summary?.slice(0, 200) || ''}`;
        const data = await generateHighlightAnnotations(highlight, session, reportContext);
        setAnnotationData(data);
      } catch (err) {
        setGenError('Could not generate annotations. Showing clip without overlay.');
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    setAnnotationData(null);
    try {
      const reportContext = `${report?.executive_summary?.slice(0, 200) || ''}`;
      const data = await generateHighlightAnnotations(highlight, session, reportContext);
      setAnnotationData(data);
    } catch (err) {
      setGenError('Regeneration failed. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`bg-[#161B22] border border-white/5 rounded-2xl overflow-hidden border-l-2 ${verdict.border} transition-all duration-200`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${verdict.headerBg} px-5 pt-4 pb-3`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {/* Timestamp badge */}
          <button
            onClick={handleWatchPlay}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#00FF87] bg-[#00FF87]/10 px-2.5 py-1 rounded-md hover:bg-[#00FF87]/20 transition-colors border border-[#00FF87]/20"
          >
            <Play className="w-3 h-3" />
            {highlight.timestamp}
          </button>

          {/* Category */}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
            {highlight.category}
          </span>

          {/* Verdict */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${verdict.badge}`}>
            <VerdictIcon className="w-3 h-3" />
            {verdict.label}
          </span>

          {/* AI Annotated badge — shown after annotations load */}
          {annotationData && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-3 h-3" />
              AI Annotated
            </span>
          )}
        </div>

        <h3 className="font-heading font-bold text-sm text-white leading-snug">{highlight.title}</h3>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{highlight.note}</p>
      </div>

      {/* Watch Play Button */}
      {!showClip && (
        <div className="px-5 pb-4 pt-2">
          <button
            onClick={handleWatchPlay}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-[#00FF87] transition-colors bg-white/5 hover:bg-[#00FF87]/10 px-3 py-2 rounded-lg border border-white/10 hover:border-[#00FF87]/30"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Watch with AI Annotations
          </button>
        </div>
      )}

      {/* Film Viewer */}
      {showClip && (
        <div className="px-5 pb-5">
          {/* Video + Annotation Overlay Container */}
          <div ref={containerRef} className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video">
            {/* The actual video */}
            {session.source_type === 'youtube' ? (
              <iframe
                key={`yt-${seconds}`}
                src={`https://www.youtube.com/embed/${session.youtube_video_id}?start=${seconds}&autoplay=1&rel=0&modestbranding=1`}
                title={highlight.title}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={session.video_url}
                controls
                autoPlay
                className="w-full h-full"
                onLoadedMetadata={(e) => { e.target.currentTime = seconds; }}
              />
            )}

            {/* Annotation SVG Overlay */}
            {showAnnotations && annotationData?.annotations && (
              <AnnotationCanvas
                annotations={annotationData.annotations}
                width={640}
                height={360}
                animated={true}
              />
            )}

            {/* Coaching Callout Banner */}
            {showAnnotations && annotationData?.coaching_callout && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 py-3 pointer-events-none">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                  annotationData.verdict === 'mistake'
                    ? 'bg-red-500/20 border border-red-500/40'
                    : annotationData.verdict === 'good_play'
                    ? 'bg-[#00FF87]/20 border border-[#00FF87]/40'
                    : 'bg-yellow-500/20 border border-yellow-500/40'
                }`}>
                  <Zap className={`w-3.5 h-3.5 shrink-0 ${
                    annotationData.verdict === 'mistake' ? 'text-red-400' :
                    annotationData.verdict === 'good_play' ? 'text-[#00FF87]' : 'text-yellow-400'
                  }`} />
                  <p className="text-xs font-bold text-white leading-tight">
                    {annotationData.coaching_callout}
                  </p>
                </div>
              </div>
            )}

            {/* Generating spinner overlay */}
            {isGenerating && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <div className="w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
                <p className="text-xs font-semibold text-purple-300">AI is drawing annotations...</p>
              </div>
            )}
          </div>

          {/* Annotation Controls */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {annotationData && (
              <button
                onClick={() => setShowAnnotations(!showAnnotations)}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  showAnnotations
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {showAnnotations ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showAnnotations ? 'Hide Overlays' : 'Show Overlays'}
              </button>
            )}

            {annotationData && (
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white/5 text-slate-400 border-white/10 hover:text-[#00FF87] hover:border-[#00FF87]/30 transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            )}

            {genError && (
              <p className="text-xs text-red-400">{genError}</p>
            )}
          </div>

          {/* Alternative Play Panel */}
          {annotationData?.alternative_play && (
            <div className="mt-3">
              <button
                onClick={() => setShowAlternative(!showAlternative)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl hover:bg-blue-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    {highlight.verdict === 'bad' ? 'What They Should Have Done' : 'Why This Play Worked'}
                  </span>
                </div>
                {showAlternative
                  ? <ChevronUp className="w-4 h-4 text-slate-500" />
                  : <ChevronDown className="w-4 h-4 text-slate-500" />
                }
              </button>

              {showAlternative && (
                <div className="mt-2 px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-xl border-t-0 rounded-t-none">
                  <p className="text-sm text-slate-300 leading-relaxed italic">
                    "{annotationData.alternative_play}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

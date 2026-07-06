import ReactMarkdown from 'react-markdown';

export default function ReportSection({ title, icon: Icon, accent, content }) {
  if (!content) return null;
  return (
    <section className="bg-[#161B22] border border-white/5 rounded-xl p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent.bg}`}>
          <Icon className={`w-4 h-4 ${accent.text}`} />
        </div>
        <h2 className={`font-heading font-bold text-base uppercase tracking-wide ${accent.text}`}>{title}</h2>
      </div>
      <ReactMarkdown className="prose prose-invert prose-sm max-w-none prose-headings:font-heading prose-strong:text-white prose-li:marker:text-slate-600 text-slate-300">
        {content}
      </ReactMarkdown>
    </section>
  );
}
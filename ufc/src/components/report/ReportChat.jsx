import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, MessageSquare } from 'lucide-react';

export default function ReportChat({ session, report }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setInput('');
    setLoading(true);
    const answer = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an elite MMA head coach assistant. Answer the corner's question using ONLY this fight report on "${session.fighter_name}".

FIGHT REPORT:
Summary: ${report.executive_summary}
Striking: ${report.striking_analysis}
Grappling: ${report.grappling_analysis}
Clinch & cage: ${report.clinch_and_cage}
Vulnerabilities: ${report.vulnerabilities}
Game plan: ${report.game_plan}

CONVERSATION SO FAR:
${next.map((m) => `${m.role === 'user' ? 'Corner' : 'Analyst'}: ${m.content}`).join('\n')}

Answer the last question in sharp, practical coach-speak. Use markdown. Keep it concise.`,
    });
    setMessages((m) => [...m, { role: 'assistant', content: answer }]);
    setLoading(false);
  };

  return (
    <div className="bg-[#161B22] border border-white/5 rounded-xl flex flex-col h-[480px]">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
        <MessageSquare className="w-4 h-4 text-[#FF2D2D]" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wide text-white">Ask the Analyst</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Ask anything about this fighter — e.g. "How do I nullify their takedowns?" or "What's their go-to combination off the jab?"
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            {m.role === 'user' ? (
              <p className="bg-[#FF2D2D]/10 text-[#FF2D2D] text-sm px-4 py-2.5 rounded-xl rounded-br-sm max-w-[85%]">{m.content}</p>
            ) : (
              <div className="bg-white/5 text-slate-200 text-sm px-4 py-2.5 rounded-xl rounded-bl-sm max-w-[85%]">
                <ReactMarkdown className="prose prose-invert prose-sm max-w-none">{m.content}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-[#FF2D2D]" />}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 p-3 border-t border-white/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about this fighter..."
          className="flex-1 bg-[#0D1117] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#FF2D2D]/50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-lg bg-[#FF2D2D] text-white disabled:opacity-40 hover:bg-[#FF2D2D]/90 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

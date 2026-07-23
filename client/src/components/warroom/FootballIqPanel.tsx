import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, CheckCircle2, XCircle, Trophy, RotateCcw } from "lucide-react";

export default function FootballIqPanel({ sessionId }: { sessionId: number }) {
  const mutation = trpc.warRoom.quiz.useMutation();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const start = () => {
    setCurrent(0);
    setAnswers({});
    setRevealed({});
    mutation.mutate({ sessionId });
  };

  const questions = mutation.data?.questions || [];
  const q = questions[current];
  const answered = Object.keys(revealed).length;
  const correct = questions.reduce((acc, qq, i) => acc + (revealed[i] && answers[i] === qq.correctIndex ? 1 : 0), 0);
  const done = questions.length > 0 && answered === questions.length;

  if (!mutation.data && !mutation.isPending) {
    return (
      <div className="glass-bright rounded-2xl p-16 text-center anim-rise relative overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-30 pointer-events-none" />
        <div className="relative space-y-4">
          <Brain className="h-12 w-12 text-primary mx-auto" />
          <h2 className="font-display text-2xl font-bold">Football IQ Mode</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">8 questions built from the real film analysis. Test your players on what the opponent actually does.</p>
          <Button size="lg" className="gap-2 glow-primary-sm active:scale-[0.97]" onClick={start}>
            <Brain className="h-4 w-4" /> Start Quiz
          </Button>
        </div>
      </div>
    );
  }

  if (mutation.isPending) {
    return (
      <div className="glass rounded-2xl p-16 flex flex-col items-center gap-4 relative overflow-hidden">
        <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent anim-scan" />
        <Brain className="h-10 w-10 text-primary animate-pulse" />
        <span className="font-tactical text-sm text-primary">WRITING QUESTIONS FROM THE FILM…</span>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <div className="glass-bright clip-tactical p-16 text-center anim-rise glow-primary relative overflow-hidden">
        <div className="absolute inset-0 field-grid opacity-30 pointer-events-none" />
        <div className="relative space-y-4">
          <Trophy className="h-12 w-12 text-primary mx-auto" />
          <div className="font-display text-6xl font-bold text-glow text-primary">{correct}/{questions.length}</div>
          <p className="font-tactical text-xs text-muted-foreground">
            {pct >= 75 ? "FILM JUNKIE — YOU KNOW THIS OPPONENT" : pct >= 50 ? "SOLID — REWATCH THE BREAKDOWN TABS" : "BACK TO THE FILM ROOM, ROOKIE"}
          </p>
          <Button variant="outline" className="gap-2 active:scale-[0.97]" onClick={start}>
            <RotateCcw className="h-4 w-4" /> New Quiz
          </Button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const isRevealed = revealed[current];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 anim-rise">
        {questions.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
            revealed[i] ? (answers[i] === questions[i].correctIndex ? "bg-primary" : "bg-red-500") : i === current ? "bg-foreground/40" : "bg-secondary"
          }`} />
        ))}
        <span className="font-tactical text-[10px] text-muted-foreground ml-2">{current + 1}/{questions.length}</span>
      </div>

      <div className="glass-bright rounded-2xl p-8 anim-rise-1">
        <div className="font-tactical text-[10px] text-primary mb-3">QUESTION {current + 1}</div>
        <h3 className="font-display text-xl font-semibold leading-snug mb-6">{q.question}</h3>
        <div className="space-y-2.5">
          {q.options.map((opt, i) => {
            let style = "bg-secondary hover:bg-accent";
            if (isRevealed) {
              if (i === q.correctIndex) style = "bg-primary/20 border border-primary text-primary";
              else if (answers[current] === i) style = "bg-red-500/15 border border-red-500/50 text-red-400";
              else style = "bg-secondary opacity-50";
            }
            return (
              <button
                key={i}
                disabled={isRevealed}
                onClick={() => {
                  setAnswers((a) => ({ ...a, [current]: i }));
                  setRevealed((r) => ({ ...r, [current]: true }));
                }}
                className={`w-full text-left p-4 rounded-xl text-sm font-medium transition-all active:scale-[0.98] flex items-center gap-3 ${style}`}
              >
                <span className="font-display font-bold text-xs w-6 h-6 rounded-full bg-background/40 flex items-center justify-center shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
                {isRevealed && i === q.correctIndex && <CheckCircle2 className="h-4 w-4 ml-auto shrink-0" />}
                {isRevealed && answers[current] === i && i !== q.correctIndex && <XCircle className="h-4 w-4 ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>
        {isRevealed && (
          <div className="mt-5 p-4 rounded-xl bg-secondary/60 border border-border anim-rise">
            <div className="font-tactical text-[9px] text-primary mb-1">COACH'S EXPLANATION</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
            <Button size="sm" className="mt-3 active:scale-[0.97]" onClick={() => setCurrent((c) => Math.min(c + 1, questions.length - 1))} disabled={current === questions.length - 1 && !done}>
              {answered === questions.length ? "See Results" : "Next Question"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

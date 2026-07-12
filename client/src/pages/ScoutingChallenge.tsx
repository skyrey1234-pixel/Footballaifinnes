import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Trophy, Zap, Target, Brain, ChevronRight, RotateCcw, Star } from "lucide-react";

interface Question {
  id: number;
  level: number;
  type: "formation" | "prediction" | "coverage" | "audible";
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  xpReward: number;
}

const LEVEL_CONFIG = [
  { name: "Rookie", icon: Target, color: "#60A5FA", xpRequired: 0 },
  { name: "Starter", icon: Brain, color: "#00FF87", xpRequired: 100 },
  { name: "All-Pro", icon: Zap, color: "#F97316", xpRequired: 300 },
  { name: "MVP", icon: Trophy, color: "#FFD700", xpRequired: 600 },
  { name: "Hall of Fame", icon: Star, color: "#A855F7", xpRequired: 1000 },
];

// Generate questions from scouting report data
function generateQuestions(reportData: any): Question[] {
  const questions: Question[] = [];
  let id = 1;

  // Level 1: Formation identification
  questions.push({
    id: id++,
    level: 1,
    type: "formation",
    question: "The opponent lines up with 3 WRs, 1 RB, 1 TE. What formation is this?",
    options: ["I-Formation", "Shotgun Trips", "Pistol", "Singleback"],
    correctAnswer: 1,
    explanation: "3 WRs to one side = Trips. With a RB and TE, this is Shotgun Trips — a pass-heavy formation.",
    xpReward: 10,
  });

  questions.push({
    id: id++,
    level: 1,
    type: "formation",
    question: "You see 2 TEs, 2 RBs, and 1 WR. What personnel grouping is this?",
    options: ["11 Personnel", "12 Personnel", "22 Personnel", "21 Personnel"],
    correctAnswer: 2,
    explanation: "22 Personnel = 2 RBs + 2 TEs + 1 WR. This is a heavy run formation — expect inside zone or power.",
    xpReward: 10,
  });

  questions.push({
    id: id++,
    level: 1,
    type: "formation",
    question: "The QB is under center with a FB and HB behind him. What formation?",
    options: ["Shotgun", "Pistol", "I-Formation", "Spread"],
    correctAnswer: 2,
    explanation: "QB under center + FB + HB stacked behind = I-Formation. Classic power running look.",
    xpReward: 10,
  });

  // Level 2: Run/Pass prediction
  questions.push({
    id: id++,
    level: 2,
    type: "prediction",
    question: "It's 2nd & 8. The opponent has run the ball 70% of the time on 2nd & medium this season. What do you expect?",
    options: ["Run", "Pass", "Play Action", "Screen"],
    correctAnswer: 0,
    explanation: "With a 70% run rate on 2nd & medium, the tendency says RUN. But be ready for play action — they know you're expecting it.",
    xpReward: 20,
  });

  questions.push({
    id: id++,
    level: 2,
    type: "prediction",
    question: "3rd & 12. The opponent is in empty backfield (5 WR, 0 RB). What's coming?",
    options: ["Draw play", "Deep pass", "Quick slants/screens", "QB sneak"],
    correctAnswer: 2,
    explanation: "On 3rd & long from empty, they need quick completions to move the chains. Expect slants, hitches, or screens — not deep shots.",
    xpReward: 20,
  });

  questions.push({
    id: id++,
    level: 2,
    type: "prediction",
    question: "Red zone (inside the 10). Opponent goes heavy with 2 TEs and a FB. What's the play?",
    options: ["Fade route", "Power run / Goal line dive", "Screen pass", "Hail Mary"],
    correctAnswer: 1,
    explanation: "Heavy personnel in the red zone = goal line run. They're trying to pound it in with extra blockers.",
    xpReward: 20,
  });

  // Level 3: Coverage identification
  questions.push({
    id: id++,
    level: 3,
    type: "coverage",
    question: "Pre-snap: both safeties are deep (split), corners are pressing. What coverage?",
    options: ["Cover 0 (Man, no safety)", "Cover 1 (Man, 1 high)", "Cover 2 (Zone, 2 high)", "Cover 3 (Zone, 1 high)"],
    correctAnswer: 2,
    explanation: "Two deep safeties split = Cover 2. The corners pressing means they're playing the flats. Attack the deep middle (hole shot) or the sideline between corner and safety.",
    xpReward: 30,
  });

  questions.push({
    id: id++,
    level: 3,
    type: "coverage",
    question: "Single high safety in the middle. Corners are 7 yards off the ball. What coverage?",
    options: ["Cover 2 Man", "Cover 3 Zone", "Cover 4 (Quarters)", "Cover 0 Blitz"],
    correctAnswer: 1,
    explanation: "One high safety + corners playing off = Cover 3 Zone. The corners have deep third responsibility. Attack underneath with curls, digs, and crossers.",
    xpReward: 30,
  });

  questions.push({
    id: id++,
    level: 3,
    type: "coverage",
    question: "No deep safety. All DBs are within 5 yards of a receiver. A LB is creeping to the line. What coverage?",
    options: ["Cover 2 Zone", "Cover 3 Match", "Cover 0 Man Blitz", "Cover 6"],
    correctAnswer: 2,
    explanation: "No safety help + tight man alignment + extra rusher = Cover 0 Blitz. Everyone is in man coverage with no deep help. Hit a quick slant or hot route before the pressure arrives.",
    xpReward: 30,
  });

  // Level 4: Audible calls
  questions.push({
    id: id++,
    level: 4,
    type: "audible",
    question: "You called a deep pass but see Cover 2 with both safeties deep. What's your audible?",
    options: ["Keep the deep pass — throw over the top", "Audible to a run — safeties are deep", "Check to a screen — they're dropping back", "Audible to a slant — attack the middle"],
    correctAnswer: 1,
    explanation: "Cover 2 puts both safeties deep to stop the pass. That means only 5-6 in the box. AUDIBLE TO A RUN — you have a numbers advantage up front.",
    xpReward: 50,
  });

  questions.push({
    id: id++,
    level: 4,
    type: "audible",
    question: "You called an inside run but see 8 men in the box with both safeties creeping up. What do you do?",
    options: ["Run it anyway — trust the O-line", "Audible to a pass — they're selling out to stop the run", "Call timeout", "Check to an outside run"],
    correctAnswer: 1,
    explanation: "8 in the box = they're loading up to stop the run. AUDIBLE TO A PASS — someone is open deep because both safeties came down. Look for the post or go route.",
    xpReward: 50,
  });

  questions.push({
    id: id++,
    level: 4,
    type: "audible",
    question: "You see Cover 0 Man with a blitz coming from the weak side. Your hot route is the slot WR on a quick slant. What do you do?",
    options: ["Throw the hot route immediately", "Try to escape the pocket", "Check to max protect", "Throw it deep — 1-on-1 outside"],
    correctAnswer: 0,
    explanation: "Cover 0 blitz = throw the HOT ROUTE immediately. The slot on a quick slant against man coverage with no safety help is a guaranteed completion if you get it out fast.",
    xpReward: 50,
  });

  return questions;
}

export default function ScoutingChallenge() {
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem("tacticaledge_xp");
    return saved ? parseInt(saved) : 0;
  });
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [streak, setStreak] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);

  const questions = generateQuestions(null);

  const currentLevel = LEVEL_CONFIG.reduce((acc, level, idx) => {
    if (xp >= level.xpRequired) return idx;
    return acc;
  }, 0);

  const nextLevel = LEVEL_CONFIG[currentLevel + 1];
  const progressToNext = nextLevel
    ? ((xp - LEVEL_CONFIG[currentLevel].xpRequired) / (nextLevel.xpRequired - LEVEL_CONFIG[currentLevel].xpRequired)) * 100
    : 100;

  useEffect(() => {
    localStorage.setItem("tacticaledge_xp", xp.toString());
  }, [xp]);

  const handleAnswer = (answerIdx: number) => {
    if (showResult) return;
    setSelectedAnswer(answerIdx);
    setShowResult(true);
    setQuestionsAnswered(prev => prev + 1);

    const q = questions[currentQuestion];
    if (answerIdx === q.correctAnswer) {
      const streakBonus = streak >= 3 ? 10 : streak >= 5 ? 25 : 0;
      setXp(prev => prev + q.xpReward + streakBonus);
      setStreak(prev => prev + 1);
      setCorrectAnswers(prev => prev + 1);
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion >= questions.length - 1) {
      setGameComplete(true);
      return;
    }
    setCurrentQuestion(prev => prev + 1);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  const resetGame = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setStreak(0);
    setQuestionsAnswered(0);
    setCorrectAnswers(0);
    setGameComplete(false);
    setGameStarted(false);
  };

  if (!gameStarted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <motion.div
          className="max-w-lg w-full text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-6xl mb-4">🏈</div>
          <h1 className="text-3xl font-black text-white mb-2">SCOUTING CHALLENGE</h1>
          <p className="text-gray-400 mb-6">Test your football IQ. Identify formations, predict plays, read coverages, and call audibles like a pro.</p>

          {/* Level display */}
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const LevelIcon = LEVEL_CONFIG[currentLevel].icon;
                  return <LevelIcon size={20} style={{ color: LEVEL_CONFIG[currentLevel].color }} />;
                })()}
                <span className="text-white font-bold">{LEVEL_CONFIG[currentLevel].name}</span>
              </div>
              <span className="text-sm text-gray-400">{xp} XP</span>
            </div>
            {nextLevel && (
              <div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressToNext}%`, backgroundColor: LEVEL_CONFIG[currentLevel].color }}
                  />
                </div>
                <div className="text-[10px] text-gray-500 mt-1 text-right">
                  {nextLevel.xpRequired - xp} XP to {nextLevel.name}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => setGameStarted(true)}
            className="w-full h-14 text-lg font-bold bg-[#00FF87] text-black hover:bg-[#00cc6a]"
          >
            START CHALLENGE <ChevronRight className="ml-2" />
          </Button>

          <div className="grid grid-cols-4 gap-2 mt-6">
            <div className="bg-[#161b22] rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">Level 1</div>
              <div className="text-[10px] text-gray-500">Formations</div>
            </div>
            <div className="bg-[#161b22] rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">Level 2</div>
              <div className="text-[10px] text-gray-500">Predictions</div>
            </div>
            <div className="bg-[#161b22] rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">Level 3</div>
              <div className="text-[10px] text-gray-500">Coverages</div>
            </div>
            <div className="bg-[#161b22] rounded-lg p-2 text-center">
              <div className="text-xs text-gray-400">Level 4</div>
              <div className="text-[10px] text-gray-500">Audibles</div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (gameComplete) {
    const accuracy = Math.round((correctAnswers / questionsAnswered) * 100);
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <motion.div
          className="max-w-lg w-full text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-6xl mb-4">{accuracy >= 80 ? "🏆" : accuracy >= 60 ? "💪" : "📚"}</div>
          <h1 className="text-3xl font-black text-white mb-2">CHALLENGE COMPLETE</h1>

          <div className="grid grid-cols-3 gap-4 my-6">
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-black text-[#00FF87]">{correctAnswers}/{questionsAnswered}</div>
              <div className="text-xs text-gray-400">Correct</div>
            </div>
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-black text-white">{accuracy}%</div>
              <div className="text-xs text-gray-400">Accuracy</div>
            </div>
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-black text-yellow-400">{xp}</div>
              <div className="text-xs text-gray-400">Total XP</div>
            </div>
          </div>

          <Button onClick={resetGame} className="w-full h-12 bg-[#00FF87] text-black font-bold hover:bg-[#00cc6a]">
            <RotateCcw className="mr-2" size={18} /> PLAY AGAIN
          </Button>
        </motion.div>
      </div>
    );
  }

  const q = questions[currentQuestion];
  const levelInfo = LEVEL_CONFIG[Math.min(q.level - 1, LEVEL_CONFIG.length - 1)];

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-gray-400">
            Q{currentQuestion + 1}/{questions.length}
          </div>
          <div
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ backgroundColor: `${levelInfo.color}20`, color: levelInfo.color }}
          >
            Level {q.level}: {q.type.charAt(0).toUpperCase() + q.type.slice(1)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streak >= 3 && (
            <span className="text-xs text-orange-400 font-bold">🔥 {streak} streak!</span>
          )}
          <span className="text-sm text-[#00FF87] font-bold">{xp} XP</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-800 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-[#00FF87] rounded-full transition-all duration-300"
          style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <motion.div
        key={q.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <h2 className="text-xl font-bold text-white mb-6">{q.question}</h2>

        <div className="space-y-3">
          {q.options.map((option, idx) => {
            let borderColor = "border-gray-700";
            let bgColor = "bg-[#161b22]";

            if (showResult) {
              if (idx === q.correctAnswer) {
                borderColor = "border-green-500";
                bgColor = "bg-green-900/20";
              } else if (idx === selectedAnswer && idx !== q.correctAnswer) {
                borderColor = "border-red-500";
                bgColor = "bg-red-900/20";
              }
            } else if (idx === selectedAnswer) {
              borderColor = "border-[#00FF87]";
              bgColor = "bg-[#00FF87]/10";
            }

            return (
              <motion.button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={showResult}
                className={`w-full text-left p-4 rounded-xl border ${borderColor} ${bgColor} transition-all hover:border-[#00FF87]/50 disabled:cursor-default`}
                whileHover={!showResult ? { scale: 1.01 } : {}}
                whileTap={!showResult ? { scale: 0.99 } : {}}
              >
                <span className="text-sm text-white">{option}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Result explanation */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6"
          >
            <div className={`p-4 rounded-xl border ${selectedAnswer === q.correctAnswer ? "border-green-500/30 bg-green-900/10" : "border-red-500/30 bg-red-900/10"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: selectedAnswer === q.correctAnswer ? "#00FF87" : "#EF4444" }}>
                  {selectedAnswer === q.correctAnswer ? "✓ Correct!" : "✗ Incorrect"}
                </span>
                {selectedAnswer === q.correctAnswer && (
                  <span className="text-xs text-[#00FF87]">+{q.xpReward} XP</span>
                )}
              </div>
              <p className="text-sm text-gray-300">{q.explanation}</p>
            </div>

            <Button
              onClick={nextQuestion}
              className="w-full mt-4 h-12 bg-[#00FF87] text-black font-bold hover:bg-[#00cc6a]"
            >
              {currentQuestion >= questions.length - 1 ? "See Results" : "Next Question"} <ChevronRight className="ml-1" size={18} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

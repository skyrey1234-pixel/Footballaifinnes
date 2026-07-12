import { motion } from "framer-motion";
import { Swords, TrendingUp, Shield, Zap } from "lucide-react";

interface TeamData {
  name: string;
  overall: number;
  record?: string;
  tendencies: {
    runPercent: number;
    passPercent: number;
    blitzPercent: number;
  };
}

interface KeyMatchup {
  yourPlayer: string;
  yourRating: number;
  theirPlayer: string;
  theirRating: number;
  advantage: "you" | "them" | "even";
  note: string;
}

interface MatchupScreenProps {
  yourTeam: TeamData;
  opponent: TeamData;
  keyMatchups: KeyMatchup[];
  prediction: {
    winner: "you" | "them";
    confidence: number;
    margin: string;
  };
  gameDate?: string;
}

function OvrRing({ value, size = 100, color }: { value: number; size?: number; color: string }) {
  const circumference = 2 * Math.PI * (size / 2 - 8);
  const progress = (value / 99) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 8}
          fill="none"
          stroke="#1f2937"
          strokeWidth="6"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 8}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-2xl font-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
}

export default function MatchupScreen({ yourTeam, opponent, keyMatchups, prediction, gameDate }: MatchupScreenProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(180deg, #0d1117 0%, #161b22 50%, #0d1117 100%)" }}>
      {/* Background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#00FF87] to-transparent" />
        <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-white/30 to-transparent" />
        <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-[#EF4444] to-transparent" />
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">
            {gameDate || "Game Day"}
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">MATCHUP PREVIEW</h2>
        </motion.div>

        {/* Head to head */}
        <div className="flex items-center justify-between mb-10">
          {/* Your team */}
          <motion.div
            className="text-center flex-1"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <OvrRing value={yourTeam.overall} color="#00FF87" />
            <div className="mt-3">
              <div className="text-lg font-bold text-white">{yourTeam.name}</div>
              {yourTeam.record && <div className="text-xs text-gray-400">{yourTeam.record}</div>}
            </div>
          </motion.div>

          {/* VS */}
          <motion.div
            className="mx-6"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <div className="w-16 h-16 rounded-full border-2 border-gray-700 flex items-center justify-center bg-[#0d1117]">
              <Swords className="text-gray-400" size={24} />
            </div>
          </motion.div>

          {/* Opponent */}
          <motion.div
            className="text-center flex-1"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <OvrRing value={opponent.overall} color="#EF4444" />
            <div className="mt-3">
              <div className="text-lg font-bold text-white">{opponent.name}</div>
              {opponent.record && <div className="text-xs text-gray-400">{opponent.record}</div>}
            </div>
          </motion.div>
        </div>

        {/* Tendency comparison */}
        <motion.div
          className="grid grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 uppercase mb-2">Run/Pass</div>
            <div className="flex justify-between text-sm">
              <span className="text-[#00FF87] font-bold">{yourTeam.tendencies.runPercent}/{yourTeam.tendencies.passPercent}</span>
              <span className="text-gray-600">vs</span>
              <span className="text-red-400 font-bold">{opponent.tendencies.runPercent}/{opponent.tendencies.passPercent}</span>
            </div>
          </div>
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 uppercase mb-2">Blitz %</div>
            <div className="flex justify-between text-sm">
              <span className="text-[#00FF87] font-bold">{yourTeam.tendencies.blitzPercent}%</span>
              <span className="text-gray-600">vs</span>
              <span className="text-red-400 font-bold">{opponent.tendencies.blitzPercent}%</span>
            </div>
          </div>
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-3 text-center">
            <div className="text-[10px] text-gray-500 uppercase mb-2">OVR Edge</div>
            <div className="text-lg font-black" style={{ color: yourTeam.overall > opponent.overall ? "#00FF87" : "#EF4444" }}>
              {yourTeam.overall > opponent.overall ? "+" : ""}{yourTeam.overall - opponent.overall}
            </div>
          </div>
        </motion.div>

        {/* Key matchups */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
            <Shield size={14} /> Key Matchups
          </h3>
          <div className="space-y-2">
            {keyMatchups.map((matchup, idx) => (
              <motion.div
                key={idx}
                className="flex items-center justify-between bg-[#0d1117] border border-gray-800 rounded-lg p-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + idx * 0.1 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#00FF87]">{matchup.yourRating}</span>
                  <span className="text-sm text-white">{matchup.yourPlayer}</span>
                </div>
                <div className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{
                  backgroundColor: matchup.advantage === "you" ? "#00FF8720" : matchup.advantage === "them" ? "#EF444420" : "#6B728020",
                  color: matchup.advantage === "you" ? "#00FF87" : matchup.advantage === "them" ? "#EF4444" : "#9CA3AF",
                }}>
                  {matchup.advantage === "you" ? `+${matchup.yourRating - matchup.theirRating}` : matchup.advantage === "them" ? `${matchup.yourRating - matchup.theirRating}` : "EVEN"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{matchup.theirPlayer}</span>
                  <span className="text-sm font-bold text-red-400">{matchup.theirRating}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* AI Prediction */}
        <motion.div
          className="bg-gradient-to-r from-[#00FF87]/10 via-[#0d1117] to-[#00FF87]/10 border border-[#00FF87]/20 rounded-xl p-4 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2 }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap size={14} className="text-[#00FF87]" />
            <span className="text-[10px] uppercase tracking-wider text-[#00FF87]">AI Prediction</span>
          </div>
          <div className="text-xl font-black text-white">
            {prediction.winner === "you" ? yourTeam.name : opponent.name} WIN
          </div>
          <div className="text-sm text-gray-400">
            by {prediction.margin} • {prediction.confidence}% confidence
          </div>
        </motion.div>
      </div>
    </div>
  );
}


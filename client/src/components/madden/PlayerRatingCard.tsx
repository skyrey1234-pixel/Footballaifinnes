import { useState } from "react";
import { motion } from "framer-motion";

interface PlayerRating {
  name: string;
  number: number;
  position: string;
  overall: number;
  team: string;
  attributes: {
    speed: number;
    strength: number;
    awareness: number;
    agility: number;
    acceleration: number;
    stamina: number;
  };
  xFactor?: string;
  weakness?: string;
  tendency?: string;
  threatLevel: "elite" | "high" | "medium" | "low";
}

function getOvrColor(ovr: number) {
  if (ovr >= 90) return "#FFD700"; // Gold
  if (ovr >= 80) return "#00FF87"; // Green
  if (ovr >= 70) return "#60A5FA"; // Blue
  if (ovr >= 60) return "#F97316"; // Orange
  return "#EF4444"; // Red
}

function getThreatBadge(level: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    elite: { bg: "#FFD700", text: "#000" },
    high: { bg: "#EF4444", text: "#FFF" },
    medium: { bg: "#F97316", text: "#FFF" },
    low: { bg: "#60A5FA", text: "#FFF" },
  };
  return colors[level] || colors.medium;
}

function AttributeBar({ label, value }: { label: string; value: number }) {
  const barColor = value >= 85 ? "#00FF87" : value >= 70 ? "#60A5FA" : value >= 55 ? "#F97316" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-gray-400 w-16">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-bold text-white w-6 text-right">{value}</span>
    </div>
  );
}

export default function PlayerRatingCard({ player }: { player: PlayerRating }) {
  const [flipped, setFlipped] = useState(false);
  const ovrColor = getOvrColor(player.overall);
  const threatBadge = getThreatBadge(player.threatLevel);

  return (
    <motion.div
      className="relative w-[280px] h-[380px] cursor-pointer perspective-1000"
      onClick={() => setFlipped(!flipped)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Front of card */}
      <motion.div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #1a1f2e 0%, #0d1117 50%, #1a1f2e 100%)",
          border: `2px solid ${ovrColor}40`,
          backfaceVisibility: "hidden",
          rotateY: flipped ? 180 : 0,
        }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Top section — OVR and position */}
        <div className="relative p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-5xl font-black" style={{ color: ovrColor }}>{player.overall}</div>
              <div className="text-xs text-gray-400 uppercase tracking-widest mt-1">OVR</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{player.position}</div>
              <div
                className="text-[10px] px-2 py-0.5 rounded-full mt-1 font-bold uppercase inline-block"
                style={{ backgroundColor: threatBadge.bg, color: threatBadge.text }}
              >
                {player.threatLevel}
              </div>
            </div>
          </div>
        </div>

        {/* Player info */}
        <div className="px-4 pb-2">
          <div className="text-xl font-bold text-white">#{player.number} {player.name}</div>
          <div className="text-sm text-gray-400">{player.team}</div>
        </div>

        {/* Attribute bars */}
        <div className="px-4 py-3 space-y-2">
          <AttributeBar label="SPD" value={player.attributes.speed} />
          <AttributeBar label="STR" value={player.attributes.strength} />
          <AttributeBar label="AWR" value={player.attributes.awareness} />
          <AttributeBar label="AGI" value={player.attributes.agility} />
          <AttributeBar label="ACC" value={player.attributes.acceleration} />
          <AttributeBar label="STA" value={player.attributes.stamina} />
        </div>

        {/* X-Factor badge */}
        {player.xFactor && (
          <div className="absolute bottom-3 left-4 right-4">
            <div className="bg-gradient-to-r from-yellow-900/50 to-transparent border border-yellow-500/30 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-yellow-400 uppercase tracking-wider font-bold">⚡ X-Factor: </span>
              <span className="text-xs text-yellow-200">{player.xFactor}</span>
            </div>
          </div>
        )}

        {/* Card shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none rounded-xl" />
      </motion.div>

      {/* Back of card */}
      <motion.div
        className="absolute inset-0 rounded-xl overflow-hidden p-4"
        style={{
          background: "linear-gradient(145deg, #1a1f2e 0%, #0d1117 50%, #1a1f2e 100%)",
          border: `2px solid ${ovrColor}40`,
          backfaceVisibility: "hidden",
          rotateY: flipped ? 0 : -180,
        }}
        animate={{ rotateY: flipped ? 0 : -180 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-sm font-bold text-white mb-3">SCOUTING INTEL</div>

        {player.tendency && (
          <div className="mb-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Key Tendency</div>
            <div className="text-sm text-white bg-gray-800/50 rounded-lg p-2">{player.tendency}</div>
          </div>
        )}

        {player.weakness && (
          <div className="mb-3">
            <div className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Weakness</div>
            <div className="text-sm text-white bg-red-900/20 border border-red-500/20 rounded-lg p-2">{player.weakness}</div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 right-4 text-center">
          <span className="text-[10px] text-gray-500">Tap to flip back</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Generate ratings from AI player profile data
export function generatePlayerRatings(playerData: any): PlayerRating {
  const positionBoosts: Record<string, Partial<PlayerRating["attributes"]>> = {
    QB: { awareness: 10, agility: 5 },
    RB: { speed: 8, agility: 8, acceleration: 5 },
    WR: { speed: 10, agility: 5, acceleration: 8 },
    TE: { strength: 8, speed: 3 },
    OL: { strength: 12, stamina: 5 },
    DL: { strength: 10, acceleration: 5 },
    LB: { speed: 5, awareness: 8, strength: 5 },
    CB: { speed: 10, agility: 8, awareness: 5 },
    S: { speed: 8, awareness: 8, agility: 3 },
    K: { awareness: 5 },
    P: { awareness: 5 },
  };

  const base = 65;
  const threatMultiplier = playerData.threatLevel === "elite" ? 1.3 : playerData.threatLevel === "high" ? 1.15 : playerData.threatLevel === "medium" ? 1.0 : 0.85;
  const boost = positionBoosts[playerData.position] || {};

  const attrs = {
    speed: Math.min(99, Math.round((base + (boost.speed || 0)) * threatMultiplier)),
    strength: Math.min(99, Math.round((base + (boost.strength || 0)) * threatMultiplier)),
    awareness: Math.min(99, Math.round((base + (boost.awareness || 0)) * threatMultiplier)),
    agility: Math.min(99, Math.round((base + (boost.agility || 0)) * threatMultiplier)),
    acceleration: Math.min(99, Math.round((base + (boost.acceleration || 0)) * threatMultiplier)),
    stamina: Math.min(99, Math.round((base + (boost.stamina || 0)) * threatMultiplier)),
  };

  const overall = Math.round(Object.values(attrs).reduce((a, b) => a + b, 0) / 6);

  return {
    name: playerData.name || "Unknown",
    number: playerData.number || 0,
    position: playerData.position || "ATH",
    overall,
    team: playerData.team || "Opponent",
    attributes: attrs,
    xFactor: playerData.xFactor || undefined,
    weakness: playerData.weakness || undefined,
    tendency: playerData.tendency || undefined,
    threatLevel: playerData.threatLevel || "medium",
  };
}

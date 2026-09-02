import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Check,
  Play,
  Zap,
  Crown,
  Building2,
  Brain,
  Target,
  Shield,
  TrendingUp,
  Gamepad2,
  Swords,
  ChevronRight,
} from "lucide-react";

const tiers = [
  {
    name: "Scout",
    price: 99,
    icon: Zap,
    color: "#60A5FA",
    description: "Essential scouting for competitive programs",
    features: [
      "AI Scouting Reports",
      "Season Intel Dashboard",
      "Player Tendency Profiles",
      "5 sessions/month",
      "SVG Film Annotations",
    ],
    cta: "Start Scouting",
  },
  {
    name: "Strategist",
    price: 199,
    icon: Crown,
    color: "#00FF87",
    popular: true,
    description: "Full game planning for serious coaching staffs",
    features: [
      "Everything in Scout",
      "AI Game Plan Generator",
      "Animated Madden-Style Diagrams",
      "Unlimited sessions",
      "PDF Export",
      "Scouting Challenge Mode",
    ],
    cta: "Get Strategist",
  },
  {
    name: "Program",
    price: 499,
    icon: Building2,
    color: "#FFD700",
    description: "Enterprise solution for entire athletic programs",
    features: [
      "Everything in Strategist",
      "5-10 team seats",
      "API access",
      "Priority support",
      "Custom branding",
      "Dedicated account manager",
    ],
    cta: "Contact Sales",
  },
];

const features = [
  {
    icon: Brain,
    title: "AI Scouting Reports",
    description: "Upload game film and get a full 360° scouting report in under 60 seconds. Offense, defense, tendencies, key players — all analyzed by AI.",
  },
  {
    icon: Target,
    title: "AI Film Breakdown",
    description: "Color-coded SVG annotations drawn directly on film. Red for mistakes, green for good plays, blue for suggestions, yellow for key players.",
  },
  {
    icon: Swords,
    title: "Game Plan Generator",
    description: "AI generates a complete game plan: 15 scripted plays, red zone package, 3rd down conversions, defensive adjustments, and halftime checklist.",
  },
  {
    icon: Play,
    title: "Animated Play Diagrams",
    description: "Madden-style X's and O's with route trees, blocking assignments, and defensive alignments. Hit 'Run Play' to watch routes develop in real-time.",
  },
  {
    icon: Shield,
    title: "Player Tendency Profiles",
    description: "AI-generated scouting cards for every key opponent. Tendencies, strengths, weaknesses, and Madden-style OVR ratings.",
  },
  {
    icon: Gamepad2,
    title: "Scouting Challenge",
    description: "Gamified quiz mode to sharpen your football IQ. Identify formations, predict plays, read coverages, and call audibles.",
  },
];

// Animated mini formation diagram for the hero
function HeroDiagram() {
  const offensePlayers = [
    { x: 200, y: 180, label: "C" },
    { x: 170, y: 180, label: "LG" },
    { x: 230, y: 180, label: "RG" },
    { x: 140, y: 180, label: "LT" },
    { x: 260, y: 180, label: "RT" },
    { x: 200, y: 210, label: "QB" },
    { x: 200, y: 240, label: "RB" },
    { x: 100, y: 170, label: "WR" },
    { x: 300, y: 170, label: "WR" },
    { x: 280, y: 180, label: "TE" },
    { x: 120, y: 155, label: "SL" },
  ];

  const routes = [
    { from: { x: 100, y: 170 }, to: { x: 80, y: 100 } }, // WR go route
    { from: { x: 300, y: 170 }, to: { x: 320, y: 110 } }, // WR post
    { from: { x: 120, y: 155 }, to: { x: 160, y: 110 } }, // Slot dig
    { from: { x: 200, y: 240 }, to: { x: 250, y: 200 } }, // RB swing
  ];

  return (
    <svg viewBox="0 0 400 300" className="w-full max-w-md mx-auto">
      {/* Field lines */}
      <line x1="0" y1="180" x2="400" y2="180" stroke="#30363D" strokeWidth="1" strokeDasharray="4" />

      {/* Routes */}
      {routes.map((route, i) => (
        <motion.line
          key={i}
          x1={route.from.x}
          y1={route.from.y}
          x2={route.to.x}
          y2={route.to.y}
          stroke="#00FF87"
          strokeWidth="2"
          strokeDasharray="6 3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 1 + i * 0.3, duration: 1 }}
        />
      ))}

      {/* Route arrows */}
      {routes.map((route, i) => (
        <motion.polygon
          key={`arrow-${i}`}
          points={`${route.to.x},${route.to.y - 6} ${route.to.x - 4},${route.to.y + 2} ${route.to.x + 4},${route.to.y + 2}`}
          fill="#00FF87"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 + i * 0.3 }}
        />
      ))}

      {/* Offense players */}
      {offensePlayers.map((p, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i, type: "spring" }}
        >
          <circle cx={p.x} cy={p.y} r="10" fill="#0d1117" stroke="#00FF87" strokeWidth="2" />
          <text x={p.x} y={p.y + 3} textAnchor="middle" fill="#00FF87" fontSize="6" fontWeight="bold">
            {p.label}
          </text>
        </motion.g>
      ))}

      {/* Defense X marks */}
      {[
        { x: 170, y: 155 }, { x: 200, y: 155 }, { x: 230, y: 155 }, { x: 260, y: 155 },
        { x: 150, y: 135 }, { x: 200, y: 135 }, { x: 250, y: 135 },
      ].map((p, i) => (
        <motion.text
          key={`def-${i}`}
          x={p.x}
          y={p.y}
          textAnchor="middle"
          fill="#EF4444"
          fontSize="14"
          fontWeight="bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + i * 0.1 }}
        >
          ×
        </motion.text>
      ))}
    </svg>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0d1117]/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00FF87]/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-[#00FF87]" />
            </div>
            <span className="text-lg font-bold">TacticalEdge AI</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            {isAuthenticated ? (
              <Button
                onClick={() => setLocation("/")}
                className="bg-[#00FF87] text-black font-bold hover:bg-[#00cc6a]"
                size="sm"
              >
                Go to Dashboard
              </Button>
            ) : (
              <Button
                onClick={() => startLogin()}
                className="bg-[#00FF87] text-black font-bold hover:bg-[#00cc6a]"
                size="sm"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-[#00FF87]/10 border border-[#00FF87]/20 rounded-full px-4 py-1.5 mb-6">
              <Zap size={14} className="text-[#00FF87]" />
              <span className="text-xs text-[#00FF87] font-bold uppercase tracking-wider">AI-Powered Scouting</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-black leading-tight mb-6">
              Scout Opponents.<br />
              <span className="text-[#00FF87]">Win Games.</span>
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-lg">
              Upload game film. Get a full scouting report, animated play diagrams, and a complete game plan — all generated by AI in under 60 seconds.
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => isAuthenticated ? setLocation("/") : startLogin()}
                className="h-14 px-8 text-lg font-bold bg-[#00FF87] text-black hover:bg-[#00cc6a]"
              >
                Start Free Trial <ChevronRight className="ml-2" />
              </Button>
              <a href="#features" className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
                See features <ChevronRight size={14} />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-xs text-gray-500">Game Plan — Shotgun Trips Right</span>
              </div>
              <HeroDiagram />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00FF87] animate-pulse" />
                  <span className="text-xs text-gray-400">Play animation ready</span>
                </div>
                <Button size="sm" className="bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20 text-xs">
                  <Play size={12} className="mr-1" /> Run Play
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-[#161b22]/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4">Everything Your Coaching Staff Needs</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              From film breakdown to game day preparation — TacticalEdge AI handles the heavy lifting so you can focus on coaching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const FeatureIcon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  className="bg-[#0d1117] border border-gray-800 rounded-xl p-6 hover:border-[#00FF87]/30 transition-colors"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#00FF87]/10 flex items-center justify-center mb-4">
                    <FeatureIcon className="h-5 w-5 text-[#00FF87]" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Choose the plan that fits your program. All plans include a 7-day free trial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((tier, idx) => {
              const TierIcon = tier.icon;
              return (
                <motion.div
                  key={idx}
                  className={`relative bg-[#161b22] border rounded-2xl p-8 ${
                    tier.popular ? "border-[#00FF87] scale-105" : "border-gray-800"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15 }}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00FF87] text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                      Most Popular
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <TierIcon size={20} style={{ color: tier.color }} />
                    <span className="text-lg font-bold">{tier.name}</span>
                  </div>

                  <div className="mb-4">
                    <span className="text-4xl font-black">${tier.price}</span>
                    <span className="text-gray-400">/mo</span>
                  </div>

                  <p className="text-sm text-gray-400 mb-6">{tier.description}</p>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                        <Check size={14} className="text-[#00FF87] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => isAuthenticated ? setLocation("/") : startLogin()}
                    className={`w-full h-12 font-bold ${
                      tier.popular
                        ? "bg-[#00FF87] text-black hover:bg-[#00cc6a]"
                        : "bg-gray-800 text-white hover:bg-gray-700"
                    }`}
                  >
                    {tier.cta}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            Test card: 4242 4242 4242 4242 • Cancel anytime • No contracts
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-4">Ready to Dominate Your Next Opponent?</h2>
          <p className="text-gray-400 mb-8">
            Join coaching staffs who are already using AI to gain a competitive edge.
          </p>
          <Button
            onClick={() => isAuthenticated ? setLocation("/") : startLogin()}
            className="h-14 px-10 text-lg font-bold bg-[#00FF87] text-black hover:bg-[#00cc6a]"
          >
            Get Started Free <ChevronRight className="ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#00FF87]" />
            <span className="text-sm font-bold">TacticalEdge AI</span>
          </div>
          <p className="text-xs text-gray-500">© 2025 TacticalEdge AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

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
    name: "Cornerman",
    price: 99,
    icon: Zap,
    color: "#60A5FA",
    description: "Essential fight scouting for active fighters",
    features: [
      "AI Fight Reports",
      "Division Intel Dashboard",
      "Weapon Tendency Profiles",
      "5 breakdowns/month",
      "SVG Film Annotations",
    ],
    cta: "Start Scouting",
  },
  {
    name: "Head Coach",
    price: 199,
    icon: Crown,
    color: "#FF2D2D",
    popular: true,
    description: "Full fight planning for serious camps",
    features: [
      "Everything in Cornerman",
      "AI Fight Plan Generator",
      "Annotated Film Breakdowns",
      "Unlimited breakdowns",
      "PDF Export",
      "Fight IQ Challenge Mode",
    ],
    cta: "Get Head Coach",
  },
  {
    name: "Gym",
    price: 499,
    icon: Building2,
    description: "Team solution for the whole gym",
    color: "#FFD700",
    features: [
      "Everything in Head Coach",
      "5-10 corner seats",
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
    title: "AI Fight Reports",
    description: "Upload fight footage and get a full 360° fight report in under 60 seconds. Striking, grappling, clinch, tendencies, and vulnerabilities — all analyzed by AI.",
  },
  {
    icon: Target,
    title: "AI Film Breakdown",
    description: "Color-coded SVG annotations drawn directly on the tape. Red for got-caught, green for clean technique, blue for suggested counters, yellow for key weapons.",
  },
  {
    icon: Swords,
    title: "Fight Plan Generator",
    description: "AI generates a complete fight plan: striking sequences, finishing sequences, takedown & scramble plan, defensive adjustments, and a between-rounds checklist.",
  },
  {
    icon: Play,
    title: "Technique Diagrams",
    description: "Clean overhead octagon diagrams with strikes, angles, level changes, and movement. Visualize the exact sequence you want to drill.",
  },
  {
    icon: Shield,
    title: "Weapon Tendency Profiles",
    description: "AI-generated scouting cards for every signature weapon. Tendencies, setups, strengths, counters, and threat-level ratings.",
  },
  {
    icon: Gamepad2,
    title: "Fight IQ Challenge",
    description: "Gamified quiz mode to sharpen your fight IQ. Read stances, predict combinations, spot takedown entries, and call the counter.",
  },
];

// Animated mini striking-sequence diagram for the hero
function HeroDiagram() {
  // Octagon outline points (centered in a 400x300 viewbox)
  const octagon = "200,40 300,70 340,150 300,230 200,260 100,230 60,150 100,70";

  // Two fighters
  const fighters = [
    { x: 160, y: 150, label: "YOU", color: "#FF2D2D" },
    { x: 250, y: 150, label: "OPP", color: "#60A5FA" },
  ];

  // Striking sequence: jab, cross, then a level-change/takedown entry
  const strikes = [
    { from: { x: 172, y: 140 }, to: { x: 238, y: 138 }, label: "Jab", delay: 1.0 },
    { from: { x: 172, y: 155 }, to: { x: 238, y: 150 }, label: "Cross", delay: 1.5 },
    { from: { x: 168, y: 168 }, to: { x: 235, y: 190 }, label: "Level change", delay: 2.0 },
  ];

  return (
    <svg viewBox="0 0 400 300" className="w-full max-w-md mx-auto">
      {/* Octagon canvas */}
      <polygon points={octagon} fill="#0d1117" stroke="#30363D" strokeWidth="2" />
      <polygon points={octagon} fill="none" stroke="#FF2D2D" strokeWidth="1" strokeDasharray="3 5" opacity="0.4" />

      {/* Strike arrows */}
      {strikes.map((s, i) => (
        <motion.g key={i}>
          <motion.line
            x1={s.from.x}
            y1={s.from.y}
            x2={s.to.x}
            y2={s.to.y}
            stroke="#FF2D2D"
            strokeWidth="2.5"
            strokeDasharray="6 3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: s.delay, duration: 0.8 }}
          />
          <motion.polygon
            points={`${s.to.x},${s.to.y} ${s.to.x - 8},${s.to.y - 4} ${s.to.x - 8},${s.to.y + 4}`}
            fill="#FF2D2D"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: s.delay + 0.6 }}
          />
          <motion.text
            x={(s.from.x + s.to.x) / 2}
            y={(s.from.y + s.to.y) / 2 - 8}
            textAnchor="middle"
            fill="#FF2D2D"
            fontSize="9"
            fontWeight="bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: s.delay + 0.4 }}
          >
            {s.label}
          </motion.text>
        </motion.g>
      ))}

      {/* Fighters */}
      {fighters.map((f, i) => (
        <motion.g
          key={f.label}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.2, type: "spring" }}
        >
          <circle cx={f.x} cy={f.y} r="18" fill="#0d1117" stroke={f.color} strokeWidth="2.5" />
          <text x={f.x} y={f.y + 3} textAnchor="middle" fill={f.color} fontSize="8" fontWeight="bold">
            {f.label}
          </text>
        </motion.g>
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
            <div className="w-8 h-8 rounded-lg bg-[#FF2D2D]/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-[#FF2D2D]" />
            </div>
            <span className="text-lg font-bold">OctagonIQ</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            {isAuthenticated ? (
              <Button
                onClick={() => setLocation("/")}
                className="bg-[#FF2D2D] text-white font-bold hover:bg-[#cc2020]"
                size="sm"
              >
                Go to Dashboard
              </Button>
            ) : (
              <Button
                onClick={() => startLogin()}
                className="bg-[#FF2D2D] text-white font-bold hover:bg-[#cc2020]"
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
            <div className="inline-flex items-center gap-2 bg-[#FF2D2D]/10 border border-[#FF2D2D]/20 rounded-full px-4 py-1.5 mb-6">
              <Zap size={14} className="text-[#FF2D2D]" />
              <span className="text-xs text-[#FF2D2D] font-bold uppercase tracking-wider">AI-Powered Fight Scouting</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-black leading-tight mb-6">
              Scout Fighters.<br />
              <span className="text-[#FF2D2D]">Win Fights.</span>
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-lg">
              Upload fight footage. Get a full fight report, striking & grappling breakdowns, and a complete fight plan — all generated by AI in under 60 seconds.
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => isAuthenticated ? setLocation("/") : startLogin()}
                className="h-14 px-8 text-lg font-bold bg-[#FF2D2D] text-white hover:bg-[#cc2020]"
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
                <span className="ml-2 text-xs text-gray-500">Fight Plan — Southpaw Counter Package</span>
              </div>
              <HeroDiagram />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF2D2D] animate-pulse" />
                  <span className="text-xs text-gray-400">Sequence ready</span>
                </div>
                <Button size="sm" className="bg-[#FF2D2D]/10 text-[#FF2D2D] border border-[#FF2D2D]/20 text-xs">
                  <Play size={12} className="mr-1" /> Run Sequence
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
            <h2 className="text-3xl font-black mb-4">Everything Your Corner Needs</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              From film breakdown to fight-night preparation — OctagonIQ handles the heavy lifting so you can focus on the game plan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const FeatureIcon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  className="bg-[#0d1117] border border-gray-800 rounded-xl p-6 hover:border-[#FF2D2D]/30 transition-colors"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#FF2D2D]/10 flex items-center justify-center mb-4">
                    <FeatureIcon className="h-5 w-5 text-[#FF2D2D]" />
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
              Choose the plan that fits your camp. All plans include a 7-day free trial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {tiers.map((tier, idx) => {
              const TierIcon = tier.icon;
              return (
                <motion.div
                  key={idx}
                  className={`relative bg-[#161b22] border rounded-2xl p-8 ${
                    tier.popular ? "border-[#FF2D2D] scale-105" : "border-gray-800"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15 }}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FF2D2D] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">
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
                        <Check size={14} className="text-[#FF2D2D] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => isAuthenticated ? setLocation("/") : startLogin()}
                    className={`w-full h-12 font-bold ${
                      tier.popular
                        ? "bg-[#FF2D2D] text-white hover:bg-[#cc2020]"
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
          <h2 className="text-3xl font-black mb-4">Ready to Break Down Your Next Opponent?</h2>
          <p className="text-gray-400 mb-8">
            Join fighters and corners who are already using AI to gain a competitive edge.
          </p>
          <Button
            onClick={() => isAuthenticated ? setLocation("/") : startLogin()}
            className="h-14 px-10 text-lg font-bold bg-[#FF2D2D] text-white hover:bg-[#cc2020]"
          >
            Get Started Free <ChevronRight className="ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#FF2D2D]" />
            <span className="text-sm font-bold">OctagonIQ</span>
          </div>
          <p className="text-xs text-gray-500">© 2025 OctagonIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

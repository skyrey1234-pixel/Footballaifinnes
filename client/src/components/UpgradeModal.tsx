import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { X, Check, Zap, Crown, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: "scout" | "strategist" | "program";
  featureName: string;
}

const tierConfig = {
  scout: {
    name: "Scout",
    price: 99,
    icon: Zap,
    color: "#60A5FA",
    features: ["Scouting Reports", "Season Intel", "Player Profiles", "5 sessions/month"],
  },
  strategist: {
    name: "Strategist",
    price: 199,
    icon: Crown,
    color: "#00FF87",
    features: ["Everything in Scout", "Game Plan Generator", "Animated Play Diagrams", "Unlimited sessions", "PDF Export"],
  },
  program: {
    name: "Program",
    price: 499,
    icon: Building2,
    color: "#FFD700",
    features: ["Everything in Strategist", "5-10 team seats", "API access", "Priority support", "Custom branding"],
  },
};

export default function UpgradeModal({ isOpen, onClose, requiredTier, featureName }: UpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<"scout" | "strategist" | "program">(requiredTier);
  const checkoutMutation = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start checkout. Please try again.");
    },
  });

  // Only show tiers that actually unlock the feature
  const availableTiers = (["scout", "strategist", "program"] as const).filter(tier => {
    const tierOrder = { scout: 1, strategist: 2, program: 3 };
    return tierOrder[tier] >= tierOrder[requiredTier];
  });

  const handleUpgrade = () => {
    checkoutMutation.mutate({
      tier: selectedTier,
      successUrl: `${window.location.origin}/?upgraded=true`,
      cancelUrl: window.location.href,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(180deg, #161b22 0%, #0d1117 100%)" }}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-[#00FF87]/10 border border-[#00FF87]/20 rounded-full px-4 py-1.5 mb-4">
                  <Crown size={14} className="text-[#00FF87]" />
                  <span className="text-xs text-[#00FF87] font-bold uppercase tracking-wider">Upgrade Required</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">
                  Unlock {featureName}
                </h2>
                <p className="text-sm text-gray-400">
                  This feature requires the <span className="text-[#00FF87] font-bold">{tierConfig[requiredTier].name}</span> plan or higher.
                </p>
              </div>

              {/* Tier cards */}
              <div className={`grid grid-cols-1 ${availableTiers.length === 3 ? "md:grid-cols-3" : availableTiers.length === 2 ? "md:grid-cols-2" : ""} gap-3 mb-6`}>
                {availableTiers.map((tier) => {
                  const config = tierConfig[tier];
                  const TierIcon = config.icon;
                  const isSelected = selectedTier === tier;
                  const isRequired = tier === requiredTier;

                  return (
                    <button
                      key={tier}
                      onClick={() => setSelectedTier(tier)}
                      className={`relative text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-[#00FF87] bg-[#00FF87]/5"
                          : "border-gray-800 bg-[#0d1117] hover:border-gray-600"
                      }`}
                    >
                      {isRequired && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-[#00FF87] text-black font-bold px-2 py-0.5 rounded-full">
                          RECOMMENDED
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <TierIcon size={16} style={{ color: config.color }} />
                        <span className="text-sm font-bold text-white">{config.name}</span>
                      </div>
                      <div className="mb-3">
                        <span className="text-2xl font-black text-white">${config.price}</span>
                        <span className="text-xs text-gray-400">/mo</span>
                      </div>
                      <ul className="space-y-1">
                        {config.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <Check size={10} className="text-[#00FF87] shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {/* CTA */}
              <Button
                onClick={handleUpgrade}
                disabled={checkoutMutation.isPending}
                className="w-full h-14 text-lg font-bold bg-[#00FF87] text-black hover:bg-[#00cc6a] disabled:opacity-50"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Upgrade to {tierConfig[selectedTier].name} — ${tierConfig[selectedTier].price}/mo</>
                )}
              </Button>

              <p className="text-center text-[10px] text-gray-500 mt-3">
                Test card: 4242 4242 4242 4242 • Cancel anytime
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

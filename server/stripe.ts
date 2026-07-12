import Stripe from "stripe";

// Initialize Stripe client

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const STRIPE_PRODUCTS = {
  SCOUT: {
    name: "Scout",
    description: "Scouting reports, season intel, player profiles. 5 sessions/month.",
    priceMonthly: 9900, // $99/mo in cents
    features: ["Scouting Reports", "Season Intel", "Player Profiles", "5 sessions/month"],
  },
  STRATEGIST: {
    name: "Strategist",
    description: "Everything in Scout + Game Plan Generator + Animated Diagrams + Unlimited sessions.",
    priceMonthly: 19900, // $199/mo in cents
    features: [
      "Everything in Scout",
      "Game Plan Generator",
      "Animated Play Diagrams",
      "Unlimited sessions",
      "PDF Export",
    ],
  },
  PROGRAM: {
    name: "Program",
    description: "Team subscription. Everything in Strategist + 5-10 team seats + API access.",
    priceMonthly: 49900, // $499/mo in cents
    features: [
      "Everything in Strategist",
      "5-10 team seats",
      "API access",
      "Priority support",
      "Custom branding",
    ],
  },
};

export type SubscriptionTier = "scout" | "strategist" | "program" | "free";

export function getTierFromPrice(priceId: string): SubscriptionTier {
  // Map Stripe price IDs to tiers (you'll set these in Stripe dashboard)
  if (priceId.includes("scout")) return "scout";
  if (priceId.includes("strategist")) return "strategist";
  if (priceId.includes("program")) return "program";
  return "free";
}

export function canAccessFeature(tier: SubscriptionTier, feature: string): boolean {
  const featureAccess: Record<SubscriptionTier, string[]> = {
    free: ["scouting_reports"],
    scout: ["scouting_reports", "season_intel", "player_profiles"],
    strategist: [
      "scouting_reports",
      "season_intel",
      "player_profiles",
      "game_plan",
      "animated_diagrams",
      "pdf_export",
    ],
    program: [
      "scouting_reports",
      "season_intel",
      "player_profiles",
      "game_plan",
      "animated_diagrams",
      "pdf_export",
      "team_seats",
      "api_access",
    ],
  };

  return featureAccess[tier]?.includes(feature) || false;
}

export async function createCheckoutSession(
  customerId: string | undefined,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  clientReferenceId: string,
  customerEmail?: string,
  customerName?: string
) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: !customerId ? customerEmail : undefined,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: clientReferenceId,
    metadata: {
      user_id: clientReferenceId,
      customer_email: customerEmail || "",
      customer_name: customerName || "",
    },
    allow_promotion_codes: true,
  });
}

export async function getSubscriptionStatus(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

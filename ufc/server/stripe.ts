import Stripe from "stripe";

// Initialize Stripe client

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const STRIPE_PRODUCTS = {
  CORNERMAN: {
    name: "Cornerman",
    description: "Fight reports, division intel, weapon profiles. 5 breakdowns/month.",
    priceMonthly: 9900, // $99/mo in cents
    features: ["Fight Reports", "Division Intel", "Weapon Profiles", "5 breakdowns/month"],
  },
  HEADCOACH: {
    name: "Head Coach",
    description: "Everything in Cornerman + Fight Plan Generator + Annotated Breakdowns + Unlimited breakdowns.",
    priceMonthly: 19900, // $199/mo in cents
    features: [
      "Everything in Cornerman",
      "Fight Plan Generator",
      "Annotated Film Breakdowns",
      "Unlimited breakdowns",
      "PDF Export",
    ],
  },
  GYM: {
    name: "Gym",
    description: "Team subscription. Everything in Head Coach + 5-10 corner seats + API access.",
    priceMonthly: 49900, // $499/mo in cents
    features: [
      "Everything in Head Coach",
      "5-10 corner seats",
      "API access",
      "Priority support",
      "Custom branding",
    ],
  },
};

export type SubscriptionTier = "cornerman" | "headcoach" | "gym" | "free";

export function getTierFromPrice(priceId: string): SubscriptionTier {
  // Map Stripe price IDs to tiers (you'll set these in Stripe dashboard)
  if (priceId.includes("cornerman")) return "cornerman";
  if (priceId.includes("headcoach")) return "headcoach";
  if (priceId.includes("gym")) return "gym";
  return "free";
}

export function canAccessFeature(tier: SubscriptionTier, feature: string): boolean {
  const featureAccess: Record<SubscriptionTier, string[]> = {
    free: ["fight_reports"],
    cornerman: ["fight_reports", "division_intel", "weapon_profiles"],
    headcoach: [
      "fight_reports",
      "division_intel",
      "weapon_profiles",
      "fight_plan",
      "annotated_breakdowns",
      "pdf_export",
    ],
    gym: [
      "fight_reports",
      "division_intel",
      "weapon_profiles",
      "fight_plan",
      "annotated_breakdowns",
      "pdf_export",
      "corner_seats",
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

import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { createCheckoutSession, getTierFromPrice, STRIPE_PRODUCTS } from "./stripe";

export const stripeRouter = router({
  // Create a checkout session for a subscription
  createCheckout: protectedProcedure
    .input(z.object({
      tier: z.enum(["scout", "strategist", "program"]),
      successUrl: z.string(),
      cancelUrl: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Map tier to Stripe price ID (you'll set these in Stripe dashboard)
      const priceIds: Record<string, string> = {
        scout: process.env.STRIPE_PRICE_SCOUT || "",
        strategist: process.env.STRIPE_PRICE_STRATEGIST || "",
        program: process.env.STRIPE_PRICE_PROGRAM || "",
      };

      const priceId = priceIds[input.tier];
      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Price ID not configured for tier: ${input.tier}`,
        });
      }

      try {
        const session = await createCheckoutSession(
          (ctx.user as any).stripeCustomerId || undefined,
          priceId,
          input.successUrl,
          input.cancelUrl,
          ctx.user.id.toString(),
          (ctx.user as any).email || undefined,
          (ctx.user as any).name || undefined
        );

        if (!session.url) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create checkout session",
          });
        }

        return { checkoutUrl: session.url };
      } catch (error) {
        console.error("[Stripe] Checkout error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }
    }),

  // Get user's subscription status
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.getUserById(ctx.user.id);
    return {
      tier: (user as any)?.subscriptionTier || "free",
      status: (user as any)?.subscriptionStatus || "active",
      endsAt: (user as any)?.subscriptionEndsAt || null,
    };
  }),

  // Get pricing tiers
  getPricing: protectedProcedure.query(() => {
    return {
      scout: {
        name: STRIPE_PRODUCTS.SCOUT.name,
        description: STRIPE_PRODUCTS.SCOUT.description,
        price: STRIPE_PRODUCTS.SCOUT.priceMonthly / 100, // Convert cents to dollars
        features: STRIPE_PRODUCTS.SCOUT.features,
      },
      strategist: {
        name: STRIPE_PRODUCTS.STRATEGIST.name,
        description: STRIPE_PRODUCTS.STRATEGIST.description,
        price: STRIPE_PRODUCTS.STRATEGIST.priceMonthly / 100,
        features: STRIPE_PRODUCTS.STRATEGIST.features,
      },
      program: {
        name: STRIPE_PRODUCTS.PROGRAM.name,
        description: STRIPE_PRODUCTS.PROGRAM.description,
        price: STRIPE_PRODUCTS.PROGRAM.priceMonthly / 100,
        features: STRIPE_PRODUCTS.PROGRAM.features,
      },
    };
  }),
});

import { Router, Request, Response } from "express";
import Stripe from "stripe";
import * as db from "./db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export const webhookRouter = Router();

// Stripe webhook endpoint — must use raw body for signature verification
webhookRouter.post("/api/stripe/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;

  try {
    // req.body is raw buffer because we mount this before express.json()
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log("[Stripe Webhook] Received event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = parseInt(session.client_reference_id || "0");
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId > 0) {
          // Retrieve the subscription to get the price ID
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price?.id || "";

          // Determine tier from price ID
          let tier: "scout" | "strategist" | "program" = "scout";
          if (priceId === process.env.STRIPE_PRICE_STRATEGIST) tier = "strategist";
          else if (priceId === process.env.STRIPE_PRICE_PROGRAM) tier = "program";
          else if (priceId === process.env.STRIPE_PRICE_SCOUT) tier = "scout";

          await db.updateUserSubscription(userId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionTier: tier,
            subscriptionStatus: "active",
          });

          console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await db.getUserByStripeCustomerId(customerId);

        if (user) {
          const status = subscription.status === "active" ? "active"
            : subscription.status === "past_due" ? "past_due"
            : subscription.status === "canceled" ? "canceled"
            : "unpaid";

          const priceId = subscription.items.data[0]?.price?.id || "";
          let tier: "scout" | "strategist" | "program" | "free" = "free";
          if (priceId === process.env.STRIPE_PRICE_STRATEGIST) tier = "strategist";
          else if (priceId === process.env.STRIPE_PRICE_PROGRAM) tier = "program";
          else if (priceId === process.env.STRIPE_PRICE_SCOUT) tier = "scout";

          await db.updateUserSubscription(user.id, {
            subscriptionTier: tier,
            subscriptionStatus: status,
            subscriptionEndsAt: (subscription as any).current_period_end
              ? new Date((subscription as any).current_period_end * 1000)
              : null,
          });

          console.log(`[Stripe Webhook] User ${user.id} subscription updated: ${tier} (${status})`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const user = await db.getUserByStripeCustomerId(customerId);

        if (user) {
          await db.updateUserSubscription(user.id, {
            subscriptionTier: "free",
            subscriptionStatus: "canceled",
            subscriptionEndsAt: new Date(),
          });

          console.log(`[Stripe Webhook] User ${user.id} subscription canceled`);
        }
        break;
      }
    }
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
  }

  res.json({ received: true });
});

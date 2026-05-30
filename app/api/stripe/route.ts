import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey     = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    // Stripe not yet configured — return 200 so Stripe stops retrying instead
    // of accumulating failures. Log so the operator knows to set the env vars.
    console.warn("[stripe] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set — ignoring event");
    return NextResponse.json({ received: true });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Must use the raw body for signature verification — req.text() preserves it.
    const rawBody = await req.text();
    const stripe = new Stripe(stripeKey);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[stripe] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      // TODO: mark the associated order as paid when online payments are enabled
      break;
    case "payment_intent.payment_failed":
      // TODO: notify the customer and cancel the order
      break;
    default:
      // Unhandled event — acknowledge so Stripe doesn't retry
      break;
  }

  return NextResponse.json({ received: true });
}

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";

let _sb: any = null;
function sb(): any {
  if (!_sb) _sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return _sb;
}

// Map a checkout session to one of our three product tiers.
// Prefer priceId (embedded checkout sets metadata.priceId); fall back to
// amount_total for Payment Link sessions where we don't control metadata.
type Tier = "portfolio_pdf" | "resume_bundle" | "buyer_network";
function tierFromSession(session: any): Tier | null {
  const priceId: string | undefined = session.metadata?.priceId;
  if (priceId === "portfolio_pdf_27_onetime" || priceId === "portfolio_pdf_onetime") return "portfolio_pdf";
  if (priceId === "resume_website_bundle_onetime") return "resume_bundle";
  if (priceId === "buyer_network_yearly" || priceId === "buyer_network") return "buyer_network";
  const amount = session.amount_total ?? 0;
  if (session.mode === "subscription" || amount === 19700) return "buyer_network";
  if (amount === 2700) return "portfolio_pdf";
  if (amount === 4700) return "resume_bundle";
  return null;
}

async function upsertSubscription(sub: any, env: StripeEnv, userIdOverride?: string) {
  const userId = sub.metadata?.userId ?? userIdOverride;
  if (!userId) return;
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await sb().from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    product_id: "buyer_network", // all our recurring products are buyer_network
    price_id: priceId ?? "buyer_network",
    status: sub.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end || false,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // Resolve the user: embedded checkout stamps metadata.userId; Payment Links pass client_reference_id.
  const userId: string | undefined = session.metadata?.userId ?? session.client_reference_id ?? undefined;
  if (!userId) return;

  const tier = tierFromSession(session);
  if (!tier) return;

  const client = sb();

  // Idempotency — grant credit / provision subscription exactly once per session.
  const { error: markErr } = await client
    .from("processed_checkout_sessions")
    .insert({ session_id: session.id, user_id: userId, price_id: tier });
  if (markErr) {
    if ((markErr as any).code === "23505") return;
    throw markErr;
  }

  if (tier === "portfolio_pdf" || tier === "resume_bundle") {
    const { data: existing } = await client
      .from("portfolio_credits")
      .select("purchased,resume_bundle_purchased")
      .eq("user_id", userId)
      .maybeSingle();

    const patch: any = { user_id: userId, updated_at: new Date().toISOString() };
    if (tier === "portfolio_pdf") {
      patch.purchased = ((existing?.purchased as number | undefined) ?? 0) + 1;
    } else {
      patch.resume_bundle_purchased = ((existing?.resume_bundle_purchased as number | undefined) ?? 0) + 1;
    }
    await client.from("portfolio_credits").upsert(patch, { onConflict: "user_id" });
    return;
  }

  // Buyer Network — subscription mode.
  // Payment Link subscriptions don't have metadata.userId on the Subscription
  // object, so subsequent customer.subscription.* webhooks would drop the
  // user. Fetch the subscription, stamp metadata.userId, backfill the
  // Customer's metadata.userId, and upsert the local row immediately.
  const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!subId) return;

  try {
    const stripe = createStripeClient(env);
    // Stamp userId on both Customer and Subscription so later reads/searches resolve.
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if (!(c as any).deleted && (c as any).metadata?.userId !== userId) {
          await stripe.customers.update(customerId, { metadata: { ...((c as any).metadata ?? {}), userId } });
        }
      } catch (e) { console.error("customer.update failed:", e); }
    }
    const sub = await stripe.subscriptions.update(subId, { metadata: { userId } });
    await upsertSubscription(sub, env, userId);
  } catch (e) {
    console.error("Buyer Network provisioning failed:", e);
    // Best-effort local row so gating works even if Stripe update fails.
    await client.from("subscriptions").upsert({
      user_id: userId,
      stripe_subscription_id: subId,
      stripe_customer_id: customerId ?? "unknown",
      product_id: "buyer_network",
      price_id: "buyer_network",
      status: "active",
      environment: env,
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id" });
  }
}

async function handleChargeRefunded(charge: any, env: string) {
  const client = sb();
  const paymentIntent = charge.payment_intent;
  const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return;
  const { data: sub } = await client
    .from("subscriptions")
    .select("user_id,stripe_subscription_id,product_id")
    .eq("stripe_customer_id", customerId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return;
  await client.from("refunds").insert({
    user_id: sub.user_id,
    admin_id: null,
    stripe_subscription_id: sub.stripe_subscription_id,
    stripe_refund_id: charge.refunds?.data?.[0]?.id ?? null,
    amount_cents: charge.amount_refunded ?? 0,
    currency: charge.currency ?? "usd",
    reason: "Refunded from Stripe dashboard",
    environment: env,
    stripe_payment_intent_id: paymentIntent ?? null,
  } as any);
  if (sub.product_id === "buyer_network") {
    await client.from("profiles").update({ buyer_network_status: "rejected", buyer_network_note: "Refunded" }).eq("id", sub.user_id);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const raw = new URL(request.url).searchParams.get("env");
        if (raw !== "sandbox" && raw !== "live") return Response.json({ received: true, ignored: "invalid env" });
        const env: StripeEnv = raw;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed":
              await handleCheckoutCompleted(event.data.object, env);
              break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await upsertSubscription(event.data.object, env);
              break;
            case "customer.subscription.deleted":
              await sb().from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() })
                .eq("stripe_subscription_id", event.data.object.id).eq("environment", env);
              break;
            case "charge.refunded":
              await handleChargeRefunded(event.data.object, env);
              break;
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
} as never);

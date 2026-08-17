import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };
type RefundResult = { ok: true; amount: number; refundId: string | null } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.userId) {
    const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (options.userId && c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, { metadata: { ...c.metadata, userId: options.userId } });
      }
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      // Duplicate-purchase guard for Buyer Network — user answered "block second subscription".
      if (data.priceId === "buyer_network_yearly") {
        const { data: existing } = await context.supabase
          .from("subscriptions")
          .select("status,current_period_end")
          .eq("user_id", context.userId)
          .eq("product_id", "buyer_network")
          .eq("environment", data.environment)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const stillActive = existing && (
          (["active", "trialing", "past_due", "incomplete"].includes(existing.status as string) &&
            (!existing.current_period_end || new Date(existing.current_period_end as string) > new Date()))
          || (existing.status === "canceled" && existing.current_period_end && new Date(existing.current_period_end as string) > new Date())
        );
        if (stillActive) return { error: "You already have a Buyer Network subscription. Manage it from the Membership page." };
      }

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const { data: userRes } = await context.supabase.auth.getUser();
      const email = userRes.user?.email ?? undefined;
      const userId = context.userId;

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      let productDescription: string | undefined;
      if (!isRecurring) {
        const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
        const product = await stripe.products.retrieve(productId);
        productDescription = product.name;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        ...(!isRecurring && { payment_intent_data: { description: productDescription, metadata: { userId, priceId: data.priceId } } }),
        metadata: { userId, priceId: data.priceId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;
    try {
      const stripe = createStripeClient(data.environment);

      // 1) Prefer a stripe_customer_id from any subscription row in this env.
      let customerId: string | null = null;
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      customerId = (sub?.stripe_customer_id as string | null) ?? null;

      // 2) Fallback for one-time-only buyers: resolve via Stripe Customer metadata.
      if (!customerId) {
        const { data: userRes } = await supabase.auth.getUser();
        const email = userRes.user?.email ?? undefined;
        const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
        if (found.data.length) customerId = found.data[0].id;
        else if (email) {
          const byEmail = await stripe.customers.list({ email, limit: 1 });
          if (byEmail.data.length) customerId = byEmail.data[0].id;
        }
      }
      if (!customerId) return { error: "No billing history found for your account yet." };

      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Admin-only: reject a Buyer Network applicant.
 * - Marks the profile as rejected with an internal note.
 * - Refunds the most recent Buyer Network subscription payment in full.
 * - Cancels the subscription immediately (no future billing).
 * - Logs the refund in the `refunds` table.
 */
export const rejectBuyerNetworkApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { artistId: string; note?: string; environment: StripeEnv }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.artistId)) throw new Error("Invalid artistId");
    return data;
  })
  .handler(async ({ data, context }): Promise<RefundResult> => {
    const { supabase, userId } = context;

    // Authorization: admin only (direct user_roles read; RLS allows user to see own roles)
    const { data: adminRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!adminRow) return { error: "Forbidden" };

    // Load most recent buyer_network subscription for the artist in this env
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", data.artistId)
      .eq("product_id", "buyer_network")
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let refundId: string | null = null;
    let amount = 0;

    try {
      if (sub?.stripe_subscription_id) {
        const stripe = createStripeClient(data.environment);

        // Find latest paid invoice on this subscription and refund its charge.
        // dahlia API surfaces the charge via `latest_charge`, or via `payments[].payment.payment_intent`.
        const invoices = await stripe.invoices.list({ subscription: sub.stripe_subscription_id as string, limit: 5, expand: ["data.payments"] } as any);
        const paid = invoices.data.find((i: any) => i.status === "paid");
        if (paid) {
          let chargeId: string | null = (paid as any).latest_charge ?? (paid as any).charge ?? null;
          let paymentIntentId: string | null = null;
          const pays = (paid as any).payments?.data ?? [];
          for (const p of pays) {
            const pi = p?.payment?.payment_intent;
            if (typeof pi === "string") { paymentIntentId = pi; break; }
            if (pi?.id) { paymentIntentId = pi.id; break; }
          }
          try {
            let refund;
            if (chargeId) refund = await stripe.refunds.create({ charge: chargeId as string });
            else if (paymentIntentId) refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
            if (refund) { refundId = refund.id; amount = refund.amount ?? paid.amount_paid ?? 0; }
          } catch (e) {
            console.error("Refund failed:", e);
          }
        }

        // Cancel subscription immediately (no future billing)
        try { await stripe.subscriptions.cancel(sub.stripe_subscription_id as string); } catch { /* already canceled is fine */ }
      }
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }

    // Update profile
    await supabase.from("profiles").update({
      buyer_network_status: "rejected",
      buyer_network_note: data.note ?? null,
      buyer_network_reviewed_by: userId,
      buyer_network_reviewed_at: new Date().toISOString(),
    }).eq("id", data.artistId);

    // Log refund
    await supabase.from("refunds").insert({
      user_id: data.artistId,
      admin_id: userId,
      stripe_subscription_id: sub?.stripe_subscription_id ?? null,
      stripe_refund_id: refundId,
      amount_cents: amount,
      currency: "usd",
      reason: data.note ?? "Buyer Network application rejected",
      environment: data.environment,
    });

    // Reflect canceled state locally in case webhook is delayed
    if (sub?.stripe_subscription_id) {
      await supabase.from("subscriptions").update({
        status: "canceled",
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }).eq("stripe_subscription_id", sub.stripe_subscription_id as string);
    }

    return { ok: true, amount, refundId };
  });

export const approveBuyerNetworkApplicant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { artistId: string; note?: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.artistId)) throw new Error("Invalid artistId");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: adminRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!adminRow) return { error: "Forbidden" as const };
    const { error } = await supabase.from("profiles").update({
      buyer_network_status: "approved",
      buyer_network_note: data.note ?? null,
      buyer_network_reviewed_by: userId,
      buyer_network_reviewed_at: new Date().toISOString(),
    }).eq("id", data.artistId);
    if (error) return { error: error.message };
    return { ok: true as const };
  });

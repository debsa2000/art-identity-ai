import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

export function StripeEmbeddedCheckoutInline({ priceId, returnUrl }: { priceId: string; returnUrl?: string }) {
  const fetchClientSecret = async () => {
    const result = await createCheckoutSession({
      data: { priceId, returnUrl: returnUrl || window.location.href, environment: getStripeEnvironment() },
    });
    if ("error" in result) throw new Error(result.error);
    return result.clientSecret;
  };
  return (
    <div id="checkout" className="min-h-[600px]">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

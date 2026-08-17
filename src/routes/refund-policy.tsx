import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Art Identity AI" },
      { name: "description", content: "How refunds work at Art Identity AI, including the Buyer Network qualification guarantee." },
    ],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <main className="container-x max-w-3xl py-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Legal</p>
      <h1 className="mt-3 font-serif text-5xl">Refund Policy</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated {new Date().toLocaleDateString()}</p>

      <div className="prose prose-sm mt-10 max-w-none text-foreground/90 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:mt-8 [&_p]:mt-3 [&_p]:text-muted-foreground">
        <h2>Buyer Network — $197 / year</h2>
        <p><strong>If your application is not approved, you receive a full refund automatically.</strong> Buyer Network membership is subject to a curator review. When an admin rejects an application, our system immediately issues a full refund via Stripe and cancels the subscription so you are not billed again. The refund typically appears on your statement within 5–10 business days.</p>
        <p>Approved members may cancel at any time from the billing portal. Cancellations take effect at the end of the current billing period and are not pro-rated.</p>

        <h2>Portfolio PDF — $47 one-time</h2>
        <p>Each Portfolio PDF purchase unlocks a single download. Because the PDF is generated and delivered instantly, this purchase is non-refundable once a download has been used. If you experience a technical failure and were unable to download the file, contact support@artidentity.ai and we will issue a replacement or a refund.</p>

        <h2>Chargebacks</h2>
        <p>Please contact us before initiating a chargeback — we will almost always resolve the issue faster.</p>

        <h2>Contact</h2>
        <p>support@artidentity.ai</p>
      </div>
    </main>
  );
}

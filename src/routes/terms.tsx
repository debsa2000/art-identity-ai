import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Art Identity AI" },
      { name: "description", content: "The terms that govern your use of Art Identity AI." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="container-x max-w-3xl py-16">
      <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Legal</p>
      <h1 className="mt-3 font-serif text-5xl">Terms of Service</h1>
      <p className="mt-2 text-xs text-muted-foreground">Last updated {new Date().toLocaleDateString()}</p>

      <div className="prose prose-sm mt-10 max-w-none text-foreground/90 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:mt-8 [&_p]:mt-3 [&_p]:text-muted-foreground">
        <h2>1. Overview</h2>
        <p>Art Identity AI ("we", "us") provides tools that help visual artists build and share a professional online presence. By creating an account you agree to these terms.</p>

        <h2>2. Your account</h2>
        <p>You are responsible for the artwork, text, and images you upload, and confirm you own the rights to publish them. You may upload up to 15 artworks per account on the current plan.</p>

        <h2>3. Paid products</h2>
        <p>We offer a $47 one-time Portfolio PDF download and a $197/year Buyer Network membership. Prices are in USD and processed via Stripe. Applicable taxes may apply.</p>

        <h2>4. Buyer Network review</h2>
        <p>Buyer Network payments are treated as an application. A curator reviews each applicant. If your application is not approved, your payment is refunded in full (see the Refund Policy) and your subscription is canceled.</p>

        <h2>5. Content ownership</h2>
        <p>You retain all rights to your artwork. You grant us a limited license to display it in the directory, on your artist site, and in materials shared with buyers you opt in to.</p>

        <h2>6. Acceptable use</h2>
        <p>No infringing, harmful, illegal, or misleading content. We may remove content or terminate accounts that violate these terms.</p>

        <h2>7. Disclaimers</h2>
        <p>The service is provided as-is. We do not guarantee sales, exposure, or specific outcomes from the directory or Buyer Network.</p>

        <h2>8. Changes</h2>
        <p>We may update these terms. Material changes will be announced by email or in the app.</p>

        <h2>9. Contact</h2>
        <p>Questions: support@artidentity.ai</p>
      </div>
    </main>
  );
}

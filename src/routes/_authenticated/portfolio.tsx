import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/storage";
import { logEvent } from "@/lib/analytics";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { PricingModal } from "@/components/PricingModal";
import { loadEntitlements, type Entitlements } from "@/lib/entitlements";
import { consumePortfolioCredit } from "@/lib/portfolio.functions";
import { generateArtworkMockup } from "@/lib/mockup.functions";

export const Route = createFileRoute("/_authenticated/portfolio")({ component: PortfolioPage });

async function fetchImageDataUrl(url: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl: string = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob); });
    const size: { w: number; h: number } = await new Promise((resolve) => { const im = new Image(); im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => resolve({ w: 1, h: 1 }); im.src = dataUrl; });
    return { dataUrl, ...size };
  } catch { return null; }
}

// Blue/green futuristic palette
const NAVY = [10, 20, 40] as const;
const INK = [230, 236, 245] as const;
const TEAL = [45, 212, 191] as const;
const MUTED = [148, 163, 184] as const;

function PortfolioPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const consumeCredit = useServerFn(consumePortfolioCredit);
  const genMockup = useServerFn(generateArtworkMockup);

  async function refresh(u: string) {
    setEnt(await loadEntitlements(u));
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { const u = data.user?.id ?? null; setUid(u); if (u) refresh(u); }); }, []);

  async function build(preview: boolean) {
    if (!uid) return;
    setBusy(true);
    setPreviewOnly(preview);
    try {
      const [{ data: profile }, { data: aic }, { data: artworks }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("ai_content").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("artworks").select("*").eq("user_id", uid).order("created_at"),
      ]);
      if (!profile) throw new Error("Missing profile");

      // Consume credit on download only, and only if not a member.
      // Atomic server-side RPC — client can no longer tamper with the counter.
      if (!preview && ent && !ent.memberActive) {
        const consumed = await consumeCredit();
        if (!consumed) throw new Error("No download credits available. Please purchase to continue.");
      }

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 56;

      // Cover
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
      // Accent gradient stripes (simulated)
      doc.setFillColor(...TEAL); doc.rect(0, 0, 4, H, "F");
      doc.setFillColor(59, 130, 246); doc.rect(W - 4, 0, 4, H, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...TEAL);
      doc.text("ART · IDENTITY", M, M + 10);
      doc.setFont("times", "normal"); doc.setFontSize(56); doc.setTextColor(...INK);
      doc.text((profile as any).artist_name ?? "Artist", M, H / 2 - 20);
      doc.setFontSize(13); doc.setTextColor(...MUTED);
      doc.text([(profile as any).city, (profile as any).country].filter(Boolean).join(", "), M, H / 2 + 8);
      doc.setFontSize(9); doc.setTextColor(...MUTED);
      doc.text("Portfolio  ·  " + new Date().getFullYear().toString(), M, H - M);
      if (preview) { doc.setTextColor(...TEAL); doc.text("PREVIEW — Unlock for hi-res download", W - M - 220, H - M); }

      const addSection = (title: string, body: string) => {
        doc.addPage(); doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
        doc.setFillColor(...TEAL); doc.rect(M, M - 8, 32, 2, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEAL);
        doc.text(title.toUpperCase(), M, M + 10);
        doc.setFont("times", "normal"); doc.setFontSize(12); doc.setTextColor(...INK);
        doc.text(doc.splitTextToSize(body, W - M * 2), M, M + 40, { lineHeightFactor: 1.5 });
      };

      if ((profile as any).avatar_path) {
        const url = await signedUrl("avatars", (profile as any).avatar_path);
        if (url) { const img = await fetchImageDataUrl(url); if (img) {
          doc.addPage(); doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
          const maxW = W - M * 2, maxH = H - M * 2; const r = Math.min(maxW / img.w, maxH / img.h);
          const w = img.w * r, h = img.h * r;
          doc.addImage(img.dataUrl, "JPEG", (W - w) / 2, (H - h) / 2, w, h);
        } }
      }
      if ((aic as any)?.biography) addSection("Biography", (aic as any).biography);
      if ((aic as any)?.artist_statement) addSection("Artist Statement", (aic as any).artist_statement);

      for (const a of (artworks ?? []) as any[]) {
        doc.addPage(); doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
        if (a.image_path) {
          const url = await signedUrl("artworks", a.image_path);
          if (url) { const img = await fetchImageDataUrl(url); if (img) {
            const maxW = W - M * 2, maxH = H * 0.55; const r = Math.min(maxW / img.w, maxH / img.h);
            const w = img.w * r, h = img.h * r;
            // subtle frame
            doc.setDrawColor(...TEAL); doc.setLineWidth(0.5);
            doc.rect((W - w) / 2 - 6, M - 6, w + 12, h + 12);
            doc.addImage(img.dataUrl, "JPEG", (W - w) / 2, M, w, h);
          } }
        }
        const y0 = H * 0.6 + M / 2;
        doc.setFillColor(...TEAL); doc.rect(M, y0 - 14, 24, 2, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEAL);
        doc.text((a.medium ?? "").toUpperCase(), M, y0);
        doc.setFont("times", "normal"); doc.setFontSize(24); doc.setTextColor(...INK);
        doc.text(a.title, M, y0 + 26);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
        doc.text([a.dimensions, a.year, a.status].filter(Boolean).join("  ·  "), M, y0 + 44);
        if (a.description) { doc.setFontSize(11); doc.setTextColor(...INK);
          doc.text(doc.splitTextToSize(a.description, W - M * 2), M, y0 + 68, { lineHeightFactor: 1.4 });
        }

        // Room mockup page — best effort, silent on failure
        try {
          let mockupPath: string | null = a.mockup_path ?? null;
          if (!mockupPath && (a.width_cm && a.height_cm)) {
            const res = await genMockup({ data: { artworkId: a.id, force: false } });
            mockupPath = res?.mockup_path ?? null;
          }
          if (mockupPath) {
            const murl = await signedUrl("artworks", mockupPath);
            const mimg = murl ? await fetchImageDataUrl(murl) : null;
            if (mimg) {
              doc.addPage(); doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
              const maxW = W - M * 2, maxH = H * 0.7;
              const r = Math.min(maxW / mimg.w, maxH / mimg.h);
              const w = mimg.w * r, h = mimg.h * r;
              doc.addImage(mimg.dataUrl, "JPEG", (W - w) / 2, M + 20, w, h);
              doc.setFillColor(...TEAL); doc.rect(M, M - 8, 32, 2, "F");
              doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEAL);
              doc.text("IN CONTEXT · TO SCALE", M, M + 10);
              doc.setFont("times", "normal"); doc.setFontSize(14); doc.setTextColor(...INK);
              doc.text(a.title, M, H - M - 24);
              doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...MUTED);
              const dimStr = a.width_cm && a.height_cm ? `${a.width_cm}cm × ${a.height_cm}cm` : (a.dimensions ?? "");
              doc.text(dimStr, M, H - M - 8);
            }
          }
        } catch { /* fall back to plain layout */ }
      }

      // Contact
      doc.addPage(); doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(...TEAL); doc.rect(M, M - 8, 32, 2, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEAL);
      doc.text("CONTACT", M, M + 10);
      doc.setFont("times", "normal"); doc.setFontSize(16); doc.setTextColor(...INK);
      doc.text([(profile as any).artist_name, (profile as any).email, (profile as any).phone, (profile as any).website, (profile as any).instagram].filter(Boolean).join("\n"), M, M + 44, { lineHeightFactor: 1.7 });
      doc.setFontSize(9); doc.setTextColor(...MUTED);
      doc.text("Art Identity  ·  art-identity.ai", M, H - M);

      const filename = `${(profile as any).slug || "portfolio"}${preview ? "-preview" : ""}.pdf`;
      if (preview) {
        // Open in new tab
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        doc.save(filename);
        logEvent(uid, "portfolio_download");
        toast.success("Portfolio downloaded.");
        refresh(uid);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Print-ready · gallery-quality</p>
        <h1 className="mt-2 font-serif text-4xl">Portfolio PDF</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Preview is always free. Downloads unlock automatically once your application is approved by our curators.
        </p>
      </header>

      <div className="glass rounded-2xl border border-teal-400/20 bg-card/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Access</p>
            <p className="mt-1 font-serif text-2xl">
              {ent?.applicationApproved || ent?.memberActive
                ? "Unlimited (approved artist)"
                : ent?.applicationStatus === "submitted"
                  ? "In review — you'll be notified"
                  : "Locked — complete your application"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => build(true)} disabled={busy} className="rounded-full border border-white/20 px-6 py-3 text-xs uppercase tracking-widest hover:bg-white/5 disabled:opacity-50">
              {busy && previewOnly ? "Composing…" : "Preview free"}
            </button>
            {ent?.canDownloadPdf ? (
              <button onClick={() => build(false)} disabled={busy} className="rounded-full bg-teal-400 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-teal-300 disabled:opacity-50">
                {busy && !previewOnly ? "Composing…" : "Download PDF"}
              </button>
            ) : (
              <button onClick={() => setShowPricing(true)} className="rounded-full bg-teal-400/70 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-teal-300">
                Available after approval
              </button>
            )}
          </div>
        </div>
      </div>

      <PricingModal open={showPricing} intent="portfolio" onClose={() => { setShowPricing(false); if (uid) refresh(uid); }} returnTo="/portfolio" />
    </div>
  );
}

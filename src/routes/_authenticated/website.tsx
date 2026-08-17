import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Instagram } from "lucide-react";
import { PricingModal } from "@/components/PricingModal";
import { loadEntitlements, type Entitlements } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/website")({ component: WebsitePage });

function WebsitePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>("");
  const [published, setPublished] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const publicUrl = typeof window !== "undefined" && slug ? `${window.location.origin}/a/${slug}` : "";

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const { data } = await supabase.from("profiles").select("slug,published").eq("id", u.user.id).maybeSingle();
    if (data) { setSlug(data.slug); setPublished(data.published); }
    setEnt(await loadEntitlements(u.user.id));
  })(); }, []);

  useEffect(() => {
    if (!publicUrl) return;
    QRCode.toDataURL(publicUrl, { margin: 1, width: 400, color: { dark: "#0f172a", light: "#e0f2fe" } }).then(setQr);
  }, [publicUrl]);

  async function togglePublish() {
    if (!uid) return;
    if (!published) {
      // publishing requires bundle or membership
      if (!ent?.canPublishWebsite) { setShowPricing(true); return; }
    }
    const next = !published;
    const { error } = await supabase.from("profiles").update({ published: next }).eq("id", uid);
    if (error) { toast.error(error.message); return; }
    // Keep AI content visibility in sync with website publish state.
    await supabase.from("ai_content").update({ is_public: next }).eq("user_id", uid);
    setPublished(next);
    toast.success(next ? "Website published live." : "Website unpublished.");
  }

  async function updateSlug(v: string) {
    if (!uid) return;
    const clean = v.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
    setSlug(clean);
    const { error } = await supabase.from("profiles").update({ slug: clean }).eq("id", uid);
    if (error) toast.error("This URL is taken.");
    else toast.success("URL updated.");
  }

  async function copyIgLink() {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); toast.success("Link copied — paste it in your Instagram bio."); }
    catch { toast.error("Couldn't copy. Long-press to copy manually."); }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Public presence</p>
        <h1 className="mt-2 font-serif text-4xl">My Website</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Preview your site for free. Publishing goes live once your application is approved by our curators.
        </p>
      </header>

      <section className="glass rounded-2xl border border-teal-400/20 bg-card/60 p-6 space-y-4">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Your URL</span>
          <div className="mt-1 flex items-center rounded-lg border border-input bg-background overflow-hidden">
            <span className="px-3 text-sm text-muted-foreground">art-identity.ai/a/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} onBlur={(e) => updateSlug(e.target.value)}
              className="flex-1 border-l border-input bg-background px-3 py-2 text-sm focus:outline-none" />
          </div>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm">Status: <span className={published ? "text-teal-300" : "text-muted-foreground"}>{published ? "Published — live to the world" : "Draft — preview only"}</span></p>
            {!ent?.canPublishWebsite && !published && (
              <p className="mt-1 text-xs text-amber-300">Locked. Publishing unlocks after your application is approved.</p>
            )}
          </div>
          <button onClick={togglePublish} className="rounded-full bg-teal-400 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-teal-300">
            {published ? "Unpublish" : ent?.canPublishWebsite ? "Publish website" : "Available after approval"}
          </button>
        </div>

        {slug && (
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/a/$slug" params={{ slug }} className="text-sm text-teal-300 hover:text-teal-200">Preview website →</Link>
            <button onClick={copyIgLink} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest hover:bg-white/5">
              <Instagram className="size-3.5" /> <Copy className="size-3.5" /> Copy link for Instagram bio
            </button>
          </div>
        )}
      </section>

      {qr && (
        <section className="glass rounded-2xl border border-teal-400/20 bg-card/60 p-6">
          <h2 className="font-serif text-2xl">Your QR code</h2>
          <p className="mt-1 text-sm text-muted-foreground">For business cards, gallery walls, and exhibition placards.</p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <img src={qr} alt="QR code" className="size-48 rounded-xl border border-teal-400/30" />
            <a href={qr} download={`${slug}-qr.png`} className="rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-widest hover:bg-white/5">Download PNG</a>
          </div>
        </section>
      )}

      <PricingModal open={showPricing} intent="website" onClose={() => { setShowPricing(false); if (uid) loadEntitlements(uid).then(setEnt); }} returnTo="/website" />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { useSignedUrl } from "@/lib/use-signed-url";
import { Instagram, Clock, CheckCircle2, XCircle, Sparkles, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

type Profile = {
  artist_name: string | null; city: string | null; country: string | null;
  instagram: string | null; website: string | null; email: string | null; phone: string | null;
  medium: string | null; years_creating: number | null; style: string | null;
  price_range: string | null; commission_available: boolean;
  languages: string[] | null; exhibitions: string | null;
  avatar_path: string | null; slug: string;
  public_listed: boolean;
  application_status: "draft" | "submitted" | "approved" | "rejected";
  completion_percent: number;
};

function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const avatarUrl = useSignedUrl("avatars", p?.avatar_path ?? null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (data) setP(data as Profile);
    })();
  }, []);

  async function save() {
    if (!p || !userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      artist_name: p.artist_name, city: p.city, country: p.country,
      instagram: p.instagram, website: p.website, email: p.email, phone: p.phone,
      medium: p.medium, years_creating: p.years_creating, style: p.style,
      price_range: p.price_range, commission_available: p.commission_available,
      languages: p.languages, exhibitions: p.exhibitions,
      public_listed: p.public_listed,
    }).eq("id", userId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved.");
  }

  async function onAvatar(f: File) {
    if (!userId) return;
    try {
      const path = await uploadImage("avatars", userId, f);
      await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
      setP((prev) => prev ? { ...prev, avatar_path: path } : prev);
      toast.success("Photo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  }

  if (!p) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Identity · Your application</p>
        <h1 className="mt-2 font-serif text-4xl">My Profile</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your completed profile <em>is</em> your application. Fill every section — the higher the completion, the stronger your review.
        </p>
      </header>

      <ApplicationBanner status={p.application_status} pct={p.completion_percent ?? 0} instagram={p.instagram} />

      <IgConnectCard value={p.instagram} onChange={(v) => setP({ ...p, instagram: v })} onSave={save} />

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="size-24 overflow-hidden rounded-full border border-border bg-secondary">
            {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : null}
          </div>
          <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-secondary">
            Change photo
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAvatar(f); }} />
          </label>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-6 md:grid-cols-2">
        <Field label="Artist name" value={p.artist_name} onChange={(v) => setP({ ...p, artist_name: v })} />
        <Field label="Email" value={p.email} type="email" onChange={(v) => setP({ ...p, email: v })} />
        <Field label="City" value={p.city} onChange={(v) => setP({ ...p, city: v })} />
        <Field label="Country" value={p.country} onChange={(v) => setP({ ...p, country: v })} />
        <Field label="Instagram" value={p.instagram} onChange={(v) => setP({ ...p, instagram: v })} placeholder="@handle" />
        <Field label="Website" value={p.website} onChange={(v) => setP({ ...p, website: v })} placeholder="https://…" />
        <Field label="Phone (optional)" value={p.phone} onChange={(v) => setP({ ...p, phone: v })} />
        <Field label="Medium" value={p.medium} onChange={(v) => setP({ ...p, medium: v })} placeholder="Oil, ceramic, mixed…" />
        <Field label="Style" value={p.style} onChange={(v) => setP({ ...p, style: v })} placeholder="Abstract expressionism…" />
        <Field label="Years creating" type="number" value={p.years_creating?.toString() ?? ""} onChange={(v) => setP({ ...p, years_creating: v ? Number(v) : null })} />
        <Field label="Price range" value={p.price_range} onChange={(v) => setP({ ...p, price_range: v })} placeholder="$500 – $10,000" />
        <Field label="Languages (comma-separated)" value={p.languages?.join(", ") ?? ""} onChange={(v) => setP({ ...p, languages: v.split(",").map(s => s.trim()).filter(Boolean) })} />
        <label className="md:col-span-2 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={p.commission_available} onChange={(e) => setP({ ...p, commission_available: e.target.checked })} />
          Available for commissions
        </label>
        <label className="md:col-span-2 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={!!p.public_listed} onChange={(e) => setP({ ...p, public_listed: e.target.checked })} className="mt-1" />
          <span>
            <span className="block">List my profile in the public Discover directory</span>
            <span className="block text-xs text-muted-foreground">Your published portfolio will be visible at /discover. Uncheck at any time to remove yourself.</span>
          </span>
        </label>
        <label className="md:col-span-2 block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Exhibition history (optional)</span>
          <textarea rows={5} value={p.exhibitions ?? ""} onChange={(e) => setP({ ...p, exhibitions: e.target.value })}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
        </label>
      </section>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function ApplicationBanner({ status, pct, instagram }: { status: Profile["application_status"]; pct: number; instagram: string | null }) {
  if (status === "approved") return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5 text-sm flex items-start gap-3">
      <CheckCircle2 className="mt-0.5 size-5 text-emerald-400" />
      <div>
        <p className="font-serif text-xl">Approved — full access</p>
        <p className="text-muted-foreground">Every premium feature is unlocked for you. Keep your profile fresh.</p>
      </div>
    </div>
  );
  if (status === "submitted") return (
    <div className="rounded-2xl border border-teal-400/40 bg-teal-500/5 p-5 text-sm flex items-start gap-3">
      <Clock className="mt-0.5 size-5 text-teal-300" />
      <div>
        <p className="font-serif text-xl">Application in review</p>
        <p className="text-muted-foreground">A curator is reviewing your profile. You'll be emailed as soon as it's decided.</p>
      </div>
    </div>
  );
  if (status === "rejected") return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm flex items-start gap-3">
      <XCircle className="mt-0.5 size-5 text-destructive" />
      <div>
        <p className="font-serif text-xl">Not approved this round</p>
        <p className="text-muted-foreground">Refine your profile and Aria will re-review automatically.</p>
      </div>
    </div>
  );
  const remaining = 100 - pct;
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-300">Application · {pct}% complete</p>
          <p className="mt-2 font-serif text-2xl">Only {remaining}% away from submitting.</p>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Complete this profile to submit — approval unlocks the AI Studio, portfolio PDF, CV, publishing and mockups. First 100 approved artists get lifetime free access.</p>
          {!instagram && <p className="mt-2 text-xs text-amber-200"><Sparkles className="mr-1 inline size-3" /> Adding your Instagram lets curators verify your work in one click.</p>}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function IgConnectCard({ value, onChange, onSave }: { value: string | null; onChange: (v: string) => void; onSave: () => void }) {
  const clean = (value ?? "").replace(/^@/, "").trim();
  const url = clean ? `https://instagram.com/${clean}` : null;
  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-[#f9ce34]/5 via-[#ee2a7b]/5 to-[#6228d7]/5 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
          <Instagram className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg">Connect your Instagram</p>
          <p className="text-xs text-muted-foreground">One-click verification for our curators. This dramatically increases your approval chances.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-input bg-background focus-within:border-bronze">
              <span className="pl-3 text-muted-foreground">@</span>
              <input value={clean} onChange={(e) => onChange(e.target.value)} onBlur={onSave} placeholder="yourhandle" className="w-56 bg-transparent px-2 py-2 text-sm outline-none" />
            </div>
            {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs bronze-link">Open profile <ExternalLink className="size-3" /></a>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | null; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
    </label>
  );
}

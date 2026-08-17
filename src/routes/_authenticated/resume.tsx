import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { Plus, Trash2 } from "lucide-react";
import { PricingModal } from "@/components/PricingModal";
import { loadEntitlements, type Entitlements } from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/resume")({ component: ResumePage });

type Entry = { id: string; year: string; title: string; detail: string };
type CV = {
  education: Entry[];
  exhibitions: Entry[];
  awards: Entry[];
  press: Entry[];
  residencies: Entry[];
};

const EMPTY: CV = { education: [], exhibitions: [], awards: [], press: [], residencies: [] };
const SECTIONS: { key: keyof CV; label: string }[] = [
  { key: "education", label: "Education" },
  { key: "exhibitions", label: "Exhibitions" },
  { key: "awards", label: "Awards" },
  { key: "residencies", label: "Residencies" },
  { key: "press", label: "Press & Publications" },
];

function ResumePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cv, setCv] = useState<CV>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    if (data) { setProfile(data); setCv({ ...EMPTY, ...(data.cv as any) }); }
    setEnt(await loadEntitlements(u.user.id));
  })(); }, []);

  async function save() {
    if (!uid) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ cv }).eq("id", uid);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("CV saved.");
  }

  function addEntry(k: keyof CV) {
    setCv((c) => ({ ...c, [k]: [...c[k], { id: crypto.randomUUID(), year: "", title: "", detail: "" }] }));
  }
  function updateEntry(k: keyof CV, id: string, patch: Partial<Entry>) {
    setCv((c) => ({ ...c, [k]: c[k].map((e) => e.id === id ? { ...e, ...patch } : e) }));
  }
  function removeEntry(k: keyof CV, id: string) {
    setCv((c) => ({ ...c, [k]: c[k].filter((e) => e.id !== id) }));
  }

  function build(preview: boolean) {
    if (!profile) return;
    const NAVY = [10, 20, 40] as const;
    const INK = [230, 236, 245] as const;
    const TEAL = [45, 212, 191] as const;
    const MUTED = [148, 163, 184] as const;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 56;
    let y = M + 20;

    doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...TEAL); doc.rect(0, 0, 4, H, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEAL);
    doc.text("CURRICULUM VITAE", M, M);
    doc.setFont("times", "normal"); doc.setFontSize(38); doc.setTextColor(...INK);
    doc.text(profile.artist_name ?? "Artist", M, y + 24); y += 44;
    doc.setFontSize(11); doc.setTextColor(...MUTED);
    doc.text([[profile.city, profile.country].filter(Boolean).join(", "), profile.email, profile.website, profile.instagram].filter(Boolean).join("  ·  "), M, y); y += 30;

    const ensure = (need: number) => {
      if (y + need > H - M) {
        doc.addPage(); doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, "F");
        doc.setFillColor(...TEAL); doc.rect(0, 0, 4, H, "F");
        y = M;
      }
    };

    for (const s of SECTIONS) {
      const entries = cv[s.key];
      if (!entries.length) continue;
      ensure(60);
      doc.setFillColor(...TEAL); doc.rect(M, y, 24, 2, "F"); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TEAL);
      doc.text(s.label.toUpperCase(), M, y); y += 18;
      for (const e of entries) {
        ensure(40);
        doc.setFont("times", "normal"); doc.setFontSize(12); doc.setTextColor(...INK);
        doc.text(e.year || "", M, y);
        doc.text(e.title || "", M + 60, y);
        if (e.detail) {
          doc.setFontSize(10); doc.setTextColor(...MUTED);
          const lines = doc.splitTextToSize(e.detail, W - M * 2 - 60);
          doc.text(lines, M + 60, y + 14);
          y += 14 + lines.length * 12 + 6;
        } else { y += 18; }
      }
      y += 10;
    }

    if (preview) {
      doc.setFontSize(9); doc.setTextColor(...TEAL);
      doc.text("PREVIEW — Unlock to download hi-res", M, H - M);
      const blob = doc.output("blob");
      window.open(URL.createObjectURL(blob), "_blank");
    } else {
      doc.save(`${profile.slug || "cv"}-cv.pdf`);
      toast.success("CV downloaded.");
    }
  }

  async function download() {
    if (!ent?.canDownloadResume) { setShowPricing(true); return; }
    build(false);
  }

  if (!profile) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">CV builder</p>
        <h1 className="mt-2 font-serif text-4xl">Resume / CV</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Preview is always free. Download unlocks once your application is approved. Your CV auto-links from your public site.
        </p>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.key} className="glass rounded-2xl border border-teal-400/20 bg-card/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl">{s.label}</h2>
            <button onClick={() => addEntry(s.key)} className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-white/5">
              <Plus className="size-3.5" /> Add
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {cv[s.key].length === 0 && <p className="text-sm text-muted-foreground">No entries yet.</p>}
            {cv[s.key].map((e) => (
              <div key={e.id} className="grid gap-2 rounded-xl border border-white/10 bg-background/50 p-3 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,2fr)_auto]">
                <input placeholder="Year" value={e.year} onChange={(ev) => updateEntry(s.key, e.id, { year: ev.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <input placeholder="Title" value={e.title} onChange={(ev) => updateEntry(s.key, e.id, { title: ev.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <input placeholder="Detail (venue, city, notes)" value={e.detail} onChange={(ev) => updateEntry(s.key, e.id, { detail: ev.target.value })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                <button onClick={() => removeEntry(s.key, e.id)} className="rounded-lg border border-white/10 px-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 z-10 flex flex-wrap gap-3 rounded-2xl border border-teal-400/30 bg-slate-950/80 p-4 backdrop-blur">
        <button onClick={save} disabled={saving} className="rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-widest hover:bg-white/5 disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => build(true)} className="rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-widest hover:bg-white/5">
          Preview PDF (free)
        </button>
        <button onClick={download} className="rounded-full bg-teal-400 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-slate-950 hover:bg-teal-300">
          {ent?.canDownloadResume ? "Download CV" : "Available after approval"}
        </button>
      </div>

      <PricingModal open={showPricing} intent="resume" onClose={() => { setShowPricing(false); if (uid) loadEntitlements(uid).then(setEnt); }} returnTo="/resume" />
    </div>
  );
}

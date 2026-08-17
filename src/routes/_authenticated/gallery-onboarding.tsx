import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { becomeGallery, getMyGallery, updateMyGallery } from "@/lib/gallery.functions";

export const Route = createFileRoute("/_authenticated/gallery-onboarding")({
  component: GalleryOnboarding,
});

function GalleryOnboarding() {
  const nav = useNavigate();
  const become = useServerFn(becomeGallery);
  const load = useServerFn(getMyGallery);
  const update = useServerFn(updateMyGallery);

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load().then((g) => {
      if (g) {
        setName(g.name ?? "");
        setCity(g.city ?? "");
        setCountry(g.country ?? "");
        setBio(g.bio ?? "");
      }
    }).catch(() => { /* ignore */ });
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Gallery name is required"); return; }
    setSaving(true);
    try {
      await become({ data: { name: name.trim() } });
      await update({ data: { name: name.trim(), city, country, bio } });
      toast.success("Welcome. Your gallery is live.");
      nav({ to: "/gallery" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Gallery onboarding</p>
        <h1 className="mt-2 font-serif text-4xl">Set up your gallery</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tell us the basics. You can refine everything later.</p>
      </header>
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <Field label="Gallery name *" value={name} onChange={setName} required />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="City" value={city} onChange={setCity} />
          <Field label="Country" value={country} onChange={setCountry} />
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">About the gallery</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
        </label>
        <button disabled={saving} className="rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
    </label>
  );
}

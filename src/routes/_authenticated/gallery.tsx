import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getMyGallery, updateMyGallery } from "@/lib/gallery.functions";

export const Route = createFileRoute("/_authenticated/gallery")({
  component: GalleryEdit,
});

function GalleryEdit() {
  const load = useServerFn(getMyGallery);
  const update = useServerFn(updateMyGallery);

  const [slug, setSlug] = useState<string>("");
  const [form, setForm] = useState({
    name: "", city: "", country: "", bio: "",
    website: "", instagram: "", email: "", published: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load().then((g) => {
      if (g) {
        setSlug(g.slug ?? "");
        setForm({
          name: g.name ?? "", city: g.city ?? "", country: g.country ?? "",
          bio: g.bio ?? "", website: g.website ?? "", instagram: g.instagram ?? "",
          email: g.email ?? "", published: g.published ?? true,
        });
      }
    }).finally(() => setLoading(false));
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      await update({ data: form });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Gallery</p>
          <h1 className="mt-2 font-serif text-4xl">{form.name || "Your gallery"}</h1>
          {slug && (
            <Link to="/g/$slug" params={{ slug }} className="mt-2 inline-block text-xs uppercase tracking-widest text-bronze hover:underline">
              View public page → /g/{slug}
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-5 rounded-2xl border border-border bg-card p-6 md:grid-cols-2">
        <Text label="Gallery name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Text label="Contact email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Text label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <Text label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
        <Text label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
        <Text label="Instagram handle" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
        <label className="block md:col-span-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">About</span>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={5}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          <span className="text-sm">Public page is live</span>
        </label>
      </div>

      <button onClick={save} disabled={saving}
        className="rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-bronze focus:outline-none" />
    </label>
  );
}

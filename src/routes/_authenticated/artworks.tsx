import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/storage";
import { useSignedUrl } from "@/lib/use-signed-url";
import { Trash2, Plus, Sparkles, RefreshCw, X, Lock } from "lucide-react";
import { generateArtworkMockup, parseDimensions, VIBES, VIBE_LABELS, DEFAULT_VIBE, type Vibe } from "@/lib/mockup.functions";
import { loadEntitlements, type Entitlements } from "@/lib/entitlements";
import { PricingModal } from "@/components/PricingModal";

export const Route = createFileRoute("/_authenticated/artworks")({
  component: ArtworksPage,
});

type Artwork = {
  id: string;
  image_path: string | null;
  title: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  status: "available" | "sold" | "private";
  price: number | null;
  collection_name: string | null;
  tags: string[] | null;
  width_cm: number | null;
  height_cm: number | null;
  mockup_path: string | null;
  mockups: Record<string, { path: string; hash: string; generated_at: string }> | null;
};

function ArtworksPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<Artwork[]>([]);
  const [creating, setCreating] = useState(false);
  const [mockupFor, setMockupFor] = useState<Artwork | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [showPricing, setShowPricing] = useState(false);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUid(u.user.id);
    const { data } = await supabase.from("artworks").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as Artwork[]);
    setEnt(await loadEntitlements(u.user.id));
  }
  useEffect(() => { load(); }, []);

  function openMockup(a: Artwork) {
    if (!ent?.canUseMockups) { setShowPricing(true); return; }
    setMockupFor(a);
  }

  async function add(file: File) {
    if (!uid) return;
    if (items.length >= 15) { toast.error("Limit of 15 artworks reached."); return; }
    setCreating(true);
    try {
      const path = await uploadImage("artworks", uid, file);
      const { error } = await supabase.from("artworks").insert({ user_id: uid, image_path: path, title: "Untitled" });
      if (error) throw error;
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setCreating(false); }
  }

  async function update(id: string, patch: Partial<Artwork>) {
    setItems((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
    const { error } = await supabase.from("artworks").update(patch as any).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    if (!confirm("Remove this artwork?")) return;
    const { error } = await supabase.from("artworks").delete().eq("id", id);
    if (error) toast.error(error.message); else setItems((p) => p.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Body of Work</p>
          <h1 className="mt-2 font-serif text-4xl">My Artworks</h1>
          <p className="mt-2 text-sm text-muted-foreground">{items.length} of 15 pieces</p>
        </div>
        <label className={`inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs uppercase tracking-widest text-primary-foreground ${creating || items.length >= 15 ? "opacity-50" : "cursor-pointer"}`}>
          <Plus className="size-4" />
          {creating ? "Uploading…" : "Add artwork"}
          <input type="file" accept="image/*" disabled={creating || items.length >= 15} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) add(f); e.target.value = ""; }} />
        </label>
      </header>

      {items.length >= 15 && (
        <div className="rounded-2xl border border-bronze/40 bg-bronze/5 p-4 text-sm">
          You've reached the 15-artwork limit on the current plan. Remove a piece to add a new one.
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
          Upload your first piece to begin.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => <ArtworkCard key={a.id} art={a} locked={!ent?.canUseMockups} onUpdate={(p) => update(a.id, p)} onDelete={() => remove(a.id)} onPreviewRoom={() => openMockup(a)} />)}
        </div>
      )}

      {mockupFor && <MockupModal art={mockupFor} onClose={() => setMockupFor(null)} onSaved={(vibe, path) => {
        setMockupFor((m) => {
          if (!m) return m;
          const nextMockups = { ...(m.mockups ?? {}), [vibe]: { path, hash: "", generated_at: new Date().toISOString() } };
          return { ...m, mockups: nextMockups, mockup_path: vibe === DEFAULT_VIBE ? path : m.mockup_path };
        });
        setItems((prev) => prev.map((x) => {
          if (x.id !== mockupFor.id) return x;
          const nextMockups = { ...(x.mockups ?? {}), [vibe]: { path, hash: "", generated_at: new Date().toISOString() } };
          return { ...x, mockups: nextMockups, mockup_path: vibe === DEFAULT_VIBE ? path : x.mockup_path };
        }));
      }} />}
      <PricingModal open={showPricing} intent="mockups" onClose={() => setShowPricing(false)} returnTo="/artworks" />
    </div>
  );
}

function ArtworkCard({ art, locked, onUpdate, onDelete, onPreviewRoom }: { art: Artwork; locked: boolean; onUpdate: (p: Partial<Artwork>) => void; onDelete: () => void; onPreviewRoom: () => void }) {
  const url = useSignedUrl("artworks", art.image_path);
  const parsed = parseDimensions(art.dimensions);
  const hasDims = (art.width_cm && art.height_cm) || parsed;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="aspect-square bg-secondary">
        {url ? <img src={url} alt={art.title} className="size-full object-cover" /> : null}
      </div>
      <div className="space-y-2 p-4">
        <input value={art.title} onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full border-b border-transparent bg-transparent font-serif text-lg focus:border-bronze focus:outline-none" />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input placeholder="Medium" value={art.medium ?? ""} onChange={(e) => onUpdate({ medium: e.target.value })} className="rounded border border-input bg-background px-2 py-1" />
          <input placeholder='Dimensions e.g. 24 x 36 in' value={art.dimensions ?? ""} onChange={(e) => onUpdate({ dimensions: e.target.value })} className="rounded border border-input bg-background px-2 py-1" />
          <input placeholder="Width (cm)" type="number" step="0.1" value={art.width_cm ?? ""} onChange={(e) => onUpdate({ width_cm: e.target.value ? Number(e.target.value) : null })} className="rounded border border-input bg-background px-2 py-1" />
          <input placeholder="Height (cm)" type="number" step="0.1" value={art.height_cm ?? ""} onChange={(e) => onUpdate({ height_cm: e.target.value ? Number(e.target.value) : null })} className="rounded border border-input bg-background px-2 py-1" />
          <input placeholder="Year" type="number" value={art.year ?? ""} onChange={(e) => onUpdate({ year: e.target.value ? Number(e.target.value) : null })} className="rounded border border-input bg-background px-2 py-1" />
          <input placeholder="Price" type="number" value={art.price ?? ""} onChange={(e) => onUpdate({ price: e.target.value ? Number(e.target.value) : null })} className="rounded border border-input bg-background px-2 py-1" />
          <input placeholder="Collection" value={art.collection_name ?? ""} onChange={(e) => onUpdate({ collection_name: e.target.value })} className="col-span-2 rounded border border-input bg-background px-2 py-1" />
          <select value={art.status} onChange={(e) => onUpdate({ status: e.target.value as Artwork["status"] })} className="rounded border border-input bg-background px-2 py-1">
            <option value="available">Available</option>
            <option value="sold">Sold</option>
            <option value="private">Private</option>
          </select>
          <input placeholder="Tags (comma-sep)" value={art.tags?.join(", ") ?? ""} onChange={(e) => onUpdate({ tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className="rounded border border-input bg-background px-2 py-1" />
        </div>
        {!hasDims && <p className="text-[11px] text-amber-400/80">Add width & height (cm) to enable room preview.</p>}
        <div className="flex items-center justify-between pt-1">
          <button onClick={onPreviewRoom} disabled={!art.image_path || !hasDims} className="inline-flex items-center gap-1 rounded-full border border-teal-400/40 px-3 py-1 text-[11px] uppercase tracking-widest text-teal-300 hover:bg-teal-400/10 disabled:opacity-40" title={locked ? "Available after approval" : undefined}>
            {locked ? <Lock className="size-3" /> : <Sparkles className="size-3" />} {locked ? "Preview in a room · locked" : "Preview in a room"}
          </button>
          <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline">
            <Trash2 className="size-3" /> Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function MockupModal({ art, onClose, onSaved }: { art: Artwork; onClose: () => void; onSaved: (vibe: Vibe, path: string) => void }) {
  const [vibe, setVibe] = useState<Vibe>(DEFAULT_VIBE);
  // Local cache of paths per vibe, seeded from artwork
  const [paths, setPaths] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (art.mockups) for (const [k, v] of Object.entries(art.mockups)) if (v?.path) seed[k] = v.path;
    if (!seed[DEFAULT_VIBE] && art.mockup_path) seed[DEFAULT_VIBE] = art.mockup_path;
    return seed;
  });
  const [busy, setBusy] = useState(false);
  const currentPath = paths[vibe] ?? null;
  const url = useSignedUrl("artworks", currentPath);
  const generate = useServerFn(generateArtworkMockup);

  async function run(force: boolean) {
    setBusy(true);
    try {
      const res = await generate({ data: { artworkId: art.id, vibe, force } });
      setPaths((p) => ({ ...p, [vibe]: res.mockup_path }));
      onSaved(vibe, res.mockup_path);
      if (!res.cached) toast.success(`${VIBE_LABELS[vibe]} mockup generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate mockup");
    } finally { setBusy(false); }
  }

  // Auto-generate when switching to a vibe that has no cached mockup yet.
  useEffect(() => {
    if (!currentPath && !busy) run(false);
    // eslint-disable-next-line
  }, [vibe]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="glass relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-teal-400/20 bg-slate-950/95 p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-white/10"><X className="size-4" /></button>
        <p className="text-[11px] uppercase tracking-[0.3em] text-teal-300">Preview · to scale</p>
        <h3 className="mt-2 font-serif text-2xl">{art.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{art.width_cm}cm × {art.height_cm}cm on a standard 244cm wall</p>

        <div className="mt-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Room vibe</p>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => {
              const has = !!paths[v];
              const active = v === vibe;
              return (
                <button
                  key={v}
                  onClick={() => setVibe(v)}
                  disabled={busy}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${active ? "border-teal-300 bg-teal-400/15 text-teal-100" : "border-white/15 text-muted-foreground hover:border-white/30 hover:text-foreground"}`}
                >
                  <span className={`size-1.5 rounded-full ${has ? "bg-emerald-400" : "bg-white/20"}`} />
                  {VIBE_LABELS[v]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/10 bg-slate-900">
          {busy ? (
            <div className="flex h-full items-center justify-center text-sm text-teal-300 animate-pulse">Composing your {VIBE_LABELS[vibe].toLowerCase()} room…</div>
          ) : url ? (
            <img src={url} alt={`${VIBE_LABELS[vibe]} mockup`} className="size-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No mockup yet for this vibe</div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Each vibe is cached separately — switch freely.</p>
          <button onClick={() => run(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest hover:bg-white/5 disabled:opacity-50">
            <RefreshCw className="size-3" /> Regenerate this vibe
          </button>
        </div>
      </div>
    </div>
  );
}


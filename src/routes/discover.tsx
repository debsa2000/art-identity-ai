import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/use-signed-url";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover Artists — Art Identity AI" },
      { name: "description", content: "Discover professionally presented artists across mediums, styles, and countries." },
      { property: "og:title", content: "Discover Artists — Art Identity AI" },
      { property: "og:description", content: "Discover professionally presented artists across mediums, styles, and countries." },
    ],
  }),
  component: DiscoverPage,
});

type Row = {
  id: string; artist_name: string | null; slug: string; city: string | null; country: string | null;
  medium: string | null; style: string | null; price_range: string | null; featured: boolean;
  avatar_path: string | null; readiness_score: number | null; readiness_level: string | null;
  buyer_ready: boolean; gallery_ready: boolean;
};

function DiscoverPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [medium, setMedium] = useState("");
  const [country, setCountry] = useState("");
  const [style, setStyle] = useState("");
  const [price, setPrice] = useState("");
  const [featOnly, setFeatOnly] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const [collector, setCollector] = useState(false);
  const [gallery, setGallery] = useState(false);

  useEffect(() => { (async () => {
    try {
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id,artist_name,slug,city,country,medium,style,price_range,featured,avatar_path,readiness_score,readiness_level,buyer_network_status,created_at")
        .eq("public_listed", true)
        .eq("published", true);
      if (error) throw error;
      const { data: subs } = await supabase.from("subscriptions").select("user_id,status,current_period_end").eq("product_id", "buyer_network");
      const now = Date.now();
      const activeSet = new Set(((subs ?? []) as any[])
        .filter((s) => ["active", "trialing", "past_due"].includes(s.status) || (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end).getTime() > now))
        .map((s) => s.user_id));
      const enriched = ((profs ?? []) as any[]).map((p) => ({
        ...p,
        buyer_ready: p.buyer_network_status === "approved" && activeSet.has(p.id),
        gallery_ready: (p.readiness_score ?? 0) >= 70,
      })) as (Row & { created_at: string })[];
      enriched.sort((a, b) => Number(b.featured) - Number(a.featured) || (b.readiness_score ?? 0) - (a.readiness_score ?? 0));
      setRows(enriched);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
  })(); }, []);

  const filtered = useMemo(() => {
    let list = (rows ?? []).filter((r) =>
      (!medium || r.medium?.toLowerCase().includes(medium.toLowerCase())) &&
      (!country || r.country?.toLowerCase().includes(country.toLowerCase())) &&
      (!style || r.style?.toLowerCase().includes(style.toLowerCase())) &&
      (!price || (r.price_range ?? "").toLowerCase().includes(price.toLowerCase())) &&
      (!featOnly || r.featured) &&
      (!collector || r.buyer_ready) &&
      (!gallery || r.gallery_ready)
    );
    if (newestFirst) list = [...list].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [rows, medium, country, style, price, featOnly, newestFirst, collector, gallery]);

  return (
    <main className="container-x py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Discover</p>
        <h1 className="mt-3 font-serif text-5xl">Professionally presented artists.</h1>
        <p className="mt-4 text-muted-foreground">Only artists who have opted in to public listing appear here. Filter by medium, country, price, and readiness.</p>
      </header>

      <div className="mt-10 grid gap-3 md:grid-cols-4">
        <input placeholder="Medium" value={medium} onChange={(e) => setMedium(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <input placeholder="Style" value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <input placeholder="Price range" value={price} onChange={(e) => setPrice(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={featOnly} onChange={(e) => setFeatOnly(e.target.checked)} /> Featured</label>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={newestFirst} onChange={(e) => setNewestFirst(e.target.checked)} /> Newest first</label>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={collector} onChange={(e) => setCollector(e.target.checked)} /> Collector ready</label>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} /> Gallery ready</label>
      </div>

      {err ? (
        <div className="mt-16 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">{err}</div>
      ) : rows === null ? (
        <div className="mt-16 text-center text-sm text-muted-foreground">Loading artists…</div>
      ) : rows.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
          No public listings yet. Artists can opt in from Profile → List publicly.
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => <ArtistCard key={r.id} r={r} />)}
          </div>
          {filtered.length === 0 && <p className="mt-16 text-center text-muted-foreground">No artists match those filters.</p>}
        </>
      )}
    </main>
  );
}

function ArtistCard({ r }: { r: Row }) {
  const avatar = useSignedUrl("avatars", r.avatar_path);
  return (
    <Link to="/a/$slug" params={{ slug: r.slug }} className={`group rounded-2xl border p-6 transition hover:border-bronze ${r.featured ? "border-bronze bg-card ring-1 ring-bronze/30" : "border-border bg-card"}`}>
      <div className="flex items-center gap-4">
        <div className="size-16 overflow-hidden rounded-full bg-secondary">
          {avatar && <img src={avatar} alt="" className="size-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="font-serif text-xl truncate">{r.artist_name || "Untitled artist"}</p>
          <p className="text-xs text-muted-foreground">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {r.featured && <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground">Featured</span>}
        {r.buyer_ready && <span className="rounded-full bg-bronze px-2 py-1 text-bronze-foreground">Collector Ready</span>}
        {r.gallery_ready && <span className="rounded-full border border-bronze px-2 py-1 text-bronze">Gallery Ready</span>}
        {r.medium && <span className="rounded-full bg-secondary px-2 py-1">{r.medium}</span>}
        {r.style && <span className="rounded-full bg-secondary px-2 py-1">{r.style}</span>}
        {r.readiness_score != null && <span className="rounded-full bg-secondary px-2 py-1">{r.readiness_score}/100 · {r.readiness_level ?? ""}</span>}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">View portfolio →</p>
    </Link>
  );
}

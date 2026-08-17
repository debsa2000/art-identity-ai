import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/use-signed-url";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "Artist Directory — Art Identity AI" },
      { name: "description", content: "Discover artists across mediums, styles, and countries — vetted and curated." },
      { property: "og:title", content: "Artist Directory — Art Identity AI" },
      { property: "og:description", content: "Discover artists across mediums, styles, and countries." },
    ],
  }),
  component: Directory,
});

type Row = { id: string; artist_name: string | null; slug: string; city: string | null; country: string | null; medium: string | null; style: string | null; commission_available: boolean; featured: boolean; avatar_path: string | null; buyer_network: boolean };

function Directory() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [medium, setMedium] = useState("");
  const [style, setStyle] = useState("");
  const [commOnly, setCommOnly] = useState(false);
  const [featOnly, setFeatOnly] = useState(false);

  useEffect(() => { (async () => {
    try {
      const { data: profs, error } = await supabase
        .from("public_profiles")
        .select("id,artist_name,slug,city,country,medium,style,commission_available,featured,avatar_path,buyer_network_status");
      if (error) throw error;
      const { data: subs } = await supabase.from("subscriptions").select("user_id,status,current_period_end,product_id").eq("product_id", "buyer_network");
      const activeSet = new Set(
        (subs ?? [])
          .filter((s: any) => ["active", "trialing", "past_due"].includes(s.status) || (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end) > new Date()))
          .map((s: any) => s.user_id)
      );
      // Buyer Network badge only when approved AND active subscription
      const enriched = ((profs ?? []) as any[]).map((p) => ({
        ...p,
        buyer_network: p.buyer_network_status === "approved" && activeSet.has(p.id),
      })) as Row[];
      enriched.sort((a, b) => Number(b.buyer_network) - Number(a.buyer_network) || Number(b.featured) - Number(a.featured));
      setRows(enriched);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load directory");
    }
  })(); }, []);

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!country || r.country?.toLowerCase().includes(country.toLowerCase())) &&
    (!medium || r.medium?.toLowerCase().includes(medium.toLowerCase())) &&
    (!style || r.style?.toLowerCase().includes(style.toLowerCase())) &&
    (!commOnly || r.commission_available) &&
    (!featOnly || r.featured)
  ), [rows, country, medium, style, commOnly, featOnly]);

  return (
    <main className="container-x py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Directory</p>
        <h1 className="mt-3 font-serif text-5xl">A curated register of artists.</h1>
        <p className="mt-4 text-muted-foreground">Approved Buyer Network members appear first. Filter by medium, style, country, and commissions.</p>
      </header>

      <div className="mt-10 grid gap-3 md:grid-cols-5">
        <input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <input placeholder="Medium" value={medium} onChange={(e) => setMedium(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <input placeholder="Style" value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-full border border-input bg-background px-4 py-2 text-sm" />
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={commOnly} onChange={(e) => setCommOnly(e.target.checked)} /> Commissions</label>
        <label className="flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm"><input type="checkbox" checked={featOnly} onChange={(e) => setFeatOnly(e.target.checked)} /> Featured</label>
      </div>

      {err ? (
        <div className="mt-16 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">{err}</div>
      ) : rows === null ? (
        <div className="mt-16 text-center text-sm text-muted-foreground">Loading artists…</div>
      ) : rows.length === 0 ? (
        <div className="mt-16 rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
          The directory is still being curated. Check back soon.
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
    <Link to="/a/$slug" params={{ slug: r.slug }} className={`group rounded-2xl border p-6 transition hover:border-bronze ${r.buyer_network ? "border-bronze bg-card ring-1 ring-bronze/30" : "border-border bg-card"}`}>
      <div className="flex items-center gap-4">
        <div className="size-16 overflow-hidden rounded-full bg-secondary">
          {avatar && <img src={avatar} alt="" className="size-full object-cover" />}
        </div>
        <div>
          <p className="font-serif text-xl">{r.artist_name || "Untitled artist"}</p>
          <p className="text-xs text-muted-foreground">{[r.city, r.country].filter(Boolean).join(", ") || "—"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {r.buyer_network && <span className="rounded-full bg-bronze px-2 py-1 text-bronze-foreground">Buyer Network</span>}
        {r.medium && <span className="rounded-full bg-secondary px-2 py-1">{r.medium}</span>}
        {r.style && <span className="rounded-full bg-secondary px-2 py-1">{r.style}</span>}
        {r.commission_available && <span className="rounded-full border border-bronze px-2 py-1 text-bronze">Commissions</span>}
        {r.featured && <span className="rounded-full bg-primary px-2 py-1 text-primary-foreground">Featured</span>}
      </div>
    </Link>
  );
}

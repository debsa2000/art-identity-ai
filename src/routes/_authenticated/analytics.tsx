import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [stats, setStats] = useState({ site: 0, art: 0, dl: 0, inq: 0 });
  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [site, art, dl, inq] = await Promise.all([
      supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("artist_id", u.user.id).eq("event_type", "site_view"),
      supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("artist_id", u.user.id).eq("event_type", "artwork_view"),
      supabase.from("analytics_events").select("id", { count: "exact", head: true }).eq("artist_id", u.user.id).eq("event_type", "portfolio_download"),
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("artist_id", u.user.id),
    ]);
    setStats({ site: site.count ?? 0, art: art.count ?? 0, dl: dl.count ?? 0, inq: inq.count ?? 0 });
  })(); }, []);

  const items = [
    { label: "Website views", v: stats.site },
    { label: "Artwork views", v: stats.art },
    { label: "Portfolio downloads", v: stats.dl },
    { label: "Inquiries received", v: stats.inq },
  ];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.3em] text-bronze">Signals</p>
        <h1 className="mt-2 font-serif text-4xl">Analytics</h1>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="mt-3 font-serif text-4xl">{s.v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

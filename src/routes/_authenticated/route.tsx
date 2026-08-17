import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const ARTIST_ONLY_PATHS = new Set<string>([
  "/dashboard", "/profile", "/artworks", "/studio", "/website",
  "/portfolio", "/resume", "/membership", "/inquiries", "/analytics",
]);

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });

    // Detect gallery role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const isGallery = (roles ?? []).some((r) => (r.role as string) === "gallery");

    if (isGallery) {
      if (location.pathname !== "/gallery-onboarding" && location.pathname !== "/settings") {
        const { data: g } = await supabase.from("galleries").select("name").eq("id", data.user.id).maybeSingle();
        if (!g || !(g.name ?? "").trim()) throw redirect({ to: "/gallery-onboarding" });
        // Redirect gallery users away from artist-only sections to their gallery hub.
        if (ARTIST_ONLY_PATHS.has(location.pathname)) throw redirect({ to: "/gallery" });
      }
    } else {
      // Artist onboarding gate: force new users through /onboarding until artist_name is set.
      if (location.pathname !== "/onboarding" && location.pathname !== "/settings" && location.pathname !== "/gallery-onboarding") {
        const { data: prof } = await supabase.from("profiles").select("artist_name").eq("id", data.user.id).maybeSingle();
        const name = (prof?.artist_name ?? "").trim();
        if (!name) throw redirect({ to: "/onboarding" });
      }
    }
    return { user: data.user, isGallery };
  },
  component: Layout,
});

const ARTIST_NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/profile", label: "Profile" },
  { to: "/artworks", label: "Artworks" },
  { to: "/studio", label: "AI Studio" },
  { to: "/website", label: "Website" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/resume", label: "Resume / CV" },
  { to: "/membership", label: "Buyer Network" },
  { to: "/inquiries", label: "Inquiries" },
  { to: "/analytics", label: "Analytics" },
  { to: "/settings", label: "Settings" },
] as const;

const GALLERY_NAV = [
  { to: "/gallery", label: "Gallery" },
  { to: "/directory", label: "Discover artists" },
  { to: "/settings", label: "Settings" },
] as const;

function Layout() {
  const router = useRouter();
  const { isGallery } = Route.useRouteContext();
  const NAV = isGallery ? GALLERY_NAV : ARTIST_NAV;
  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  }
  return (
    <div className="container-x grid gap-10 py-10 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="md:sticky md:top-24 md:self-start">
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-secondary" }}
              className="rounded-full px-4 py-2 text-sm transition"
            >{item.label}</Link>
          ))}
          <Link to="/admin" className="mt-2 rounded-full px-4 py-2 text-xs uppercase tracking-widest text-bronze hover:bg-secondary">Admin</Link>
          <button onClick={signOut} className="mt-4 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary md:text-left">Sign out</button>
        </nav>
      </aside>
      <div className="min-w-0"><Outlet /></div>
    </div>
  );
}

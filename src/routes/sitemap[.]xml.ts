import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const base = new URL(request.url).origin;
        const { data } = await supabase.from("profiles").select("slug,updated_at").eq("published", true);
        const staticPaths = ["/", "/directory", "/auth"];
        const urls = [
          ...staticPaths.map((p) => `<url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`),
          ...((data ?? []).map((r) => `<url><loc>${base}/a/${r.slug}</loc><lastmod>${new Date(r.updated_at).toISOString()}</lastmod><changefreq>weekly</changefreq></url>`)),
        ].join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
} as never);


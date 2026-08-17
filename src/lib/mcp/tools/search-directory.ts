import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Public read of the public_profiles view — anon-safe columns only.
function supabasePublic() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_directory",
  title: "Search public artist directory",
  description:
    "Search the public Art Identity AI artist directory. Returns published, publicly listed artists — name, slug, city/country, medium, and public page URL.",
  inputSchema: {
    query: z.string().trim().max(120).optional().describe("Match against name, city, or medium."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query, limit }) => {
    const sb = supabasePublic();
    let q = sb
      .from("public_profiles")
      .select("slug, artist_name, city, country, medium, style")
      .order("artist_name", { ascending: true })
      .limit(limit ?? 20);
    if (query && query.length > 0) {
      const like = `%${query}%`;
      q = q.or(`artist_name.ilike.${like},city.ilike.${like},medium.ilike.${like}`);
    }
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = (data ?? []).map((r) => ({
      ...r,
      url: `https://artidentityai.rashmisuthar.com/a/${r.slug}`,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { artists: rows },
    };
  },
});

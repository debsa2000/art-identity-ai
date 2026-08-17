import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseAsUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_artwork",
  title: "Create artwork",
  description:
    "Create a new artwork on the signed-in artist's profile. Fifteen-artwork cap is enforced server-side.",
  inputSchema: {
    title: z.string().trim().min(1).max(200),
    medium: z.string().trim().max(200).optional(),
    year: z.number().int().min(1800).max(2100).optional(),
    width_cm: z.number().positive().optional(),
    height_cm: z.number().positive().optional(),
    depth_cm: z.number().positive().optional(),
    price: z.number().nonnegative().optional(),
    currency: z.string().length(3).optional().describe("ISO 4217, e.g. USD"),
    description: z.string().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseAsUser(ctx);
    const { data, error } = await sb
      .from("artworks")
      .insert({ ...input, user_id: ctx.getUserId() })
      .select("id, title, medium, year")
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created artwork ${data?.id}` }],
      structuredContent: { artwork: data },
    };
  },
});

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
  name: "update_my_profile",
  title: "Update my profile",
  description:
    "Update editable fields on the signed-in artist's profile. Only provided fields are changed.",
  inputSchema: {
    artist_name: z.string().trim().min(1).max(120).optional(),
    bio: z.string().max(4000).optional(),
    city: z.string().max(120).optional(),
    country: z.string().max(120).optional(),
    medium: z.string().max(200).optional(),
    style: z.string().max(200).optional(),
    instagram: z.string().max(120).optional(),
    price_range: z.string().max(120).optional(),
    exhibitions: z.string().max(4000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(patch).length === 0)
      return { content: [{ type: "text", text: "No fields provided." }], isError: true };
    const sb = supabaseAsUser(ctx);
    const { data, error } = await sb
      .from("profiles")
      .update(patch)
      .eq("id", ctx.getUserId())
      .select("id, artist_name, completion_percent, application_status")
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});

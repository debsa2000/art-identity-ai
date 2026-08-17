import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const inputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(2000),
  })).min(1).max(20),
});

export const chatWithAria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabase, userId } = context;

    const [{ data: profile }, { count: artworkCount }, { data: q }, { data: ai }] = await Promise.all([
      supabase.from("profiles").select("artist_name,slug,published,medium,city,country,instagram").eq("id", userId).maybeSingle(),
      supabase.from("artworks").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("questionnaires").select("q1").eq("user_id", userId).maybeSingle(),
      supabase.from("ai_content").select("artist_statement").eq("user_id", userId).maybeSingle(),
    ]);

    const stateSummary = [
      `Artist: ${profile?.artist_name ?? "(not set)"}`,
      `Location: ${[profile?.city, profile?.country].filter(Boolean).join(", ") || "(not set)"}`,
      `Medium: ${profile?.medium ?? "(not set)"}`,
      `Instagram: ${profile?.instagram ?? "(not connected)"}`,
      `Artworks uploaded: ${artworkCount ?? 0} / 15`,
      `Questionnaire started: ${q ? "yes" : "no"}`,
      `AI statement generated: ${ai?.artist_statement ? "yes" : "no"}`,
      `Website published: ${profile?.published ? "yes" : "no"}`,
    ].join("\n");

    const system = `You are Aria — the in-house curator and guide for Art Identity AI. Voice: elegant, warm, precise, editorial. Never use emojis or exclamation marks. Keep replies under 90 words. You proactively suggest the artist's next step based on their current progress:
- If artworks < 3 → invite them to upload 3–5 pieces (link: /artworks).
- Else if questionnaire not started → invite them into the AI Studio (link: /studio).
- Else if no AI statement → generate their statement in the Studio.
- Else if website not published → preview and publish their site (link: /website).
- Else → offer the Portfolio PDF (/portfolio) or Buyer Network (/membership).
When you reference a next step, phrase it as a short suggestion and mention the destination in plain words (e.g. "in the Artworks room"). Do not invent facts about the artist.

Current studio state:
${stateSummary}`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Aria is resting — please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
      throw new Error(`Aria error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content ?? "";
    return { reply };
  });

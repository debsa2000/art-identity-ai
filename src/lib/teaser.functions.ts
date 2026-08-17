import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const inputSchema = z.object({}).optional();

export const runFreeTeaser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d ?? {}))
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("artist_name,city,country,medium,style,instagram,free_teaser_used")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Profile missing");
    if ((profile as any).free_teaser_used) {
      throw new Error("You've already used your free AI preview.");
    }

    const { data: artworks } = await supabase
      .from("artworks")
      .select("title,medium,year,tags")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(5);

    const persona = [
      `Artist name: ${(profile as any).artist_name ?? "Untitled artist"}`,
      `Location: ${[(profile as any).city, (profile as any).country].filter(Boolean).join(", ") || "Not provided"}`,
      `Medium: ${(profile as any).medium ?? "Not specified"}`,
      `Style: ${(profile as any).style ?? "Not specified"}`,
      "",
      "Recently uploaded pieces:",
      ...(artworks ?? []).map((a: any, i: number) => `${i + 1}. ${a.title ?? "Untitled"}${a.medium ? ` — ${a.medium}` : ""}`),
    ].join("\n");

    const system = `You are a senior curator and art writer at a luxury contemporary gallery. Write with elegance, restraint, and a distinctive editorial voice. No clichés, no emojis, no salesy language. Reply strictly as JSON.`;
    const user = `Write a free preview of a professional artist biography based only on the details below. Keep it evocative but grounded — the artist has just uploaded their first pieces so infer sensitively, never invent exhibitions or awards.

${persona}

Return JSON of this exact shape:
{
  "short_bio": "60-90 word third-person biography, publication-ready",
  "instagram_bio": "under 150 characters, first person, no hashtags",
  "homepage_line": "one evocative sentence under 18 words for a website hero"
}`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached — please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace billing.");
      throw new Error(`AI error ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { short_bio?: string; instagram_bio?: string; homepage_line?: string };
    try { parsed = JSON.parse(content); }
    catch { throw new Error("AI returned invalid JSON"); }

    // Mark teaser as used server-side so it can't be repeated.
    await supabase.from("profiles").update({ free_teaser_used: true } as any).eq("id", userId);

    return {
      ok: true,
      short_bio: parsed.short_bio ?? "",
      instagram_bio: parsed.instagram_bio ?? "",
      homepage_line: parsed.homepage_line ?? "",
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const inputSchema = z.object({});

export const generateArtistContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data ?? {}))
  .handler(async ({ context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabase, userId } = context;

    const [{ data: profile }, { data: q }, { data: artworks }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("questionnaires").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("artworks").select("id,title,medium,dimensions,year,description,tags").eq("user_id", userId),
    ]);

    if (!profile) throw new Error("Profile missing");
    if (!q) throw new Error("Please answer the 6 questions first.");
    const anyQ = q as any;
    const missing = ["q1","q2","q3","q4","q5","q6"].filter((k) => !(anyQ[k] ?? "").toString().trim());
    if (missing.length) throw new Error("Please answer all 6 questions before generating.");

    const persona = [
      `Artist name: ${(profile as any).artist_name ?? ""}`,
      `Location: ${[(profile as any).city, (profile as any).country].filter(Boolean).join(", ") || "Not provided"}`,
      `Medium: ${(profile as any).medium ?? "Not specified"}`,
      `Style: ${(profile as any).style ?? "Not specified"}`,
      "",
      "The artist's own answers to six core questions:",
      `1. What draws you to make art? ${anyQ.q1 ?? ""}`,
      `2. Recurring themes or subjects in your work? ${anyQ.q2 ?? ""}`,
      `3. Your materials and process? ${anyQ.q3 ?? ""}`,
      `4. What makes your work distinct? ${anyQ.q4 ?? ""}`,
      `5. The feeling you want viewers to take away? ${anyQ.q5 ?? ""}`,
      `6. Where do you want your work to go next? ${anyQ.q6 ?? ""}`,
    ].join("\n");

    const system = `You are a senior curator and art writer for a luxury gallery. Write with elegance, restraint, and a distinctive editorial voice. Never use clichés, emojis, or salesy language. Reply in strict JSON matching the requested schema.`;

    const artworksList = (artworks ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      medium: a.medium,
      dimensions: a.dimensions,
      year: a.year,
      tags: a.tags,
    }));

    const user = `Generate a complete written identity for this artist. Use the artist's own voice and details below.

${persona}

Artworks to describe (write 2–3 sentence museum-label descriptions for each, referring to title):
${JSON.stringify(artworksList, null, 2)}

Return JSON with this exact shape:
{
  "artist_statement": "3-4 paragraph professional artist statement, first person",
  "short_statement": "60-80 word condensed statement, first person",
  "biography": "3 paragraph third-person biography",
  "instagram_bio": "under 150 chars, first person, no hashtags",
  "homepage_copy": "1 evocative sentence for a website hero, under 20 words",
  "collection_description": "one paragraph describing the arc of the artist's body of work",
  "seo_description": "under 155 chars, natural language, third person",
  "elevator_pitch": "2 sentence spoken pitch, first person",
  "artwork_descriptions": [ { "id": "<uuid>", "description": "..." } ]
}`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
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
    let parsed: any;
    try { parsed = JSON.parse(content); }
    catch { throw new Error("AI returned invalid JSON"); }

    // Save AI content
    await supabase.from("ai_content").upsert({
      user_id: userId,
      artist_statement: parsed.artist_statement ?? null,
      short_statement: parsed.short_statement ?? null,
      biography: parsed.biography ?? null,
      instagram_bio: parsed.instagram_bio ?? null,
      homepage_copy: parsed.homepage_copy ?? null,
      collection_description: parsed.collection_description ?? null,
      seo_description: parsed.seo_description ?? null,
      elevator_pitch: parsed.elevator_pitch ?? null,
      generated_at: new Date().toISOString(),
    });

    // Save artwork descriptions
    if (Array.isArray(parsed.artwork_descriptions)) {
      for (const a of parsed.artwork_descriptions) {
        if (a?.id && a?.description) {
          await supabase.from("artworks").update({ description: a.description }).eq("id", a.id).eq("user_id", userId);
        }
      }
    }

    return { ok: true };
  });

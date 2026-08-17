import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeCompletion } from "./admin.functions";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.1-flash-lite";

function levelFor(score: number): string {
  if (score >= 85) return "Collector Ready";
  if (score >= 70) return "Gallery Ready";
  if (score >= 50) return "Emerging Professional";
  if (score >= 30) return "In Development";
  return "Getting Started";
}

/**
 * Compute the Professional Readiness Score for an artist.
 * - Deterministic base from profile completeness + AI content presence.
 * - AI-assisted qualitative recommendations (cached in profile).
 * Callable by:
 *   - the artist themselves (compute my own), or
 *   - an admin / super admin (compute for anyone).
 */
export const computeReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ artistId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const target = data.artistId ?? userId;

    if (target !== userId) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const set = new Set(((roles ?? []) as any[]).map((r) => r.role));
      if (!set.has("admin") && !set.has("super_admin")) throw new Error("Forbidden");
    }

    const [{ data: profile }, { data: arts }, { data: ai }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", target).maybeSingle(),
      supabase.from("artworks").select("id,title,description,price,medium,dimensions").eq("user_id", target),
      supabase.from("ai_content").select("*").eq("user_id", target).maybeSingle(),
    ]);
    if (!profile) throw new Error("Profile not found");

    const artworkCount = (arts ?? []).length;
    const base = computeCompletion(profile, artworkCount, ai);

    // Qualitative pass — safe if AI is unavailable, we fall back to base score + rule-based tips.
    const rec: string[] = [];
    if (!profile.avatar_path) rec.push("Upload a professional profile photo.");
    if (!profile.artist_name) rec.push("Add your artist name.");
    if (!profile.medium || !profile.style) rec.push("Specify your primary medium and style.");
    if (artworkCount < 6) rec.push(`Upload at least ${6 - artworkCount} more artworks to reach a portfolio-worthy count.`);
    if (!ai?.artist_statement || ai.artist_statement.length < 200) rec.push("Generate or expand your artist statement.");
    if (!ai?.biography || ai.biography.length < 200) rec.push("Complete your biography.");
    const priceMissing = ((arts ?? []) as any[]).filter((a) => !a.price).length;
    if (priceMissing > 0) rec.push(`Set prices on the remaining ${priceMissing} artwork${priceMissing === 1 ? "" : "s"}.`);
    if (!profile.website) rec.push("Add a personal website link.");
    if (!profile.instagram) rec.push("Connect your Instagram handle.");
    if (!profile.exhibitions) rec.push("List past exhibitions or shows to strengthen your CV.");

    let aiScoreDelta = 0;
    let aiRec: string[] = [];
    try {
      const key = process.env.LOVABLE_API_KEY;
      if (key && ai?.artist_statement) {
        const payload = {
          artist_name: profile.artist_name,
          medium: profile.medium,
          style: profile.style,
          statement_length: (ai.artist_statement ?? "").length,
          biography_length: (ai.biography ?? "").length,
          artwork_count: artworkCount,
          sample_titles: ((arts ?? []) as any[]).slice(0, 5).map((a) => a.title),
        };
        const res = await fetch(GATEWAY, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: "system", content: "You are a senior gallery curator judging an artist's professional readiness. Reply ONLY with strict JSON: {\"score_adjustment\": number between -10 and +10, \"recommendations\": string[]} — up to 4 concise, high-signal recommendations to improve buyer-readiness and gallery-readiness. No preamble." },
              { role: "user", content: JSON.stringify(payload) },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
          if (typeof parsed.score_adjustment === "number") aiScoreDelta = Math.max(-10, Math.min(10, parsed.score_adjustment));
          if (Array.isArray(parsed.recommendations)) aiRec = parsed.recommendations.slice(0, 4).map(String);
        }
      }
    } catch {
      // ignore — deterministic score still applies
    }

    const score = Math.max(0, Math.min(100, base + aiScoreDelta));
    const level = levelFor(score);
    const recommendations = [...aiRec, ...rec].slice(0, 8);

    await supabase.from("profiles").update({
      readiness_score: score,
      readiness_level: level,
      readiness_recommendations: recommendations,
      readiness_updated_at: new Date().toISOString(),
    }).eq("id", target);

    return { score, level, recommendations, base, aiScoreDelta };
  });

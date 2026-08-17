import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const MODEL = "google/gemini-3.1-flash-image";

export const VIBES = [
  "modern_minimalist",
  "scandinavian",
  "industrial_loft",
  "bohemian",
  "traditional_classic",
  "gallery_white_cube",
] as const;
export type Vibe = (typeof VIBES)[number];
export const DEFAULT_VIBE: Vibe = "modern_minimalist";

export const VIBE_LABELS: Record<Vibe, string> = {
  modern_minimalist: "Modern Minimalist",
  scandinavian: "Scandinavian",
  industrial_loft: "Industrial Loft",
  bohemian: "Bohemian",
  traditional_classic: "Traditional / Classic",
  gallery_white_cube: "Gallery White Cube",
};

export const VIBE_PROMPTS: Record<Vibe, string> = {
  modern_minimalist:
    "A serene modern minimalist living room. Off-white lime-plaster walls, wide oak plank flooring, a low-profile boucle sofa in warm ivory positioned well below and to one side of the feature wall, a small sculptural travertine side table off to the far side. Palette: bone, warm greige, muted taupe, soft black accents. Vast floor-to-ceiling window (on the opposite or side wall, not the feature wall) with sheer linen drapes diffusing golden-hour sunlight; long soft shadows fall across the floor.",
  scandinavian:
    "A bright Scandinavian living room with white-washed pine floors, matte white walls, a cognac leather lounge chair set off to one side and pushed back from the feature wall, pale wool throw, a small birch side table in the far corner. Palette: chalk white, birch, oat, muted sage, warm cognac. Overcast Nordic daylight from a side window, soft even shadows. Any greenery (a small potted plant) sits in a background corner, never near the feature wall.",
  industrial_loft:
    "A converted industrial loft, restrained and gallery-like. Exposed red brick feature wall left almost entirely clear, polished concrete floor, black steel-framed factory windows on a side wall. A single distressed leather Chesterfield sofa placed low and well back from the feature wall on one side of the frame; a slim reclaimed timber console with an unlit Edison-bulb lamp tucked into a far corner. No pipes, ducts, shelving, tools or clutter on or near the feature wall. Palette: charcoal, rust, oxidized brass, cognac leather, warm smoke. Directional afternoon light rakes across the brick, casting soft shadows.",
  bohemian:
    "A calm, edited bohemian sitting room — warm and textured but uncluttered. Terracotta feature wall kept clear; a vintage Moroccan rug in faded rose and indigo on the floor, a low rattan lounge chair set off to one side and pulled back from the wall, a folded macramé throw over its arm. Any plants (a single trailing pothos or a fiddle-leaf fig) sit in the far background corner or opposite side, never in front of or crowding the feature wall. Palette: sun-baked terracotta, saffron, indigo, olive, aged brass. Late afternoon sunlight filtered through gauzy curtains on a side window.",
  traditional_classic:
    "A refined classical drawing room. Panelled walls in soft dove grey, herringbone oak parquet, a tufted velvet sofa in deep emerald sitting low and set back from the feature wall, an antique walnut console tucked to one side with a porcelain lamp and small vase of peonies. Palette: dove grey, emerald, antique gold, cream. Warm tungsten lamplight blended with soft window light from a side wall; polished, museum-quality finish. Nothing else hangs on or overlaps the feature wall.",
  gallery_white_cube:
    "A pristine contemporary gallery white cube. Seamless matte white walls, pale polished concrete floor, a single low reclaimed-oak bench placed well back and off-center from the feature wall, no other artworks. Palette: pure white, cool grey shadow, warm oak. Museum-grade track lighting casting a soft, even wash on the wall with a subtle warm pool around the artwork; long clean shadow from the bench.",
};

// Parse a free-text dimensions string like "24 x 36 in", "60x90 cm", "24\" x 36\""
// Returns cm, or null if not parseable.
export function parseDimensions(text: string | null | undefined): { width_cm: number; height_cm: number } | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(cm|in|inch|inches|"|”)?/i);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  const unit = (m[3] || "").toLowerCase();
  const toCm = unit === "cm" ? 1 : 2.54;
  return { width_cm: +(w * toCm).toFixed(1), height_cm: +(h * toCm).toFixed(1) };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const inputSchema = z.object({
  artworkId: z.string().uuid(),
  vibe: z.enum(VIBES).optional(),
  force: z.boolean().optional(),
});

export const generateArtworkMockup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { artworkId, force } = data;
    const vibe: Vibe = data.vibe ?? DEFAULT_VIBE;

    const { data: art, error } = await supabase.from("artworks").select("*").eq("id", artworkId).eq("user_id", userId).maybeSingle();
    if (error || !art) throw new Error("Artwork not found");

    const a = art as any;
    let widthCm: number | null = a.width_cm ?? null;
    let heightCm: number | null = a.height_cm ?? null;
    if (!widthCm || !heightCm) {
      const parsed = parseDimensions(a.dimensions);
      if (parsed) { widthCm = parsed.width_cm; heightCm = parsed.height_cm; }
    }
    // During onboarding, artworks may not yet have dimensions. Fall back to a
    // reasonable medium canvas so the preview mockup still renders.
    if (!widthCm || !heightCm) { widthCm = 60; heightCm = 90; }
    if (!a.image_path) throw new Error("Artwork image is missing");

    const hash = await sha256Hex(`${a.image_path}|${widthCm}x${heightCm}|${vibe}`);
    const mockups: Record<string, { path: string; hash: string; generated_at: string }> = (a.mockups && typeof a.mockups === "object") ? a.mockups : {};
    const cached = mockups[vibe];

    // Legacy single-mockup fallback: promote to default vibe if hashes align
    if (!cached && vibe === DEFAULT_VIBE && a.mockup_path && a.mockup_source_hash) {
      // best-effort only — don't reuse if hash differs
    }

    if (!force && cached && cached.hash === hash) {
      return { ok: true, cached: true, vibe, mockup_path: cached.path };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage.from("artworks").download(a.image_path);
    if (dlErr || !fileBlob) throw new Error("Failed to load artwork image");
    const buf = new Uint8Array(await fileBlob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = fileBlob.type || "image/jpeg";

    const wallH = 244;
    const relH = Math.min(1, heightCm / wallH);
    const scaleWord = relH < 0.2 ? "small (a petite study)" : relH < 0.4 ? "modest" : relH < 0.6 ? "medium" : relH < 0.8 ? "large statement piece" : "monumental";

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const sceneDescription = VIBE_PROMPTS[vibe];

    const prompt = `Editorial magazine-quality interior design photograph — full-frame 35mm look, medium format quality, published in Architectural Digest. Photorealistic, not a render.

SCENE: ${sceneDescription}

ARTWORK PLACEMENT: Composite the provided artwork precisely onto the main feature wall. DO NOT redraw, restyle, recolor, reframe, or reinterpret it — preserve its exact colors, composition, edges and framing pixel-accurately.

ARTWORK IS THE HERO (non-negotiable): the artwork is the single largest, most prominent, best-lit object in the frame and the unambiguous focal point of the composition. It must be fully visible and completely unobstructed — no furniture, plants, lamps, sculptures, people, or decor may overlap, cross in front of, or crowd its frame. Maintain a generous clear buffer of empty wall around the piece on all sides (at least ~40cm of bare wall on every side of the frame). No tall furniture, foliage, floor lamps, or accessories directly beneath or immediately flanking the artwork; keep such objects pushed to the sides or background of the frame. The eye must land on the artwork first, before any furniture or styling.

REAL-WORLD SCALE (critical): the artwork is exactly ${widthCm}cm wide × ${heightCm}cm tall. Use the room's architecture as measurement anchors — a standard 203cm interior door and 244cm ceiling height. The piece should read as ${scaleWord} on the wall — roughly ${Math.round(relH * 100)}% of the wall height. A small piece MUST look small; a large canvas MUST look large. Hang center at ~145cm from floor to artwork center (gallery standard).

LIGHTING: premium natural window light as the key, warm interior fill as accent, with the brightest, cleanest light landing on the artwork itself. Soft directional shadows behind and beneath the frame; a subtle contact shadow at the wall-frame edge; realistic ambient occlusion in room corners.

CAMERA: 35mm f/2.8 look, shallow depth of field — the artwork is tack-sharp and centered as the compositional anchor; any furniture in the foreground falls gently out of focus. Slight film grain, natural color science, no HDR crunch, no over-sharpening.

FINAL SCALE CHECK (do not skip, regardless of room style): the framed artwork on the wall measures exactly ${widthCm}cm × ${heightCm}cm — approximately ${Math.round(relH * 100)}% of the 244cm wall height and proportional to the 203cm door in the scene. This dimension is identical across every room vibe; the surrounding décor changes, the artwork's real-world size does not. Re-verify before finalizing.

STRICTLY AVOID: cartoon or 3D-render look, plastic textures, flat even lighting, symmetrical dead-center framing, generic hotel-room feel, extra artworks on the walls, furniture or plants placed in front of or crowding the artwork, foreground objects overlapping the frame, the artwork appearing small or secondary to the furniture, any text, watermarks, logos, or UI overlays.`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
        ] }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const msg = res.status === 429 ? "AI rate limit reached — please try again shortly."
        : res.status === 402 ? "AI credits exhausted. Add credits in workspace billing."
        : `AI error ${res.status}: ${body.slice(0, 300)}`;
      await supabase.from("artworks").update({ mockup_error: msg } as any).eq("id", artworkId);
      throw new Error(msg);
    }
    const json = await res.json();
    const outB64: string | undefined = json?.data?.[0]?.b64_json;
    if (!outB64) throw new Error("AI returned no image");

    const binOut = atob(outB64);
    const out = new Uint8Array(binOut.length);
    for (let i = 0; i < binOut.length; i++) out[i] = binOut.charCodeAt(i);

    const path = `${userId}/mockups/${artworkId}-${vibe}.png`;
    const { error: upErr } = await supabaseAdmin.storage.from("artworks").upload(path, out, {
      contentType: "image/png", upsert: true, cacheControl: "3600",
    });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const nextMockups = { ...mockups, [vibe]: { path, hash, generated_at: new Date().toISOString() } };
    const patch: any = {
      mockups: nextMockups,
      mockup_error: null,
      width_cm: widthCm,
      height_cm: heightCm,
    };
    // Keep legacy fields in sync for the default vibe so the PDF flow keeps working.
    if (vibe === DEFAULT_VIBE) {
      patch.mockup_path = path;
      patch.mockup_source_hash = hash;
      patch.mockup_generated_at = new Date().toISOString();
    }
    await supabase.from("artworks").update(patch).eq("id", artworkId);

    return { ok: true, cached: false, vibe, mockup_path: path };
  });

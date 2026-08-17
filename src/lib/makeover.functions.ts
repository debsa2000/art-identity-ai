import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { VIBES, VIBE_PROMPTS, parseDimensions, type Vibe } from "./mockup.functions";

const CHAT_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_GATEWAY = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODEL = "google/gemini-3.1-flash-image";
const BIO_MODEL = "google/gemini-3-flash-preview";

// Three visually distinct vibes so the trio feels like different homes, not variations of the same room.
const MAKEOVER_VIBES: Vibe[] = ["modern_minimalist", "industrial_loft", "bohemian"];

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// -------- create session (image already uploaded to storage) --------

export const createMakeoverSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      image_path: z.string().min(1),
      device_fp: z.string().max(128).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limit: 3 per device_fp per 7 days
    if (data.device_fp) {
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("makeover_sessions")
        .select("id", { count: "exact", head: true })
        .eq("device_fp", data.device_fp)
        .gte("created_at", since);
      if ((count ?? 0) >= 3) {
        throw new Error("You've used your 3 free makeovers this week. Create an account to keep going.");
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from("makeover_sessions")
      .insert({
        image_path: data.image_path,
        device_fp: data.device_fp ?? null,
        status: "pending",
      } as never)
      .select("id, claim_token")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to create session");

    // Analytics (nullable artist_id ok? existing schema likely requires it — best-effort insert)
    try {
      await supabaseAdmin.from("analytics_events").insert({
        artist_id: (row as any).id,
        event_type: "makeover_started",
        ref_id: (row as any).id,
      } as never);
    } catch { /* non-fatal */ }

    return { sessionId: (row as any).id as string, claimToken: (row as any).claim_token as string };
  });

// -------- save answers --------

export const updateMakeoverAnswers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      sessionId: z.string().uuid(),
      claimToken: z.string().min(1),
      artist_name: z.string().max(120).optional(),
      title: z.string().max(200),
      medium: z.string().max(200),
      dimensions: z.string().max(120).optional(),
      description: z.string().max(600),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parsed = parseDimensions(data.dimensions);
    const { error } = await supabaseAdmin
      .from("makeover_sessions")
      .update({
        artist_name: data.artist_name?.trim() || "The Artist",
        title: data.title,
        medium: data.medium,
        dimensions: data.dimensions ?? null,
        width_cm: parsed?.width_cm ?? null,
        height_cm: parsed?.height_cm ?? null,
        description: data.description,
      } as never)
      .eq("id", data.sessionId)
      .eq("claim_token", data.claimToken);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- run makeover: fires renders + bio + score in parallel --------

async function renderMockup(sessionId: string, vibe: Vibe, imagePath: string, widthCm: number, heightCm: number, key: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage.from("artworks").download(imagePath);
  if (dlErr || !fileBlob) throw new Error("Failed to load artwork");
  const buf = new Uint8Array(await fileBlob.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  const mime = fileBlob.type || "image/jpeg";

  const wallH = 244;
  const relH = Math.min(1, heightCm / wallH);
  const scaleWord = relH < 0.2 ? "small" : relH < 0.4 ? "modest" : relH < 0.6 ? "medium" : relH < 0.8 ? "large statement piece" : "monumental";
  const scene = VIBE_PROMPTS[vibe];

  const prompt = `Editorial magazine-quality interior photograph, Architectural Digest published. Photorealistic.

SCENE: ${scene}

ARTWORK PLACEMENT: Composite the provided artwork precisely onto the main feature wall. Do NOT redraw, restyle, recolor or reframe it. Preserve exact colors, composition, and framing pixel-accurately.

ARTWORK IS THE HERO: single largest, best-lit, unambiguous focal point. Fully visible, unobstructed, generous clear buffer of empty wall on all sides. No furniture, plants, lamps overlapping or crowding it.

FRAMING — CLOSE-UP INTIMATE VIEW: medium-close shot, camera pulled in near the wall so the artwork occupies roughly 55–65% of the frame height and is the immediate subject. Show a tight, intimate slice of the room — just enough of the surrounding wall, floor edge, and one or two nearby styling details to convey the vibe. Do NOT render a wide full-room establishing shot; keep the feeling close, editorial, and detail-rich.

REAL-WORLD SCALE: exactly ${widthCm}cm × ${heightCm}cm, roughly ${Math.round(relH * 100)}% of a 244cm wall height. Should read as ${scaleWord}. Hang center ~145cm from floor.

CAMERA: 35mm f/2.8, shallow DoF, artwork tack-sharp; slight film grain, natural color, no HDR crunch.

STRICTLY AVOID: cartoon/3D look, extra artworks on walls, foreground objects crossing the frame, wide full-room shots, text, watermarks, logos.`;

  const res = await fetch(IMAGE_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ] }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const json = await res.json();
  const outB64: string | undefined = json?.data?.[0]?.b64_json;
  if (!outB64) throw new Error("no image");

  const binOut = atob(outB64);
  const out = new Uint8Array(binOut.length);
  for (let i = 0; i < binOut.length; i++) out[i] = binOut.charCodeAt(i);

  const hash = await sha256Hex(`${imagePath}|${widthCm}x${heightCm}|${vibe}`);
  const path = `makeover/${sessionId}/mockup-${vibe}.png`;
  const { error: upErr } = await supabaseAdmin.storage.from("artworks").upload(path, out, {
    contentType: "image/png", upsert: true, cacheControl: "3600",
  });
  if (upErr) throw new Error(upErr.message);

  // Merge into mockups jsonb
  const { data: cur } = await supabaseAdmin.from("makeover_sessions").select("mockups").eq("id", sessionId).maybeSingle();
  const mockups = { ...((cur as any)?.mockups ?? {}), [vibe]: { path, hash, generated_at: new Date().toISOString() } };
  await supabaseAdmin.from("makeover_sessions").update({ mockups } as never).eq("id", sessionId);
}

function scoreFor(session: any): { score: number; sub: any; insights: any[] } {
  // Deterministic base + calibration to land 55–80
  let presentation = 55;
  let story = 55;
  let market = 55;

  if (session.dimensions) presentation += 10;
  if (session.width_cm && session.height_cm) presentation += 10;
  if ((session.description ?? "").length > 80) story += 15;
  if ((session.description ?? "").length > 200) story += 10;
  if (session.title && session.title.length > 3) story += 5;
  if (session.artist_name && session.artist_name !== "The Artist") market += 10;
  if (session.medium && session.medium.length > 3) market += 8;

  presentation = Math.min(85, presentation);
  story = Math.min(85, story);
  market = Math.min(80, market);
  const score = Math.round((presentation + story + market) / 3);

  const insights = [
    {
      label: "Presentation",
      value: presentation,
      insight: session.width_cm ? "Dimensions in place — collectors can imagine the scale." : "Add dimensions so collectors see the scale.",
      tip: "Photograph your work straight-on in daylight; frame edges parallel to the photo edges.",
    },
    {
      label: "Story",
      value: story,
      insight: (session.description ?? "").length > 120 ? "Your voice is coming through." : "One more sentence about the work would tighten your story.",
      tip: "Describe not just the subject but what you were feeling or chasing when you made it.",
    },
    {
      label: "Market Signals",
      value: market,
      insight: session.artist_name && session.artist_name !== "The Artist" ? "Named artist reads as intentional." : "Add your artist name to build recognition.",
      tip: "Complete a full profile with 10 works to unlock buyer-network visibility.",
    },
  ];
  return { score, sub: { presentation, story, market }, insights };
}

async function generateBio(session: any, key: string): Promise<string> {
  const persona = [
    `Artist: ${session.artist_name ?? "The Artist"}`,
    `Work title: ${session.title ?? ""}`,
    `Medium: ${session.medium ?? ""}`,
    `Dimensions: ${session.dimensions ?? "unspecified"}`,
    `Artist's note: ${session.description ?? ""}`,
  ].join("\n");
  const res = await fetch(CHAT_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: BIO_MODEL,
      messages: [
        { role: "system", content: "You are Aria, a senior curator at a luxury contemporary gallery. Write with restraint, elegance, and specificity. No clichés, no emojis, no salesy phrasing. Reply as JSON." },
        { role: "user", content: `From the notes below, write a 60–80 word third-person biographical snippet suitable for a website or gallery card. Only infer from what's given; do not invent exhibitions or awards.\n\n${persona}\n\nReturn JSON: { "bio": "..." }` },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`bio ${res.status}`);
  const json = await res.json();
  try { return JSON.parse(json.choices?.[0]?.message?.content ?? "{}").bio ?? ""; }
  catch { return ""; }
}

export const runMakeover = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), claimToken: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabaseAdmin
      .from("makeover_sessions").select("*").eq("id", data.sessionId).maybeSingle();
    if (!session || (session as any).claim_token !== data.claimToken) throw new Error("Invalid session");
    const s = session as any;

    const widthCm = s.width_cm ?? 60;
    const heightCm = s.height_cm ?? 90;

    // Bio + score first (fast). Then kick mockups in parallel with 90s timeout each.
    const bioPromise = generateBio(s, key).catch(() => "");
    const { score, sub, insights } = scoreFor(s);
    const bio = await bioPromise;

    await supabaseAdmin.from("makeover_sessions").update({
      bio, score, sub_scores: sub, insights,
    } as never).eq("id", data.sessionId);

    // Fire mockups in parallel; allow partial success.
    const withTimeout = <T,>(p: Promise<T>, ms: number) =>
      Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

    const results = await Promise.allSettled(
      MAKEOVER_VIBES.map((v) => withTimeout(renderMockup(data.sessionId, v, s.image_path, widthCm, heightCm, key), 90_000)),
    );
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    const status = okCount === MAKEOVER_VIBES.length ? "ready" : okCount > 0 ? "partial" : "failed";
    await supabaseAdmin.from("makeover_sessions").update({ status } as never).eq("id", data.sessionId);

    try {
      await supabaseAdmin.from("analytics_events").insert({
        artist_id: data.sessionId, event_type: "makeover_completed", ref_id: data.sessionId,
      } as never);
    } catch { /* non-fatal */ }

    return { ok: true, status, mockupsReady: okCount };
  });

// -------- read session (public) --------

export const getMakeoverSession = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("makeover_sessions")
      .select("id, artist_name, title, medium, dimensions, description, image_path, mockups, bio, score, sub_scores, insights, status, created_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!row) return null;
    const r = row as any;

    // Signed URLs for the image and each mockup
    const bucket = supabaseAdmin.storage.from("artworks");
    const [{ data: img }] = await Promise.all([bucket.createSignedUrl(r.image_path, 3600 * 24)]);
    const mockupUrls: Record<string, string> = {};
    for (const [vibe, meta] of Object.entries<any>(r.mockups ?? {})) {
      const { data: u } = await bucket.createSignedUrl(meta.path, 3600 * 24);
      if (u?.signedUrl) mockupUrls[vibe] = u.signedUrl;
    }

    return {
      id: r.id,
      artist_name: r.artist_name,
      title: r.title,
      medium: r.medium,
      dimensions: r.dimensions,
      description: r.description,
      image_url: img?.signedUrl ?? null,
      mockups: mockupUrls,
      bio: r.bio,
      score: r.score,
      sub_scores: r.sub_scores,
      insights: r.insights,
      status: r.status,
    };
  });

// -------- fallback email capture --------

export const saveMakeoverFallbackEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), email: z.string().email() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("makeover_sessions").update({ fallback_email: data.email } as never).eq("id", data.sessionId);
    try {
      await supabaseAdmin.from("leads").insert({ email: data.email, source: "makeover_fallback" } as never);
    } catch { /* leads schema may vary — non-fatal */ }
    return { ok: true };
  });

// -------- attach session to newly-signed-up account --------

export const attachMakeover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sessionId: z.string().uuid(), claimToken: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: sess } = await supabaseAdmin
      .from("makeover_sessions").select("*").eq("id", data.sessionId).maybeSingle();
    if (!sess) throw new Error("Session not found");
    const s = sess as any;
    if (s.claim_token !== data.claimToken) throw new Error("Invalid claim token");
    if (s.claimed_by) return { ok: true, alreadyClaimed: true };

    // Copy original image
    const bucket = supabaseAdmin.storage.from("artworks");
    const artworkId = crypto.randomUUID();
    const ext = (s.image_path.split(".").pop() ?? "jpg").toLowerCase();
    const newImagePath = `${userId}/${artworkId}.${ext}`;

    const { data: origBlob } = await bucket.download(s.image_path);
    if (origBlob) {
      const buf = new Uint8Array(await origBlob.arrayBuffer());
      await bucket.upload(newImagePath, buf, { contentType: origBlob.type || "image/jpeg", upsert: true });
    }

    // Copy each mockup
    const newMockups: Record<string, any> = {};
    for (const [vibe, meta] of Object.entries<any>(s.mockups ?? {})) {
      const { data: mb } = await bucket.download(meta.path);
      if (!mb) continue;
      const mp = `${userId}/mockups/${artworkId}-${vibe}.png`;
      const buf = new Uint8Array(await mb.arrayBuffer());
      await bucket.upload(mp, buf, { contentType: "image/png", upsert: true });
      newMockups[vibe] = { path: mp, hash: meta.hash, generated_at: meta.generated_at };
    }

    // Insert artwork
    await supabaseAdmin.from("artworks").insert({
      id: artworkId,
      user_id: userId,
      title: s.title ?? "Untitled",
      medium: s.medium ?? null,
      dimensions: s.dimensions ?? null,
      width_cm: s.width_cm ?? null,
      height_cm: s.height_cm ?? null,
      description: s.description ?? null,
      image_path: newImagePath,
      mockups: newMockups,
    } as never);

    // Pre-fill profile artist_name if empty
    if (s.artist_name && s.artist_name !== "The Artist") {
      const { data: p } = await supabaseAdmin.from("profiles").select("artist_name").eq("id", userId).maybeSingle();
      if (!(p as any)?.artist_name) {
        await supabaseAdmin.from("profiles").update({ artist_name: s.artist_name } as never).eq("id", userId);
      }
    }

    // Pre-fill questionnaire q3 (materials/process) from description if empty
    if (s.description) {
      const { data: q } = await supabaseAdmin.from("questionnaires").select("*").eq("user_id", userId).maybeSingle();
      if (!q) {
        await supabaseAdmin.from("questionnaires").insert({ user_id: userId, q3: s.description } as never);
      } else if (!(q as any).q3) {
        await supabaseAdmin.from("questionnaires").update({ q3: s.description } as never).eq("user_id", userId);
      }
    }

    await supabaseAdmin.from("makeover_sessions").update({
      claimed_by: userId, claimed_at: new Date().toISOString(),
    } as never).eq("id", data.sessionId);

    try {
      await supabaseAdmin.from("analytics_events").insert({
        artist_id: userId, event_type: "signup_from_makeover", ref_id: data.sessionId,
      } as never);
    } catch { /* non-fatal */ }

    return { ok: true };
  });

// Suppress unused import warning
export const _vibes = VIBES;

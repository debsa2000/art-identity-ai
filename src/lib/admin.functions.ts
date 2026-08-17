import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Helpers ----------

async function assertAdmin(supabase: any, userId: string): Promise<{ isAdmin: boolean; isSuper: boolean }> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = new Set<string>((data ?? []).map((r: any) => r.role));
  const isAdmin = roles.has("admin") || roles.has("super_admin");
  const isSuper = roles.has("super_admin");
  if (!isAdmin) throw new Error("Forbidden: admin access required");
  return { isAdmin, isSuper };
}

// Deterministic profile completion 0-100
export function computeCompletion(p: any, artworkCount: number, aiContent: any | null): number {
  const checks: Array<[boolean, number]> = [
    [!!(p?.artist_name && p.artist_name.trim()), 8],
    [!!p?.avatar_path, 8],
    [!!(p?.city || p?.country), 4],
    [!!p?.medium, 4],
    [!!p?.style, 4],
    [!!p?.instagram, 4],
    [!!p?.website, 4],
    [!!p?.price_range, 4],
    [!!(p?.years_creating && p.years_creating > 0), 4],
    [!!(p?.exhibitions && p.exhibitions.trim()), 6],
    [artworkCount >= 6, 12],
    [artworkCount >= 12, 6],
    [!!(aiContent?.artist_statement && aiContent.artist_statement.length > 200), 10],
    [!!(aiContent?.biography && aiContent.biography.length > 200), 8],
    [!!p?.published, 8],
    [!!(p?.cv && (Array.isArray((p.cv as any)?.education) || Array.isArray((p.cv as any)?.exhibitions))), 6],
  ];
  const score = checks.reduce((n, [ok, w]) => n + (ok ? w : 0), 0);
  return Math.min(100, score);
}

// ---------- Overview stats ----------

export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const now = Date.now();
    const dayMs = 86_400_000;
    const [{ data: profs }, { data: subs }] = await Promise.all([
      supabase.from("profiles").select("id,created_at,last_login_at,readiness_score,featured,published,buyer_network_status,public_listed"),
      supabase.from("subscriptions").select("user_id,status,current_period_end").eq("product_id", "buyer_network"),
    ]);
    const profiles = (profs ?? []) as any[];
    const activeSubIds = new Set(
      ((subs ?? []) as any[])
        .filter((s) => ["active", "trialing", "past_due"].includes(s.status) || (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end).getTime() > now))
        .map((s) => s.user_id),
    );
    const active7 = profiles.filter((p) => p.last_login_at && now - new Date(p.last_login_at).getTime() < 7 * dayMs).length;
    const newSignups7 = profiles.filter((p) => p.created_at && now - new Date(p.created_at).getTime() < 7 * dayMs).length;
    const scores = profiles.map((p) => p.readiness_score).filter((v) => typeof v === "number") as number[];
    const buyerReady = profiles.filter((p) => p.buyer_network_status === "approved" && activeSubIds.has(p.id)).length;
    const pendingReview = profiles.filter((p) => p.buyer_network_status === "pending_review").length;
    const featured = profiles.filter((p) => p.featured).length;
    const recent = [...profiles]
      .filter((p) => p.last_login_at)
      .sort((a, b) => new Date(b.last_login_at).getTime() - new Date(a.last_login_at).getTime())
      .slice(0, 8)
      .map((p) => ({ id: p.id, last_login_at: p.last_login_at }));

    return {
      totalArtists: profiles.length,
      newSignups7,
      activeUsers7: active7,
      avgCompletion: 0, // computed on-demand in Directory tab (per-row)
      avgReadiness: scores.length ? Math.round(scores.reduce((n, s) => n + s, 0) / scores.length) : 0,
      buyerReady,
      pendingReview,
      featured,
      recentActive: recent,
      publicListed: profiles.filter((p) => p.public_listed).length,
    };
  });

// ---------- Directory (admin) ----------

export const listArtistsForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [{ data: profs }, { data: arts }, { data: ai }, { data: subs }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("artworks").select("user_id"),
      supabase.from("ai_content").select("user_id,artist_statement,biography"),
      supabase.from("subscriptions").select("user_id,status,current_period_end").eq("product_id", "buyer_network"),
    ]);

    const artCounts = new Map<string, number>();
    for (const a of (arts ?? []) as any[]) artCounts.set(a.user_id, (artCounts.get(a.user_id) ?? 0) + 1);
    const aiMap = new Map<string, any>();
    for (const c of (ai ?? []) as any[]) aiMap.set(c.user_id, c);
    const now = Date.now();
    const activeSubIds = new Set(
      ((subs ?? []) as any[])
        .filter((s) => ["active", "trialing", "past_due"].includes(s.status) || (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end).getTime() > now))
        .map((s) => s.user_id),
    );

    return ((profs ?? []) as any[]).map((p) => {
      const count = artCounts.get(p.id) ?? 0;
      const completion = computeCompletion(p, count, aiMap.get(p.id) ?? null);
      return {
        id: p.id,
        artist_name: p.artist_name,
        slug: p.slug,
        email: p.email,
        country: p.country,
        medium: p.medium,
        style: p.style,
        years_creating: p.years_creating,
        avatar_path: p.avatar_path,
        created_at: p.created_at,
        last_login_at: p.last_login_at,
        featured: p.featured,
        published: p.published,
        public_listed: p.public_listed,
        buyer_network_status: p.buyer_network_status,
        buyer_ready: p.buyer_network_status === "approved" && activeSubIds.has(p.id),
        artwork_count: count,
        completion,
        readiness_score: p.readiness_score,
        readiness_level: p.readiness_level,
      };
    });
  });

// ---------- Artist detail ----------

export const getArtistDetailForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ artistId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: p }, { data: arts }, { data: ai }, { data: cvRow }, { data: reviews }, { data: activity }, { data: q }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.artistId).maybeSingle(),
      supabase.from("artworks").select("*").eq("user_id", data.artistId).order("sort_order"),
      supabase.from("ai_content").select("*").eq("user_id", data.artistId).maybeSingle(),
      supabase.from("profiles").select("cv").eq("id", data.artistId).maybeSingle(),
      supabase.from("profile_section_reviews").select("*").eq("artist_id", data.artistId),
      supabase.from("analytics_events").select("event_type,created_at").eq("artist_id", data.artistId).order("created_at", { ascending: false }).limit(200),
      supabase.from("questionnaires").select("*").eq("user_id", data.artistId).maybeSingle(),
    ]);
    if (!p) throw new Error("Artist not found");
    const artworkCount = (arts ?? []).length;
    const completion = computeCompletion(p, artworkCount, ai);
    return {
      profile: p,
      artworks: arts ?? [],
      aiContent: ai ?? null,
      cv: (cvRow as any)?.cv ?? null,
      reviews: reviews ?? [],
      activity: activity ?? [],
      questionnaire: q ?? null,
      computed: { artworkCount, completion },
    };
  });

// ---------- Section reviews ----------

export const upsertSectionReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    artistId: z.string().uuid(),
    section: z.string().min(1),
    status: z.enum(["pending", "approved", "needs_changes", "rejected"]),
    admin_notes: z.string().optional().nullable(),
    artist_feedback: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("profile_section_reviews").upsert({
      artist_id: data.artistId,
      section: data.section,
      status: data.status,
      admin_notes: data.admin_notes ?? null,
      artist_feedback: data.artist_feedback ?? null,
      reviewer_id: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "artist_id,section" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Featured (super admin) + moderation ----------

export const setArtistFeatured = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ artistId: z.string().uuid(), featured: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isSuper } = await assertAdmin(supabase, userId);
    if (!isSuper) throw new Error("Forbidden: super admin only");
    const { error } = await supabase.from("profiles").update({ featured: data.featured }).eq("id", data.artistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setArtworkModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    artworkId: z.string().uuid(),
    admin_status: z.enum(["pending", "approved", "hidden", "rejected"]).optional(),
    featured: z.boolean().optional(),
    admin_notes: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const patch: any = {};
    if (data.admin_status !== undefined) patch.admin_status = data.admin_status;
    if (data.featured !== undefined) patch.featured = data.featured;
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("artworks").update(patch).eq("id", data.artworkId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Notifications ----------

export const listAdminNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: notes }, { data: profs }] = await Promise.all([
      supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,artist_name,slug"),
    ]);
    const map = new Map(((profs ?? []) as any[]).map((p) => [p.id, p]));
    return ((notes ?? []) as any[]).map((n) => ({
      ...n,
      artist: n.artist_id ? map.get(n.artist_id) ?? null : null,
    }));
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("admin_notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin artwork feed ----------

export const listAllArtworksForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [{ data: arts }, { data: profs }] = await Promise.all([
      supabase.from("artworks").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id,artist_name,slug"),
    ]);
    const map = new Map(((profs ?? []) as any[]).map((p) => [p.id, p]));
    return ((arts ?? []) as any[]).map((a) => ({ ...a, artist: map.get(a.user_id) ?? null }));
  });

// ---------- CSV export (super admin) ----------

export const exportArtistsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { isSuper } = await assertAdmin(supabase, userId);
    if (!isSuper) throw new Error("Forbidden: super admin only");
    const { data } = await supabase.from("profiles").select("id,artist_name,email,country,medium,style,years_creating,readiness_score,buyer_network_status,featured,published,public_listed,created_at,last_login_at");
    const rows = (data ?? []) as any[];
    const cols = ["id", "artist_name", "email", "country", "medium", "style", "years_creating", "readiness_score", "buyer_network_status", "featured", "published", "public_listed", "created_at", "last_login_at"];
    const esc = (v: any) => v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    return { csv };
  });

// ---------- Track last login ----------

export const touchLastLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
    return { ok: true };
  });

// ---------- Applications queue ----------

export const listApplications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(["submitted", "approved", "rejected", "draft", "all"]).default("submitted") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    let q = supabase.from("profiles").select("id,artist_name,slug,email,instagram,website,city,country,medium,style,avatar_path,application_status,completion_percent,created_at,application_submitted_at,application_reviewed_at,application_review_notes,years_creating");
    if (data.status !== "all") q = q.eq("application_status", data.status);
    const { data: rows, error } = await q.order("completion_percent", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    artistId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    notes: z.string().max(2000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("profiles").update({
      application_status: data.decision,
      application_reviewed_at: new Date().toISOString(),
      application_reviewed_by: userId,
      application_review_notes: data.notes ?? null,
    }).eq("id", data.artistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

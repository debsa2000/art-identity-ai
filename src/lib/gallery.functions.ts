import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "gallery";
}

/** Grant the signed-in user the `gallery` role and create their galleries row (idempotent). */
export const becomeGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name?: string }) => z.object({ name: z.string().max(120).optional() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Add role (idempotent). Use admin to bypass user_roles insert restrictions.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "gallery" as never }, { onConflict: "user_id,role", ignoreDuplicates: true });

    // Ensure a galleries row exists
    const { data: existing } = await supabase.from("galleries").select("id, slug").eq("id", userId).maybeSingle();
    if (existing) return { ok: true, slug: existing.slug };

    const desired = data.name?.trim() || "gallery";
    const baseSlug = slugify(desired);
    let slug = baseSlug;
    let n = 0;
    // find unique slug
    while (true) {
      const { data: hit } = await supabaseAdmin.from("galleries").select("id").eq("slug", slug).maybeSingle();
      if (!hit) break;
      n += 1;
      slug = `${baseSlug}-${n}`;
    }

    const { error } = await supabase.from("galleries").insert({ id: userId, slug, name: data.name ?? null });
    if (error) throw new Error(error.message);
    return { ok: true, slug };
  });

export const getMyGallery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("galleries")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const updateSchema = z.object({
  name: z.string().max(120).optional(),
  city: z.string().max(120).optional().nullable(),
  country: z.string().max(120).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  logo_path: z.string().max(500).optional().nullable(),
  published: z.boolean().optional(),
});

export const updateMyGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("galleries")
      .update({ ...data })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public read for /g/$slug. Uses anon publishable client — RLS filters to published=true. */
export const getPublicGallery = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await supa
      .from("public_galleries")
      .select("slug, name, city, country, bio, logo_path, website, instagram")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? { ...row, email: null as string | null } : null;
  });

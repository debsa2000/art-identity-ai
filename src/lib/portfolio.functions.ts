import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Atomically consume one portfolio credit for the calling user.
 * Returns true when a credit was consumed, false otherwise.
 */
export const consumePortfolioCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("portfolio_credits")
      .select("purchased, used")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !data) return false;
    if (data.purchased <= data.used) return false;
    const { error: updErr } = await supabaseAdmin
      .from("portfolio_credits")
      .update({ used: data.used + 1, updated_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("used", data.used); // optimistic concurrency
    return !updErr;
  });

/**
 * Public: number of onboarded artists (artist_name set). Used by the "first 100 free" banner.
 */
export const getOnboardingCount = createServerFn({ method: "GET" }).handler(async (): Promise<number> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("artist_name", "is", null)
    .neq("artist_name", "");
  return count ?? 0;
});

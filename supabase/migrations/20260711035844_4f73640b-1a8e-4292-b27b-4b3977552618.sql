
-- 1) Restrict SECURITY DEFINER trigger-only functions from anon/authenticated/PUBLIC
REVOKE EXECUTE ON FUNCTION public.tg_enforce_publish_entitlement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_buyer_network_pending() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_admin_on_verify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_artwork_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 2) Tighten user-callable SECURITY DEFINER functions: revoke from anon where signed-in only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_buyer_network(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_publish_entitlement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_portfolio_credit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.completed_onboarding_count() FROM PUBLIC;
-- landing page needs unauthenticated count; keep anon/authenticated

-- Ensure explicit grants where needed
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_portfolio_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.completed_onboarding_count() TO anon, authenticated;

-- 3) Fix always-true RLS policies by requiring caller identity/scoping
-- analytics_events: drop duplicate/permissive insert policies, replace with scoped
DROP POLICY IF EXISTS "Anyone logs event" ON public.analytics_events;
DROP POLICY IF EXISTS "Auth logs event" ON public.analytics_events;
CREATE POLICY "Anon logs event scoped" ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (artist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = artist_id AND p.published = true));
CREATE POLICY "Auth logs event scoped" ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (artist_id IS NOT NULL);

-- inquiries: drop always-true insert policies, replace with scoped
DROP POLICY IF EXISTS "Anyone can submit inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Auth can submit inquiry" ON public.inquiries;
CREATE POLICY "Anon submits inquiry to published" ON public.inquiries
  FOR INSERT TO anon
  WITH CHECK (artist_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = artist_id AND p.published = true));
CREATE POLICY "Auth submits inquiry" ON public.inquiries
  FOR INSERT TO authenticated
  WITH CHECK (artist_id IS NOT NULL);

-- leads: drop duplicate always-true insert policies, replace with scoped
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
DROP POLICY IF EXISTS "anyone can submit a lead" ON public.leads;
DROP POLICY IF EXISTS "admins can read leads" ON public.leads; -- duplicate SELECT
CREATE POLICY "Submit a lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) > 3 AND length(email) < 320);

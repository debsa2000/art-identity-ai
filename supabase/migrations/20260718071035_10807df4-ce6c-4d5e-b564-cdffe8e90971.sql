
-- Trigger-only functions: never callable via API
REVOKE ALL ON FUNCTION public.enforce_artwork_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_buyer_network_pending() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_enforce_publish_entitlement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_on_verify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_profile_on_artwork_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compute_profile_completion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_profile_on_questionnaire_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Internal entitlement helpers: only invoked from within other SECURITY DEFINER
-- functions/triggers (which run as the definer, not the caller) and from server
-- code holding the service_role. Revoke direct API execute access.
REVOKE ALL ON FUNCTION public.has_active_buyer_network(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_publish_entitlement(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_approved_application(uuid) FROM PUBLIC, anon, authenticated;

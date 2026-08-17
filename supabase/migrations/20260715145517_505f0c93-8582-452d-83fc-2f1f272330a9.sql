-- Restore EXECUTE on helper functions used inside RLS policies.
-- Policies are evaluated in the CALLER's context, so authenticated must be able
-- to execute helper functions referenced by USING/WITH CHECK, even when those
-- functions are SECURITY DEFINER. Without this, every profile insert/update/select
-- fails with "permission denied for function has_role", blocking profile creation.

GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_approved_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_buyer_network(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_publish_entitlement(uuid) TO authenticated;
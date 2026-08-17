REVOKE EXECUTE ON FUNCTION public.has_active_buyer_network(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_approved_application(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_publish_entitlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_buyer_network(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_approved_application(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_publish_entitlement(uuid) TO service_role;
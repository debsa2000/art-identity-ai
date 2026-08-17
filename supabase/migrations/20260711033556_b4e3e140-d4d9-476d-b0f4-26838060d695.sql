
-- Server-side enforcement: only allow profiles.published = true when user has
-- an active Resume+Website bundle purchase or approved Buyer Network membership.

CREATE OR REPLACE FUNCTION public.has_publish_entitlement(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Buyer Network active + approved
    public.has_active_buyer_network(_user_id, 'sandbox')
    OR public.has_active_buyer_network(_user_id, 'live')
    -- Or unused resume+website bundle credit
    OR EXISTS (
      SELECT 1 FROM public.portfolio_credits
      WHERE user_id = _user_id
        AND resume_bundle_purchased > resume_bundle_used
    );
$$;

REVOKE ALL ON FUNCTION public.has_publish_entitlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_publish_entitlement(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_enforce_publish_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Only enforce on transition to published = true
  IF NEW.published IS TRUE AND (TG_OP = 'INSERT' OR OLD.published IS DISTINCT FROM NEW.published) THEN
    IF NOT public.has_publish_entitlement(NEW.id) THEN
      RAISE EXCEPTION 'Publishing requires the Resume + Website bundle ($47) or an approved Buyer Network membership.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_publish_entitlement ON public.profiles;
CREATE TRIGGER enforce_publish_entitlement
  BEFORE INSERT OR UPDATE OF published ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_publish_entitlement();

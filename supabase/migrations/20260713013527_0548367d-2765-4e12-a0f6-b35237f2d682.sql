
-- 1. Private schema for internal helpers
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;
-- (deliberately NOT granting to anon)

-- 2. Move has_role into app_private
CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3. Recreate every policy that referenced public.has_role, pointing at app_private.has_role
-- user_roles
DROP POLICY IF EXISTS "Admins see all roles" ON public.user_roles;
CREATE POLICY "Admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Owner or admin read profile" ON public.profiles;
CREATE POLICY "Owner or admin read profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((auth.uid() = id) OR app_private.has_role(auth.uid(), 'admin'));

-- artworks
DROP POLICY IF EXISTS "Admins manage artworks" ON public.artworks;
CREATE POLICY "Admins manage artworks" ON public.artworks
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- inquiries
DROP POLICY IF EXISTS "Admins manage inquiries" ON public.inquiries;
CREATE POLICY "Admins manage inquiries" ON public.inquiries
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- analytics_events
DROP POLICY IF EXISTS "Admins read analytics" ON public.analytics_events;
CREATE POLICY "Admins read analytics" ON public.analytics_events
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));

-- refunds
DROP POLICY IF EXISTS "Users see own refunds" ON public.refunds;
CREATE POLICY "Users see own refunds" ON public.refunds
  FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) OR app_private.has_role(auth.uid(), 'admin'));

-- leads
DROP POLICY IF EXISTS "Admins can view leads" ON public.leads;
CREATE POLICY "Admins can view leads" ON public.leads
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'admin'));

-- 4. Update definer functions that referenced public.has_role
CREATE OR REPLACE FUNCTION public.tg_enforce_publish_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF app_private.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.published IS TRUE AND (TG_OP = 'INSERT' OR OLD.published IS DISTINCT FROM NEW.published) THEN
    IF NOT public.has_publish_entitlement(NEW.id) THEN
      RAISE EXCEPTION 'Publishing requires the Resume + Website bundle ($47) or an approved Buyer Network membership.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Drop the exposed helpers now that nothing in the DB references them
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.consume_portfolio_credit(uuid);
DROP FUNCTION IF EXISTS public.completed_onboarding_count();

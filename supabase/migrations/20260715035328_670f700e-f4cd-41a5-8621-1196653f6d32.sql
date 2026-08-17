
-- Super admin allowlist
CREATE TABLE IF NOT EXISTS public.super_admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.super_admin_emails TO service_role;
ALTER TABLE public.super_admin_emails ENABLE ROW LEVEL SECURITY;
-- Deny-all for client roles (no policies grant access).
CREATE POLICY "no_client_access" ON public.super_admin_emails FOR SELECT TO authenticated USING (false);

-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_listed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS readiness_score int,
  ADD COLUMN IF NOT EXISTS readiness_level text,
  ADD COLUMN IF NOT EXISTS readiness_recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS readiness_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Artwork moderation
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- Section review records
CREATE TABLE IF NOT EXISTS public.profile_section_reviews (
  artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  artist_feedback text,
  reviewer_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, section)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_section_reviews TO authenticated;
GRANT ALL ON public.profile_section_reviews TO service_role;
ALTER TABLE public.profile_section_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read section reviews"
  ON public.profile_section_reviews FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins insert section reviews"
  ON public.profile_section_reviews FOR INSERT TO authenticated
  WITH CHECK (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update section reviews"
  ON public.profile_section_reviews FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins delete section reviews"
  ON public.profile_section_reviews FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

-- Admin notifications
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  artist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notifications"
  ON public.admin_notifications FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins update notifications"
  ON public.admin_notifications FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

-- Extend handle_new_user for super_admin allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  base_slug text;
  final_slug text;
  n int := 0;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  base_slug := regexp_replace(lower(coalesce(display_name, 'artist')), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'artist'; end if;
  final_slug := base_slug;
  while exists (select 1 from public.profiles where slug = final_slug) loop
    n := n + 1;
    final_slug := base_slug || '-' || n::text;
  end loop;

  insert into public.profiles (id, slug, artist_name, email)
  values (new.id, final_slug, display_name, new.email);

  insert into public.user_roles (user_id, role) values (new.id, 'artist');

  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;

  if new.email_confirmed_at is not null
     and exists (select 1 from public.super_admin_emails where lower(email) = lower(new.email)) then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin')
    on conflict do nothing;
  end if;

  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.grant_admin_on_verify()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email is distinct from new.email) then
    if exists (select 1 from public.admin_emails where lower(email) = lower(new.email)) then
      insert into public.user_roles (user_id, role) values (new.id, 'admin')
      on conflict do nothing;
    end if;
    if exists (select 1 from public.super_admin_emails where lower(email) = lower(new.email)) then
      insert into public.user_roles (user_id, role) values (new.id, 'super_admin')
      on conflict do nothing;
    end if;
  end if;
  return new;
end $function$;

-- Admin-or-super helper (private)
CREATE OR REPLACE FUNCTION app_private.is_admin_or_super(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT app_private.has_role(_user_id, 'admin') OR app_private.has_role(_user_id, 'super_admin');
$$;
REVOKE ALL ON FUNCTION app_private.is_admin_or_super(uuid) FROM PUBLIC;

-- Updated_at touch trigger
DROP TRIGGER IF EXISTS tg_section_reviews_touch ON public.profile_section_reviews;
CREATE TRIGGER tg_section_reviews_touch
  BEFORE UPDATE ON public.profile_section_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

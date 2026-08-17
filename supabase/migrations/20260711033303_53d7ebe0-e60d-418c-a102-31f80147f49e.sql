
-- 1) Public-safe view for profiles
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  id, slug, artist_name, city, country, medium, style, price_range,
  commission_available, featured, avatar_path, instagram, website,
  years_creating, languages, exhibitions, cv,
  buyer_network_status, published, created_at, updated_at
FROM public.profiles
WHERE published = true;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Tighten profiles policies
DROP POLICY IF EXISTS "Public read published profiles" ON public.profiles;
DROP POLICY IF EXISTS "Auth read all profiles" ON public.profiles;

CREATE POLICY "Owner or admin read profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Tighten artworks
DROP POLICY IF EXISTS "Auth read all artworks" ON public.artworks;
CREATE POLICY "Auth read artworks of published"
  ON public.artworks FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = artworks.user_id AND p.published = true));

-- 4) ai_content: add explicit is_public flag
ALTER TABLE public.ai_content ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Public read AI content of published" ON public.ai_content;
CREATE POLICY "Public read AI content of published"
  ON public.ai_content FOR SELECT
  TO anon, authenticated
  USING (
    is_public = true
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ai_content.user_id AND p.published = true)
  );

-- 5) Storage: remove anon read policies (signed URLs are served by the storage service, not RLS)
DROP POLICY IF EXISTS "Public read artworks via signed" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars via signed" ON storage.objects;

-- 6) Revoke EXECUTE on SECURITY DEFINER functions that should only run as triggers / server-side
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_artwork_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_touch_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_buyer_network_pending() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.grant_admin_on_verify() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_active_buyer_network(uuid, text) FROM anon, authenticated, public;

-- Backfill: existing users with a published site keep their AI content publicly visible.
UPDATE public.ai_content ac
SET is_public = true
FROM public.profiles p
WHERE p.id = ac.user_id AND p.published = true;

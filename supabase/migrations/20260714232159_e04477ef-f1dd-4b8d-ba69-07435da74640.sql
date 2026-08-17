
-- 1) Hide gallery contact email from anonymous visitors via a safe view
DROP POLICY IF EXISTS "Galleries: anon read published" ON public.galleries;

CREATE OR REPLACE VIEW public.public_galleries
WITH (security_invoker = true) AS
SELECT slug, name, city, country, bio, logo_path, website, instagram, created_at, updated_at
FROM public.galleries
WHERE published = true;

GRANT SELECT ON public.public_galleries TO anon, authenticated;

-- Re-add anon read but only on the safe subset via a targeted policy that requires published,
-- and does NOT expose email (view above is what anon uses; keep table locked to anon).
-- No anon policy on galleries table means anon cannot read the base table directly.

-- 2) Tighten authenticated INSERT on analytics_events to require published target profile
DROP POLICY IF EXISTS "Auth logs event scoped" ON public.analytics_events;
CREATE POLICY "Auth logs event scoped"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (
  artist_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = analytics_events.artist_id AND p.published = true
  )
);

-- 3) Tighten authenticated INSERT on inquiries to require published target profile
DROP POLICY IF EXISTS "Auth submits inquiry" ON public.inquiries;
CREATE POLICY "Auth submits inquiry"
ON public.inquiries
FOR INSERT
TO authenticated
WITH CHECK (
  artist_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = inquiries.artist_id AND p.published = true
  )
);

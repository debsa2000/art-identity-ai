-- Extend app_role enum with 'gallery'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gallery';

-- Galleries table (one row per gallery user)
CREATE TABLE IF NOT EXISTS public.galleries (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  name text,
  city text,
  country text,
  bio text,
  logo_path text,
  website text,
  instagram text,
  email text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.galleries TO authenticated;
GRANT SELECT ON public.galleries TO anon;
GRANT ALL ON public.galleries TO service_role;

ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Galleries: owner full access"
  ON public.galleries FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public can read published galleries (safe columns; view could be added later)
CREATE POLICY "Galleries: anon read published"
  ON public.galleries FOR SELECT
  TO anon
  USING (published = true);

CREATE POLICY "Galleries: authenticated read published"
  ON public.galleries FOR SELECT
  TO authenticated
  USING (published = true OR auth.uid() = id);

-- Updated-at trigger
DROP TRIGGER IF EXISTS tg_galleries_touch_updated_at ON public.galleries;
CREATE TRIGGER tg_galleries_touch_updated_at
  BEFORE UPDATE ON public.galleries
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
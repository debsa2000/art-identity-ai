
ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS mockup_path text,
  ADD COLUMN IF NOT EXISTS mockup_source_hash text,
  ADD COLUMN IF NOT EXISTS mockup_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS mockup_error text;


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv jsonb NOT NULL DEFAULT '{"education":[],"exhibitions":[],"awards":[],"press":[],"residencies":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

ALTER TABLE public.portfolio_credits
  ADD COLUMN IF NOT EXISTS resume_bundle_purchased integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_bundle_used integer NOT NULL DEFAULT 0;

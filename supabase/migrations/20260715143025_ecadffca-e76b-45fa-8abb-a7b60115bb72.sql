
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('draft','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS application_status public.application_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS application_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_review_notes text,
  ADD COLUMN IF NOT EXISTS application_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS completion_percent int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_pricing_override jsonb;

-- 3. Helper
CREATE OR REPLACE FUNCTION public.has_approved_application(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND application_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.has_approved_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_approved_application(uuid) TO authenticated, service_role;

-- 4. Extend publish entitlement
CREATE OR REPLACE FUNCTION public.has_publish_entitlement(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_approved_application(_user_id)
    OR public.has_active_buyer_network(_user_id, 'sandbox')
    OR public.has_active_buyer_network(_user_id, 'live')
    OR EXISTS (
      SELECT 1 FROM public.portfolio_credits
      WHERE user_id = _user_id
        AND resume_bundle_purchased > resume_bundle_used
    );
$$;

-- 5. Completion computation trigger
CREATE OR REPLACE FUNCTION public.compute_profile_completion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  score int := 0;
  artwork_count int := 0;
BEGIN
  IF coalesce(NEW.artist_name,'') <> '' THEN score := score + 10; END IF;
  IF coalesce(NEW.city,'') <> '' AND coalesce(NEW.country,'') <> '' THEN score := score + 10; END IF;
  IF coalesce(NEW.medium,'') <> '' THEN score := score + 10; END IF;
  IF coalesce(NEW.instagram,'') <> '' THEN score := score + 15; END IF;
  IF NEW.avatar_path IS NOT NULL THEN score := score + 10; END IF;
  IF coalesce(NEW.style,'') <> '' THEN score := score + 5; END IF;
  IF coalesce(NEW.price_range,'') <> '' THEN score := score + 5; END IF;
  IF coalesce(NEW.exhibitions,'') <> '' THEN score := score + 5; END IF;
  IF NEW.cv IS NOT NULL AND jsonb_typeof(NEW.cv) = 'object' AND NEW.cv <> '{}'::jsonb THEN score := score + 10; END IF;

  SELECT count(*) INTO artwork_count FROM public.artworks WHERE user_id = NEW.id;
  IF artwork_count >= 5 THEN score := score + 20;
  ELSIF artwork_count >= 1 THEN score := score + 10; END IF;

  IF score > 100 THEN score := 100; END IF;
  NEW.completion_percent := score;

  -- Auto-submit when complete and still a draft
  IF score >= 100 AND NEW.application_status = 'draft' THEN
    NEW.application_status := 'submitted';
    NEW.application_submitted_at := now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_compute_profile_completion ON public.profiles;
CREATE TRIGGER tg_compute_profile_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.compute_profile_completion();

REVOKE ALL ON FUNCTION public.compute_profile_completion() FROM PUBLIC, anon, authenticated;

-- 6. Recompute completion when artworks change
CREATE OR REPLACE FUNCTION public.recompute_profile_on_artwork_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid;
BEGIN
  _uid := coalesce(NEW.user_id, OLD.user_id);
  UPDATE public.profiles SET updated_at = now() WHERE id = _uid;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_recompute_profile_on_artwork_change ON public.artworks;
CREATE TRIGGER tg_recompute_profile_on_artwork_change
  AFTER INSERT OR DELETE ON public.artworks
  FOR EACH ROW EXECUTE FUNCTION public.recompute_profile_on_artwork_change();

REVOKE ALL ON FUNCTION public.recompute_profile_on_artwork_change() FROM PUBLIC, anon, authenticated;

-- 7. Grandfather existing paying users
UPDATE public.profiles p
   SET application_status = 'approved',
       application_reviewed_at = now(),
       application_review_notes = 'Auto-approved: legacy paying customer'
 WHERE application_status = 'draft'
   AND (
     EXISTS (
       SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = p.id
          AND s.product_id = 'buyer_network'
          AND (s.status IN ('active','trialing','past_due')
               OR (s.status = 'canceled' AND s.current_period_end > now()))
     )
     OR EXISTS (
       SELECT 1 FROM public.portfolio_credits c
        WHERE c.user_id = p.id
          AND (c.purchased > 0 OR c.resume_bundle_purchased > 0)
     )
   );

-- 8. Backfill completion_percent for existing rows
UPDATE public.profiles SET updated_at = now();

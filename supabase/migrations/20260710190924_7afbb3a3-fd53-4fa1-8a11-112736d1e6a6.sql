
-- 1. Enum + columns on profiles
DO $$ BEGIN
  CREATE TYPE public.buyer_network_status AS ENUM ('not_applied','pending_review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_network_status public.buyer_network_status NOT NULL DEFAULT 'not_applied',
  ADD COLUMN IF NOT EXISTS buyer_network_note text,
  ADD COLUMN IF NOT EXISTS buyer_network_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_network_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_network_applied_at timestamptz;

-- 2. Refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  stripe_refund_id text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  reason text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own refunds" ON public.refunds;
CREATE POLICY "Users see own refunds" ON public.refunds FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 3. Update has_active_buyer_network to require approval
CREATE OR REPLACE FUNCTION public.has_active_buyer_network(_user_id uuid, _env text DEFAULT 'sandbox')
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(
    select 1
      from public.subscriptions s
      join public.profiles p on p.id = s.user_id
    where s.user_id = _user_id
      and s.product_id = 'buyer_network'
      and s.environment = _env
      and p.buyer_network_status = 'approved'
      and (
        (s.status in ('active','trialing','past_due') and (s.current_period_end is null or s.current_period_end > now()))
        or (s.status = 'canceled' and s.current_period_end > now())
      )
  )
$$;

-- 4. Trigger: when a buyer_network subscription becomes active-ish, set profile status to pending_review
--    (unless already approved/rejected)
CREATE OR REPLACE FUNCTION public.tg_buyer_network_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.product_id = 'buyer_network'
     AND NEW.status IN ('active','trialing','past_due') THEN
    UPDATE public.profiles
       SET buyer_network_status = 'pending_review',
           buyer_network_applied_at = COALESCE(buyer_network_applied_at, now())
     WHERE id = NEW.user_id
       AND buyer_network_status IN ('not_applied');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_buyer_network_pending ON public.subscriptions;
CREATE TRIGGER trg_buyer_network_pending
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_buyer_network_pending();

-- 5. Admins can update profile review fields (already covered if profiles has admin update policy?
--    add explicit admin policy just in case)
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));


-- 1) Webhook idempotency ledger
CREATE TABLE IF NOT EXISTS public.processed_checkout_sessions (
  session_id text PRIMARY KEY,
  user_id uuid,
  price_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.processed_checkout_sessions TO service_role;
ALTER TABLE public.processed_checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service manage processed sessions"
  ON public.processed_checkout_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- 2) Atomic PDF credit consumption (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.consume_portfolio_credit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  UPDATE public.portfolio_credits
     SET used = used + 1, updated_at = now()
   WHERE user_id = _user_id
     AND purchased > used
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END $$;

REVOKE ALL ON FUNCTION public.consume_portfolio_credit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_portfolio_credit(uuid) TO authenticated;

-- 3) Prevent client-side tampering with the credit counter.
DROP POLICY IF EXISTS "own credits update used" ON public.portfolio_credits;

-- 4) Retire the unused duplicate flag.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_published;

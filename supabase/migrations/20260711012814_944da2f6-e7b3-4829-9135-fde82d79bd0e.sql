
CREATE TABLE public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  source text,
  created_at timestamptz not null default now()
);
CREATE INDEX leads_email_idx ON public.leads (lower(email));

GRANT INSERT ON public.leads TO anon, authenticated;
GRANT SELECT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit a lead" ON public.leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins can read leads" ON public.leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.completed_onboarding_count()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.profiles
  WHERE artist_name IS NOT NULL AND artist_name <> '';
$$;

GRANT EXECUTE ON FUNCTION public.completed_onboarding_count() TO anon, authenticated;

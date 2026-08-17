
CREATE TABLE public.makeover_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  device_fp TEXT,
  ip_hash TEXT,
  artist_name TEXT,
  title TEXT,
  medium TEXT,
  dimensions TEXT,
  width_cm NUMERIC,
  height_cm NUMERIC,
  description TEXT,
  image_path TEXT NOT NULL,
  mockups JSONB NOT NULL DEFAULT '{}'::jsonb,
  bio TEXT,
  score INT,
  sub_scores JSONB,
  insights JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  fallback_email TEXT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX makeover_sessions_device_fp_idx ON public.makeover_sessions(device_fp, created_at DESC);
CREATE INDEX makeover_sessions_ip_hash_idx ON public.makeover_sessions(ip_hash, created_at DESC);

GRANT SELECT ON public.makeover_sessions TO anon;
GRANT SELECT ON public.makeover_sessions TO authenticated;
GRANT ALL ON public.makeover_sessions TO service_role;

ALTER TABLE public.makeover_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read makeover"
  ON public.makeover_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TRIGGER makeover_sessions_touch
  BEFORE UPDATE ON public.makeover_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Allow anon to upload/read within the makeover/ prefix of the artworks bucket.
CREATE POLICY "anon read makeover storage"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'artworks' AND (storage.foldername(name))[1] = 'makeover');

CREATE POLICY "anon insert makeover storage"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'artworks' AND (storage.foldername(name))[1] = 'makeover');

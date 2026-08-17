
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count int NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.admin_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template_key text,
  kind text NOT NULL CHECK (kind IN ('automated','manual')),
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  send_status text NOT NULL DEFAULT 'queued' CHECK (send_status IN ('queued','sent','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_email_log_recipient_idx ON public.admin_email_log(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_email_log_kind_idx ON public.admin_email_log(kind, created_at DESC);

GRANT SELECT ON public.admin_email_log TO authenticated;
GRANT ALL ON public.admin_email_log TO service_role;

ALTER TABLE public.admin_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read email log"
  ON public.admin_email_log
  FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

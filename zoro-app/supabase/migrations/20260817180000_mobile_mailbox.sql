-- Private Hermes mailbox: one active claimed email, one active mailbox per device.
-- Service-role only (RLS on, no anon/authenticated policies). Tokens stored as SHA-256 hashes.

CREATE TABLE IF NOT EXISTS public.mobile_mailbox_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES public.mobile_devices(device_id) ON DELETE CASCADE,
  email text NOT NULL,
  nonce_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  email_verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mobile_mailbox_claims_device_pending_idx
  ON public.mobile_mailbox_claims (device_id, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mobile_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL REFERENCES public.mobile_devices(device_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claimed_email text NOT NULL,
  address text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_mailboxes_one_active_email
  ON public.mobile_mailboxes (lower(claimed_email))
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mobile_mailboxes_one_active_device
  ON public.mobile_mailboxes (device_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS mobile_mailboxes_token_hash_idx
  ON public.mobile_mailboxes (token_hash)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mobile_mailbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id uuid NOT NULL REFERENCES public.mobile_mailboxes(id) ON DELETE CASCADE,
  webhook_event_id text,
  from_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  file_name text NOT NULL,
  storage_path text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0),
  expires_at timestamptz NOT NULL,
  acked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_mailbox_messages_event_file_idx
  ON public.mobile_mailbox_messages (webhook_event_id, file_name)
  WHERE webhook_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mobile_mailbox_messages_pending_idx
  ON public.mobile_mailbox_messages (mailbox_id, created_at)
  WHERE acked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mobile_mailbox_webhook_events (
  event_id text PRIMARY KEY,
  status text NOT NULL,
  detail text,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mobile_mailbox_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_mailbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_mailbox_webhook_events ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mailbox-attachments',
  'mailbox-attachments',
  false,
  12582912,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mobile_mailbox_purge_expired()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  DELETE FROM public.mobile_mailbox_messages
  WHERE acked_at IS NOT NULL
     OR expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.mobile_mailbox_purge_expired() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mobile_mailbox_purge_expired() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_mailbox_purge_expired() TO service_role;

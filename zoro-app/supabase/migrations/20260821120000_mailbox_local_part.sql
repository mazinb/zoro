-- Prefer user-picked mailbox local-parts (username@domain) over random zoro-* addresses.

ALTER TABLE public.mobile_mailbox_claims
  ADD COLUMN IF NOT EXISTS local_part text;

CREATE INDEX IF NOT EXISTS mobile_mailbox_claims_local_part_pending_idx
  ON public.mobile_mailbox_claims (lower(local_part))
  WHERE consumed_at IS NULL AND local_part IS NOT NULL;

COMMENT ON COLUMN public.mobile_mailbox_claims.local_part IS
  'Desired mailbox local-part (username) reserved until claim expires or is consumed.';

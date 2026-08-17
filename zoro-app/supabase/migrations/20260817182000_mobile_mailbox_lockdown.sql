-- Mailbox API is service-role only. RLS is already enabled; remove direct
-- PostgREST table grants as defense in depth and cover the user FK.

REVOKE ALL ON TABLE public.mobile_mailbox_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mobile_mailboxes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mobile_mailbox_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.mobile_mailbox_webhook_events FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.mobile_mailbox_claims TO service_role;
GRANT ALL ON TABLE public.mobile_mailboxes TO service_role;
GRANT ALL ON TABLE public.mobile_mailbox_messages TO service_role;
GRANT ALL ON TABLE public.mobile_mailbox_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS mobile_mailboxes_user_id_idx
  ON public.mobile_mailboxes (user_id);

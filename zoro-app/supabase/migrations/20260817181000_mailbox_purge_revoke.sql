REVOKE ALL ON FUNCTION public.mobile_mailbox_purge_expired() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mobile_mailbox_purge_expired() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_mailbox_purge_expired() TO service_role;

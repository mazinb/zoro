import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeNagTimeZone } from './nag-timezone';

export async function getUserNagTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('timezone').eq('id', userId).maybeSingle();
  return normalizeNagTimeZone((data as { timezone?: string } | null)?.timezone);
}

export async function getNagUserFlags(
  supabase: SupabaseClient,
  userId: string
): Promise<{ nag_developer: boolean }> {
  const { data } = await supabase.from('users').select('nag_developer').eq('id', userId).maybeSingle();
  return { nag_developer: Boolean((data as { nag_developer?: boolean } | null)?.nag_developer) };
}

export async function requireVerifiedWebhookForUser(
  supabase: SupabaseClient,
  userId: string,
  webhookId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data, error } = await supabase
    .from('nag_webhooks')
    .select('id, verified_at')
    .eq('id', webhookId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  if (!data?.id) {
    return { ok: false, error: 'Unknown webhook', status: 400 };
  }
  if (!data.verified_at) {
    return { ok: false, error: 'Webhook is not verified yet', status: 400 };
  }
  return { ok: true };
}

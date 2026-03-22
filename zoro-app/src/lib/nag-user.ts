import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeNagTimeZone } from './nag-timezone';

export async function getUserNagTimezone(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('timezone').eq('id', userId).maybeSingle();
  return normalizeNagTimeZone((data as { timezone?: string } | null)?.timezone);
}

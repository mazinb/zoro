import type { SupabaseClient } from '@supabase/supabase-js';

export type NagMemoryOutboundEntry = {
  type: 'outbound';
  timestamp: string;
  subject: string;
  bodyPreview: string;
  nag_id: string;
  resend_id?: string;
};

/**
 * Appends a nag delivery to user_context.memory_jsonb (same store as agent OB emails).
 * Entries include nag_id so profile inbound pairing skips them.
 */
export async function appendNagOutboundMemory(
  supabase: SupabaseClient,
  userId: string,
  entry: Omit<NagMemoryOutboundEntry, 'type'>
): Promise<void> {
  const full: NagMemoryOutboundEntry = { type: 'outbound', ...entry };

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error: fetchErr } = await supabase
      .from('user_context')
      .select('memory_jsonb')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[nag-memory-log] fetch user_context:', fetchErr.message);
      return;
    }
    if (!row) {
      return;
    }

    const mem = Array.isArray(row.memory_jsonb) ? [...(row.memory_jsonb as unknown[])] : [];
    mem.push(full as unknown as Record<string, unknown>);

    const { error: upErr } = await supabase
      .from('user_context')
      .update({
        memory_jsonb: mem,
        updated_at: full.timestamp,
      })
      .eq('user_id', userId);

    if (!upErr) return;
  }
}

export function isNagMemoryItem(raw: unknown): raw is NagMemoryOutboundEntry & Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    o.type === 'outbound' &&
    typeof o.nag_id === 'string' &&
    o.nag_id.length > 0 &&
    typeof o.timestamp === 'string'
  );
}

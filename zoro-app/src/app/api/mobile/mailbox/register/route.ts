import { NextRequest } from 'next/server';

import {
  bearerToken,
  findActiveByToken,
  hashSecret,
  MailboxError,
  newMailboxToken,
} from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Rotate the mailbox bearer token. Requires an existing claimed mailbox (Authorization). */
export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request.headers.get('authorization'));
    if (!token) throw new MailboxError('Claim your mailbox first', 401, 'claim_required');
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceId = toNonEmptyString(body.deviceId);

    const supabase = getSupabaseServiceRole();
    const row = await findActiveByToken(supabase, token);
    if (!row) throw new MailboxError('Claim your mailbox first', 401, 'claim_required');
    if (deviceId && row.device_id !== deviceId) throw new MailboxError('Device mismatch', 403);

    const next = newMailboxToken();
    const { error } = await supabase
      .from('mobile_mailboxes')
      .update({ token_hash: hashSecret(next), updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) throw new MailboxError(error.message, 500);

    return mailboxJson({ address: row.address, mailboxToken: next, claimedEmail: row.claimed_email });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

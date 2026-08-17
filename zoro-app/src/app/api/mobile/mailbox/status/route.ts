import { NextRequest } from 'next/server';

import { mailboxClaimOrigin } from '@/lib/mailbox-claim-mail';
import {
  bearerToken,
  findActiveByDevice,
  findActiveByToken,
  MailboxError,
} from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServiceRole();
    const token = bearerToken(request.headers.get('authorization'));
    const deviceId = request.nextUrl.searchParams.get('deviceId')?.trim() ?? '';
    const row = token
      ? await findActiveByToken(supabase, token)
      : deviceId
        ? await findActiveByDevice(supabase, deviceId)
        : null;
    if (!row) return mailboxJson({ state: 'none' });

    const { count } = await supabase
      .from('mobile_mailbox_messages')
      .select('id', { count: 'exact', head: true })
      .eq('mailbox_id', row.id)
      .is('acked_at', null)
      .gt('expires_at', new Date().toISOString());

    return mailboxJson({
      state: 'active',
      address: row.address,
      claimedEmail: row.claimed_email,
      deviceId: row.device_id,
      pendingCount: count ?? 0,
      origin: mailboxClaimOrigin(request.headers.get('origin')),
    });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    if (!deviceId) throw new MailboxError('deviceId is required', 400);
    const url = request.nextUrl.clone();
    url.searchParams.set('deviceId', deviceId);
    return GET(new NextRequest(url, { headers: request.headers }));
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

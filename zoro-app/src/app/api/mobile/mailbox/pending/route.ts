import { NextRequest } from 'next/server';

import { mailboxClaimOrigin } from '@/lib/mailbox-claim-mail';
import {
  bearerToken,
  downloadUrlFor,
  findActiveByToken,
  MailboxError,
} from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const token = bearerToken(request.headers.get('authorization'));
    if (!token) throw new MailboxError('Authorization required', 401);
    const supabase = getSupabaseServiceRole();
    const row = await findActiveByToken(supabase, token);
    if (!row) throw new MailboxError('Mailbox not found', 401);

    await supabase.rpc('mobile_mailbox_purge_expired');

    const { data, error } = await supabase
      .from('mobile_mailbox_messages')
      .select('id,from_email,subject,file_name,expires_at')
      .eq('mailbox_id', row.id)
      .is('acked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    if (error) throw new MailboxError(error.message, 500);

    const origin = mailboxClaimOrigin(request.headers.get('origin'));
    return mailboxJson(
      (data ?? []).map((m) => ({
        id: m.id,
        fileName: m.file_name,
        from: m.from_email,
        subject: m.subject,
        downloadUrl: downloadUrlFor(origin, m.id),
      })),
    );
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

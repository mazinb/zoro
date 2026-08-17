import { NextRequest } from 'next/server';

import { bearerToken, findActiveByToken, MAILBOX_BUCKET, MailboxError } from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request.headers.get('authorization'));
    if (!token) throw new MailboxError('Authorization required', 401);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) throw new MailboxError('id is required', 400);

    const supabase = getSupabaseServiceRole();
    const row = await findActiveByToken(supabase, token);
    if (!row) throw new MailboxError('Mailbox not found', 401);

    const { data: msg } = await supabase
      .from('mobile_mailbox_messages')
      .select('id,mailbox_id,storage_path,acked_at')
      .eq('id', id)
      .maybeSingle();
    if (!msg || msg.mailbox_id !== row.id) throw new MailboxError('Message not found', 404);

    if (!msg.acked_at) {
      if (msg.storage_path) {
        await supabase.storage.from(MAILBOX_BUCKET).remove([msg.storage_path]);
      }
      await supabase
        .from('mobile_mailbox_messages')
        .update({ acked_at: new Date().toISOString() })
        .eq('id', id);
    }

    return mailboxJson({ acked: true, id });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

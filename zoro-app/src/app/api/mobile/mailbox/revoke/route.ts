import { NextRequest } from 'next/server';

import { bearerToken, findActiveByToken, MailboxError, revokeMailbox } from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request.headers.get('authorization'));
    if (!token) throw new MailboxError('Authorization required', 401);
    const supabase = getSupabaseServiceRole();
    const row = await findActiveByToken(supabase, token);
    if (!row) throw new MailboxError('Mailbox not found', 404);
    await revokeMailbox(supabase, row);
    return mailboxJson({ revoked: true });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

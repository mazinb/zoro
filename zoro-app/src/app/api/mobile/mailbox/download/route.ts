import { NextRequest, NextResponse } from 'next/server';

import { bearerToken, findActiveByToken, MAILBOX_BUCKET, MailboxError } from '@/lib/mobile-mailbox';
import { mailboxErrorResponse } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const token = bearerToken(request.headers.get('authorization'));
    if (!token) throw new MailboxError('Authorization required', 401);
    const id = request.nextUrl.searchParams.get('id')?.trim() ?? '';
    if (!id) throw new MailboxError('id is required', 400);

    const supabase = getSupabaseServiceRole();
    const row = await findActiveByToken(supabase, token);
    if (!row) throw new MailboxError('Mailbox not found', 401);

    const { data: msg } = await supabase
      .from('mobile_mailbox_messages')
      .select('id,mailbox_id,storage_path,file_name,acked_at,expires_at')
      .eq('id', id)
      .maybeSingle();
    if (!msg || msg.mailbox_id !== row.id) throw new MailboxError('Message not found', 404);
    if (msg.acked_at) throw new MailboxError('Already downloaded', 410);
    if (new Date(msg.expires_at).getTime() < Date.now()) throw new MailboxError('Expired', 410);

    const { data: file, error } = await supabase.storage.from(MAILBOX_BUCKET).download(msg.storage_path);
    if (error || !file) throw new MailboxError('File missing', 404);

    const bytes = Buffer.from(await file.arrayBuffer());
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${msg.file_name.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

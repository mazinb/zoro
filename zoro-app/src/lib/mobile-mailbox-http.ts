import { NextResponse } from 'next/server';

import { MailboxError } from '@/lib/mobile-mailbox';

export function mailboxErrorResponse(e: unknown): NextResponse {
  if (e instanceof MailboxError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  const msg = e instanceof Error ? e.message : 'Mailbox request failed';
  return NextResponse.json({ error: msg }, { status: 500 });
}

export function mailboxJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

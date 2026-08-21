import { NextRequest, NextResponse } from 'next/server';

import { processMailboxInbound } from '@/lib/mobile-mailbox-inbound';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

function ingestSecrets(): string[] {
  return [
    process.env.MAILBOX_INGEST_SECRET?.trim(),
    process.env.NAG_DISPATCH_KEY?.trim(),
  ].filter((s): s is string => Boolean(s));
}

function authorized(request: NextRequest): boolean {
  const secrets = ingestSecrets();
  if (secrets.length === 0) return false;
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  const header = request.headers.get('x-zoro-mailbox-secret')?.trim() ?? '';
  const got = bearer || header;
  return Boolean(got && secrets.includes(got));
}

/**
 * Bridge for the external Resend webhook / mail pipeline (outside this repo).
 *
 * Accepts either a raw Resend `email.received` payload or a normalized body:
 * `{ emailId?, from, to, subject?, attachments? }`.
 *
 * Auth: `Authorization: Bearer <MAILBOX_INGEST_SECRET>` (or `X-Zoro-Mailbox-Secret`).
 * Falls back to `NAG_DISPATCH_KEY` when ingest secret is unset.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  // Normalized bridge shape → Resend-like envelope for the shared processor.
  let payload: unknown = body;
  if (typeof root.type !== 'string' && (root.from || root.to)) {
    const emailId =
      (typeof root.emailId === 'string' && root.emailId) ||
      (typeof root.email_id === 'string' && root.email_id) ||
      '';
    payload = {
      type: 'email.received',
      data: {
        email_id: emailId,
        id: emailId || (typeof root.id === 'string' ? root.id : undefined),
        from: root.from,
        to: root.to,
        cc: root.cc,
        received_for: root.received_for,
        subject: root.subject ?? '',
        attachments: root.attachments ?? [],
      },
    };
  }

  try {
    const supabase = getSupabaseServiceRole();
    const result = await processMailboxInbound(supabase, payload);
    return NextResponse.json(result);
  } catch (e) {
    console.error('[mailbox-ingest]', e);
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}

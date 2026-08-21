import { NextRequest, NextResponse } from 'next/server';

import { processMailboxInbound } from '@/lib/mobile-mailbox-inbound';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifySvixSignature } from '@/lib/svix-webhook';

/**
 * Resend `email.received` webhook for Hermes mailbox PDFs.
 *
 * Prefer pointing a dedicated Resend webhook at this URL. If inbound is already
 * handled by an external mail pipeline, have that service POST to
 * `/api/mobile/mailbox/ingest` instead (or add this URL as a second Resend webhook).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret =
    process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() || process.env.WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id') ?? '';
  const svixTimestamp = request.headers.get('svix-timestamp') ?? '';
  const svixSignature = request.headers.get('svix-signature') ?? '';
  const ok = verifySvixSignature({
    rawBody,
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
  });
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceRole();
    const result = await processMailboxInbound(supabase, payload, {
      eventIdOverride: svixId || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[mailbox-inbound]', e);
    return NextResponse.json({ error: 'Inbound processing failed' }, { status: 500 });
  }
}

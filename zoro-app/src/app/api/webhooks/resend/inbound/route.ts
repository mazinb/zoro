import { NextRequest, NextResponse } from 'next/server';

import {
  findActiveByAddress,
  looksLikePdf,
  MAILBOX_BUCKET,
  MAX_PDF_BYTES,
  MAX_PDFS_PER_MAIL,
  parseResendInbound,
  retentionHours,
} from '@/lib/mobile-mailbox';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifySvixSignature } from '@/lib/svix-webhook';

async function recordEvent(eventId: string, status: string, detail?: string) {
  const supabase = getSupabaseServiceRole();
  await supabase.from('mobile_mailbox_webhook_events').upsert({
    event_id: eventId,
    status,
    detail: detail ?? null,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() || process.env.WEBHOOK_SECRET?.trim();
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

  const parsed = parseResendInbound(payload);
  const eventId = svixId || parsed?.eventId || '';
  if (!parsed || !eventId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const supabase = getSupabaseServiceRole();
  const { data: seen } = await supabase
    .from('mobile_mailbox_webhook_events')
    .select('event_id,status')
    .eq('event_id', eventId)
    .maybeSingle();
  if (seen?.status === 'accepted') {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const mailbox = (await Promise.all(parsed.to.map((addr) => findActiveByAddress(supabase, addr)))).find(Boolean);
  if (!mailbox) {
    await recordEvent(eventId, 'rejected', 'unknown_recipient');
    return NextResponse.json({ ok: true, ignored: 'unknown_recipient' });
  }
  if (parsed.from !== mailbox.claimed_email) {
    await recordEvent(eventId, 'rejected', 'sender_not_claimed');
    return NextResponse.json({ ok: true, ignored: 'sender_not_claimed' });
  }

  let stored = 0;
  let considered = 0;
  const expiresAt = new Date(Date.now() + retentionHours() * 60 * 60 * 1000).toISOString();

  for (const att of parsed.attachments) {
    if (considered >= MAX_PDFS_PER_MAIL) break;
    const bytes = await loadAttachmentBytes(att, parsed.emailId);
    if (!bytes) continue;
    considered += 1;
    if (bytes.byteLength > MAX_PDF_BYTES) continue;
    if (!looksLikePdf(bytes, att.fileName, att.mime)) continue;

    const safeName = att.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'statement.pdf';
    const storagePath = `${mailbox.id}/${eventId}/${stored}-${safeName}`;
    const { error: upErr } = await supabase.storage.from(MAILBOX_BUCKET).upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (upErr && !/already exists/i.test(upErr.message)) {
      console.error('[mailbox-inbound] upload', upErr.message);
      continue;
    }

    const { error: insErr } = await supabase.from('mobile_mailbox_messages').insert({
      mailbox_id: mailbox.id,
      webhook_event_id: eventId,
      from_email: parsed.from,
      subject: parsed.subject,
      file_name: att.fileName,
      storage_path: storagePath,
      byte_size: bytes.byteLength,
      expires_at: expiresAt,
    });
    if (insErr && !/mobile_mailbox_messages_event_file_idx/i.test(insErr.message)) {
      console.error('[mailbox-inbound] insert', insErr.message);
      continue;
    }
    stored += 1;
  }

  await recordEvent(eventId, stored > 0 ? 'accepted' : 'rejected', stored > 0 ? `${stored}_pdfs` : 'no_pdf');
  return NextResponse.json({ ok: true, stored });
}

async function loadAttachmentBytes(att: {
  attachmentId?: string;
  contentBase64?: string;
  downloadUrl?: string;
}, emailId: string): Promise<Uint8Array | null> {
  if (att.contentBase64) {
    try {
      return Uint8Array.from(Buffer.from(att.contentBase64, 'base64'));
    } catch {
      return null;
    }
  }
  let downloadUrl = att.downloadUrl;
  if (!downloadUrl && emailId && att.attachmentId) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return null;
    try {
      const metadata = await fetch(
        `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(att.attachmentId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!metadata.ok) return null;
      const data = (await metadata.json()) as { download_url?: string };
      downloadUrl = data.download_url;
    } catch {
      return null;
    }
  }
  if (!downloadUrl) return null;
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

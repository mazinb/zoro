import type { SupabaseClient } from '@supabase/supabase-js';

import {
  findActiveByAddress,
  looksLikePdf,
  MAILBOX_BUCKET,
  MAX_PDF_BYTES,
  MAX_PDFS_PER_MAIL,
  parseResendInbound,
  retentionHours,
  type InboundAttachment,
} from '@/lib/mobile-mailbox';

export type ProcessInboundResult = {
  ok: true;
  stored: number;
  eventId: string;
  ignored?: string;
  duplicate?: boolean;
};

async function recordEvent(
  supabase: SupabaseClient,
  eventId: string,
  status: string,
  detail?: string,
) {
  await supabase.from('mobile_mailbox_webhook_events').upsert({
    event_id: eventId,
    status,
    detail: detail ?? null,
  });
}

/** List attachments via Resend Receiving API (webhook payloads only include metadata). */
export async function listResendAttachments(emailId: string): Promise<InboundAttachment[]> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !emailId) return [];
  try {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) {
      console.error('[mailbox-inbound] list attachments', res.status, await res.text().catch(() => ''));
      return [];
    }
    const body = (await res.json()) as {
      data?: Array<Record<string, unknown>>;
    };
    const rows = Array.isArray(body.data) ? body.data : [];
    return rows.map((o) => {
      const attachmentId =
        typeof o.id === 'string'
          ? o.id
          : typeof o.attachment_id === 'string'
            ? o.attachment_id
            : undefined;
      const fileName = String(o.filename ?? o.fileName ?? o.name ?? 'attachment.pdf');
      const mime = String(o.content_type ?? o.contentType ?? o.mime ?? '');
      const downloadUrl =
        typeof o.download_url === 'string'
          ? o.download_url
          : typeof o.url === 'string'
            ? o.url
            : undefined;
      const contentBase64 =
        typeof o.content === 'string' ? o.content : typeof o.data === 'string' ? o.data : undefined;
      return { attachmentId, fileName, mime, contentBase64, downloadUrl };
    });
  } catch (e) {
    console.error('[mailbox-inbound] list attachments failed', e);
    return [];
  }
}

export async function loadAttachmentBytes(
  att: InboundAttachment,
  emailId: string,
): Promise<Uint8Array | null> {
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
      if (metadata.ok) {
        const data = (await metadata.json()) as {
          download_url?: string;
          data?: { download_url?: string };
        };
        downloadUrl = data.download_url ?? data.data?.download_url;
      }
    } catch {
      /* fall through */
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

function mergeAttachments(
  fromWebhook: InboundAttachment[],
  fromApi: InboundAttachment[],
): InboundAttachment[] {
  if (fromApi.length === 0) return fromWebhook;
  if (fromWebhook.length === 0) return fromApi;
  const byId = new Map<string, InboundAttachment>();
  for (const a of [...fromWebhook, ...fromApi]) {
    const key = a.attachmentId || `${a.fileName}:${a.mime}`;
    const prev = byId.get(key);
    if (!prev) {
      byId.set(key, a);
      continue;
    }
    byId.set(key, {
      ...prev,
      ...a,
      contentBase64: a.contentBase64 || prev.contentBase64,
      downloadUrl: a.downloadUrl || prev.downloadUrl,
    });
  }
  return [...byId.values()];
}

/**
 * Store PDF attachments for an active Hermes mailbox.
 * Used by the Resend Svix webhook and by the external mail-pipeline ingest bridge.
 */
export async function processMailboxInbound(
  supabase: SupabaseClient,
  payload: unknown,
  opts?: { eventIdOverride?: string },
): Promise<ProcessInboundResult> {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  if (root && typeof root.type === 'string' && root.type !== 'email.received') {
    return { ok: true, stored: 0, eventId: '', ignored: 'not_email_received' };
  }

  const parsed = parseResendInbound(payload);
  const eventId = (opts?.eventIdOverride || parsed?.eventId || '').trim();
  if (!parsed || !eventId) {
    return { ok: true, stored: 0, eventId: eventId || '', ignored: 'unparsed' };
  }

  const { data: seen } = await supabase
    .from('mobile_mailbox_webhook_events')
    .select('event_id,status')
    .eq('event_id', eventId)
    .maybeSingle();
  if (seen?.status === 'accepted') {
    return { ok: true, stored: 0, eventId, duplicate: true };
  }

  const recipients = parsed.to;
  const mailbox = (
    await Promise.all(recipients.map((addr) => findActiveByAddress(supabase, addr)))
  ).find(Boolean);
  if (!mailbox) {
    await recordEvent(supabase, eventId, 'rejected', 'unknown_recipient');
    return { ok: true, stored: 0, eventId, ignored: 'unknown_recipient' };
  }
  if (parsed.from !== mailbox.claimed_email) {
    await recordEvent(supabase, eventId, 'rejected', 'sender_not_claimed');
    return { ok: true, stored: 0, eventId, ignored: 'sender_not_claimed' };
  }

  const listed = parsed.emailId ? await listResendAttachments(parsed.emailId) : [];
  const attachments = mergeAttachments(parsed.attachments, listed);

  let stored = 0;
  let considered = 0;
  const expiresAt = new Date(Date.now() + retentionHours() * 60 * 60 * 1000).toISOString();

  for (const att of attachments) {
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

  await recordEvent(
    supabase,
    eventId,
    stored > 0 ? 'accepted' : 'rejected',
    stored > 0 ? `${stored}_pdfs` : attachments.length === 0 ? 'no_attachments' : 'no_pdf',
  );
  return { ok: true, stored, eventId };
}

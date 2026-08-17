import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const MAILBOX_BUCKET = 'mailbox-attachments';
export const MAILBOX_TOKEN_PREFIX = 'zmb_';
export const MAX_PDF_BYTES = 12 * 1024 * 1024;
export const MAX_PDFS_PER_MAIL = 5;
export const CLAIM_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_RETENTION_HOURS = 48;

export type MailboxRow = {
  id: string;
  device_id: string;
  user_id: string;
  claimed_email: string;
  address: string;
  token_hash: string;
  revoked_at: string | null;
};

export type MailboxClaimRow = {
  id: string;
  device_id: string;
  email: string;
  nonce_hash: string;
  expires_at: string;
  email_verified_at: string | null;
  consumed_at: string | null;
};

export type PendingMessage = {
  id: string;
  from_email: string;
  subject: string;
  file_name: string;
  storage_path: string;
  byte_size: number;
  expires_at: string;
};

export class MailboxError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'MailboxError';
  }
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(raw));
}

export function extractEmailAddress(raw: string): string {
  const t = raw.trim();
  const m = t.match(/<([^>]+)>/);
  return normalizeEmail(m?.[1] ?? t);
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newMailboxToken(): string {
  return `${MAILBOX_TOKEN_PREFIX}${randomBytes(24).toString('hex')}`;
}

export function newClaimNonce(): string {
  return randomBytes(24).toString('base64url');
}

export function inboundDomain(): string {
  return (process.env.MAILBOX_INBOUND_DOMAIN || 'getzoro.com').replace(/^@/, '').trim();
}

export function retentionHours(): number {
  const n = Number(process.env.MAILBOX_RETENTION_HOURS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_HOURS;
}

export function mailboxPublicUrl(address: string, origin: string): Record<string, string> {
  return { address, claimedFrom: origin };
}

export function looksLikePdf(bytes: Uint8Array, fileName: string, mime = ''): boolean {
  const nameOk = fileName.toLowerCase().endsWith('.pdf');
  const mimeOk = mime.toLowerCase().includes('pdf');
  if (!nameOk && !mimeOk) return false;
  if (bytes.length < 5) return false;
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return head === '%PDF';
}

export function parseRecipientList(to: unknown): string[] {
  if (typeof to === 'string') return [extractEmailAddress(to)];
  if (!Array.isArray(to)) return [];
  return to
    .map((item) => {
      if (typeof item === 'string') return extractEmailAddress(item);
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const addr = o.address ?? o.email ?? o.value;
        if (typeof addr === 'string') return extractEmailAddress(addr);
      }
      return '';
    })
    .filter(Boolean);
}

export type InboundAttachment = {
  attachmentId?: string;
  fileName: string;
  mime: string;
  contentBase64?: string;
  downloadUrl?: string;
};

export function parseResendInbound(payload: unknown): {
  eventId: string;
  emailId: string;
  from: string;
  to: string[];
  subject: string;
  attachments: InboundAttachment[];
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const eventId =
    (typeof root.svix_id === 'string' && root.svix_id) ||
    (typeof data.email_id === 'string' && data.email_id) ||
    (typeof data.id === 'string' && data.id) ||
    (typeof root.id === 'string' && root.id) ||
    '';
  const emailId =
    (typeof data.email_id === 'string' && data.email_id) ||
    (typeof data.id === 'string' && data.id) ||
    '';
  const fromRaw = typeof data.from === 'string' ? data.from : '';
  const subject = typeof data.subject === 'string' ? data.subject : '';
  const to = parseRecipientList(data.to);
  const attsRaw = Array.isArray(data.attachments) ? data.attachments : [];
  const attachments: InboundAttachment[] = [];
  for (const a of attsRaw) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    const attachmentId =
      typeof o.id === 'string'
        ? o.id
        : typeof o.attachment_id === 'string'
          ? o.attachment_id
          : undefined;
    const fileName = String(o.filename ?? o.fileName ?? o.name ?? 'attachment.pdf');
    const mime = String(o.content_type ?? o.contentType ?? o.mime ?? '');
    const contentBase64 = typeof o.content === 'string' ? o.content : typeof o.data === 'string' ? o.data : undefined;
    const downloadUrl =
      typeof o.download_url === 'string'
        ? o.download_url
        : typeof o.url === 'string'
          ? o.url
          : undefined;
    attachments.push({ attachmentId, fileName, mime, contentBase64, downloadUrl });
  }
  if (!fromRaw || to.length === 0) return null;
  return {
    eventId: eventId || emailId || `evt_${Date.now()}`,
    emailId,
    from: extractEmailAddress(fromRaw),
    to,
    subject,
    attachments,
  };
}

export async function ensureDevice(supabase: SupabaseClient, deviceId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('mobile_devices').upsert(
    { device_id: deviceId, platform: 'ios', last_seen_at: now },
    { onConflict: 'device_id' },
  );
  if (error) throw new MailboxError(error.message, 500);
}

export function emailClaimBlocked(
  existing: { device_id: string } | null,
  deviceId: string,
): boolean {
  return Boolean(existing && existing.device_id !== deviceId);
}

export async function findActiveByEmail(supabase: SupabaseClient, email: string): Promise<MailboxRow | null> {
  const { data, error } = await supabase
    .from('mobile_mailboxes')
    .select('id,device_id,user_id,claimed_email,address,token_hash,revoked_at')
    .is('revoked_at', null)
    .ilike('claimed_email', email)
    .maybeSingle();
  if (error) throw new MailboxError(error.message, 500);
  return (data as MailboxRow | null) ?? null;
}

export async function findActiveByDevice(supabase: SupabaseClient, deviceId: string): Promise<MailboxRow | null> {
  const { data, error } = await supabase
    .from('mobile_mailboxes')
    .select('id,device_id,user_id,claimed_email,address,token_hash,revoked_at')
    .eq('device_id', deviceId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new MailboxError(error.message, 500);
  return (data as MailboxRow | null) ?? null;
}

export async function findActiveByToken(supabase: SupabaseClient, token: string): Promise<MailboxRow | null> {
  const { data, error } = await supabase
    .from('mobile_mailboxes')
    .select('id,device_id,user_id,claimed_email,address,token_hash,revoked_at')
    .eq('token_hash', hashSecret(token))
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new MailboxError(error.message, 500);
  return (data as MailboxRow | null) ?? null;
}

export async function findActiveByAddress(supabase: SupabaseClient, address: string): Promise<MailboxRow | null> {
  const { data, error } = await supabase
    .from('mobile_mailboxes')
    .select('id,device_id,user_id,claimed_email,address,token_hash,revoked_at')
    .eq('address', normalizeEmail(address))
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new MailboxError(error.message, 500);
  return (data as MailboxRow | null) ?? null;
}

export async function ensureUserForEmail(supabase: SupabaseClient, email: string): Promise<{ id: string }> {
  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (findErr) throw new MailboxError(findErr.message, 500);
  if (existing?.id) return { id: existing.id };

  const verificationToken = randomBytes(16).toString('hex');
  const nextCheckinDue = new Date();
  nextCheckinDue.setDate(nextCheckinDue.getDate() + 15);
  const { data: inserted, error: insertErr } = await supabase
    .from('users')
    .insert({
      email,
      verification_token: verificationToken,
      timezone: 'UTC',
      checkin_frequency: 'monthly',
      next_checkin_due: nextCheckinDue.toISOString(),
      is_verified: false,
    })
    .select('id')
    .single();
  if (insertErr) {
    const { data: raced } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (raced?.id) return { id: raced.id };
    throw new MailboxError(insertErr.message, 500);
  }
  return { id: inserted.id };
}

export async function revokeMailbox(supabase: SupabaseClient, mailbox: MailboxRow): Promise<void> {
  const now = new Date().toISOString();
  const { data: pending } = await supabase
    .from('mobile_mailbox_messages')
    .select('id,storage_path')
    .eq('mailbox_id', mailbox.id)
    .is('acked_at', null);
  for (const row of pending ?? []) {
    if (row.storage_path) {
      await supabase.storage.from(MAILBOX_BUCKET).remove([row.storage_path]);
    }
  }
  await supabase.from('mobile_mailbox_messages').delete().eq('mailbox_id', mailbox.id);
  const { error } = await supabase
    .from('mobile_mailboxes')
    .update({ revoked_at: now, updated_at: now, token_hash: `revoked:${mailbox.id}:${now}` })
    .eq('id', mailbox.id);
  if (error) throw new MailboxError(error.message, 500);
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  const t = (m?.[1] ?? '').trim();
  return t || null;
}

export function downloadUrlFor(origin: string, id: string): string {
  return `${origin.replace(/\/$/, '')}/api/mobile/mailbox/download?id=${encodeURIComponent(id)}`;
}

export function publicMailbox(row: MailboxRow, origin: string, pendingCount = 0) {
  return {
    address: row.address,
    claimedEmail: row.claimed_email,
    deviceId: row.device_id,
    pendingCount,
    downloadOrigin: origin,
  };
}

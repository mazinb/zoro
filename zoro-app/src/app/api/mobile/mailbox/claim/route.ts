import { NextRequest, NextResponse } from 'next/server';

import { mailboxClaimHttpsUrl, mailboxClaimOrigin, sendMailboxClaimEmail } from '@/lib/mailbox-claim-mail';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import {
  CLAIM_TTL_MS,
  MailboxError,
  ensureDevice,
  findActiveByDevice,
  findActiveByEmail,
  hashSecret,
  isValidEmail,
  newClaimNonce,
  normalizeEmail,
} from '@/lib/mobile-mailbox';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** POST { deviceId, email } — send magic link. Does not create the mailbox until the link is opened. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceId = toNonEmptyString(body.deviceId);
    const emailRaw = toNonEmptyString(body.email);
    if (!deviceId) throw new MailboxError('deviceId is required', 400);
    if (!emailRaw || !isValidEmail(emailRaw)) throw new MailboxError('Valid email is required', 400);
    const email = normalizeEmail(emailRaw);

    const supabase = getSupabaseServiceRole();
    await ensureDevice(supabase, deviceId);

    const occupied = await findActiveByEmail(supabase, email);
    if (occupied && occupied.device_id !== deviceId) {
      throw new MailboxError('This email already has a mailbox on another device.', 409, 'email_in_use');
    }

    const existingDevice = await findActiveByDevice(supabase, deviceId);
    if (existingDevice && existingDevice.claimed_email !== email) {
      // Allowed: finish will revoke the previous mailbox after the new email is verified.
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey) throw new MailboxError('Email service not configured', 500);

    const nonce = newClaimNonce();
    const expiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();
    const { error } = await supabase.from('mobile_mailbox_claims').insert({
      device_id: deviceId,
      email,
      nonce_hash: hashSecret(nonce),
      expires_at: expiresAt,
    });
    if (error) throw new MailboxError(error.message, 500);

    const origin = mailboxClaimOrigin(request.headers.get('origin'));
    const actionUrl = mailboxClaimHttpsUrl(origin, nonce);
    const sent = await sendMailboxClaimEmail({
      email,
      actionUrl,
      resendApiKey,
      fromAddress: process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>',
    });
    if (!sent.ok) {
      console.error('[mailbox-claim] Resend', sent.status, sent.text);
      throw new MailboxError('Failed to send confirmation email', 502);
    }

    return mailboxJson({ sent: true, email, expiresAt });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

/** GET ?deviceId= — pending claim / active mailbox for this device (no secrets). */
export async function GET(request: NextRequest) {
  try {
    const deviceId = request.nextUrl.searchParams.get('deviceId')?.trim() ?? '';
    if (!deviceId) return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
    const supabase = getSupabaseServiceRole();

    const active = await findActiveByDevice(supabase, deviceId);
    if (active) {
      return mailboxJson({
        state: 'active',
        address: active.address,
        claimedEmail: active.claimed_email,
      });
    }

    const { data: claim } = await supabase
      .from('mobile_mailbox_claims')
      .select('email,expires_at,email_verified_at,consumed_at')
      .eq('device_id', deviceId)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!claim) return mailboxJson({ state: 'none' });
    if (claim.email_verified_at) {
      return mailboxJson({ state: 'verified', email: claim.email });
    }
    return mailboxJson({ state: 'pending', email: claim.email, expiresAt: claim.expires_at });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

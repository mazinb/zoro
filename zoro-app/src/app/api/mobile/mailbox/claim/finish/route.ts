import { NextRequest, NextResponse } from 'next/server';

import { mailboxClaimAppUrl, mailboxClaimOrigin } from '@/lib/mailbox-claim-mail';
import {
  MailboxError,
  ensureUserForEmail,
  findActiveByDevice,
  findActiveByEmail,
  hashSecret,
  inboundDomain,
  newMailboxToken,
  normalizeEmail,
  revokeMailbox,
} from '@/lib/mobile-mailbox';
import { mailboxErrorResponse, mailboxJson } from '@/lib/mobile-mailbox-http';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

async function loadClaimByNonce(nonce: string) {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from('mobile_mailbox_claims')
    .select('id,device_id,email,nonce_hash,expires_at,email_verified_at,consumed_at')
    .eq('nonce_hash', hashSecret(nonce))
    .maybeSingle();
  if (error) throw new MailboxError(error.message, 500);
  return { supabase, claim: data };
}

/** GET/POST mark the magic-link click (email proof) then finish can issue the mailbox. */
export async function GET(request: NextRequest) {
  const nonce = request.nextUrl.searchParams.get('nonce')?.trim() ?? '';
  if (!nonce) return NextResponse.json({ error: 'nonce is required' }, { status: 400 });
  try {
    const { supabase, claim } = await loadClaimByNonce(nonce);
    if (!claim) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    if (claim.consumed_at) return NextResponse.json({ error: 'This link was already used' }, { status: 409 });
    if (new Date(claim.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }
    if (!claim.email_verified_at) {
      const now = new Date().toISOString();
      await supabase
        .from('mobile_mailbox_claims')
        .update({ email_verified_at: now })
        .eq('id', claim.id);
      await supabase.from('users').update({ is_verified: true, updated_at: now }).eq('email', claim.email);
    }
    const appUrl = mailboxClaimAppUrl(nonce);
    return NextResponse.json({ ok: true, appUrl, email: claim.email, deviceId: claim.device_id });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

/** POST { deviceId, nonce? } — create the mailbox after the email link was opened. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const deviceId = toNonEmptyString(body.deviceId);
    const nonce = toNonEmptyString(body.nonce);
    if (!deviceId) throw new MailboxError('deviceId is required', 400);

    const supabase = getSupabaseServiceRole();
    let claim: {
      id: string;
      device_id: string;
      email: string;
      expires_at: string;
      email_verified_at: string | null;
      consumed_at: string | null;
    } | null = null;

    if (nonce) {
      const loaded = await loadClaimByNonce(nonce);
      claim = loaded.claim;
    } else {
      const { data } = await supabase
        .from('mobile_mailbox_claims')
        .select('id,device_id,email,expires_at,email_verified_at,consumed_at')
        .eq('device_id', deviceId)
        .is('consumed_at', null)
        .not('email_verified_at', 'is', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      claim = data;
    }

    if (!claim) throw new MailboxError('Invalid or expired claim', 404);
    if (claim.device_id !== deviceId) throw new MailboxError('This link belongs to another device', 403);
    if (claim.consumed_at) {
      const active = await findActiveByDevice(supabase, deviceId);
      if (active) {
        const token = newMailboxToken();
        await supabase
          .from('mobile_mailboxes')
          .update({ token_hash: hashSecret(token), updated_at: new Date().toISOString() })
          .eq('id', active.id);
        return mailboxJson({
          address: active.address,
          mailboxToken: token,
          claimedEmail: active.claimed_email,
        });
      }
      throw new MailboxError('This link was already used', 409);
    }
    if (new Date(claim.expires_at).getTime() < Date.now()) throw new MailboxError('This link has expired', 410);
    if (!claim.email_verified_at && !nonce) throw new MailboxError('Open the email link first', 409);

    const email = normalizeEmail(claim.email);
    const occupied = await findActiveByEmail(supabase, email);
    if (occupied && occupied.device_id !== deviceId) {
      throw new MailboxError('This email already has a mailbox on another device.', 409, 'email_in_use');
    }

    const now = new Date().toISOString();
    if (!claim.email_verified_at) {
      await supabase.from('mobile_mailbox_claims').update({ email_verified_at: now }).eq('id', claim.id);
    }

    const onDevice = await findActiveByDevice(supabase, deviceId);
    if (onDevice && onDevice.claimed_email === email) {
      const token = newMailboxToken();
      await supabase
        .from('mobile_mailboxes')
        .update({ token_hash: hashSecret(token), updated_at: now })
        .eq('id', onDevice.id);
      await supabase.from('mobile_mailbox_claims').update({ consumed_at: now }).eq('id', claim.id);
      return mailboxJson({
        address: onDevice.address,
        mailboxToken: token,
        claimedEmail: onDevice.claimed_email,
      });
    }
    if (onDevice) await revokeMailbox(supabase, onDevice);

    const user = await ensureUserForEmail(supabase, email);
    await supabase.from('users').update({ is_verified: true, updated_at: now }).eq('id', user.id);

    const token = newMailboxToken();
    const localPart = `zoro-${claim.id.replace(/-/g, '').slice(0, 12)}`;
    const address = `${localPart}@${inboundDomain()}`.toLowerCase();

    const { data: created, error: insertErr } = await supabase
      .from('mobile_mailboxes')
      .insert({
        device_id: deviceId,
        user_id: user.id,
        claimed_email: email,
        address,
        token_hash: hashSecret(token),
      })
      .select('id,address,claimed_email')
      .single();
    if (insertErr || !created) {
      if (/mobile_mailboxes_one_active_email/i.test(insertErr?.message ?? '')) {
        throw new MailboxError('This email already has a mailbox on another device.', 409, 'email_in_use');
      }
      throw new MailboxError(insertErr?.message ?? 'Could not create mailbox', 500);
    }

    await supabase.from('mobile_mailbox_claims').update({ consumed_at: now }).eq('id', claim.id);

    return mailboxJson({
      address: created.address,
      mailboxToken: token,
      claimedEmail: created.claimed_email,
      origin: mailboxClaimOrigin(request.headers.get('origin')),
    });
  } catch (e) {
    return mailboxErrorResponse(e);
  }
}

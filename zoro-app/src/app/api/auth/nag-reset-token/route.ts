import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { buildNagAppUrl, nagMagicLinkOrigin, sendNagMagicLinkEmail } from '@/lib/nag-magic-link-mail';

function generateVerificationToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * POST { token }
 * Rotates users.verification_token (+ user_data.user_token), then emails fresh /nag link.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { userId } = auth;

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const { data: userRow, error: rowErr } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    if (rowErr) {
      return NextResponse.json({ error: rowErr.message }, { status: 500 });
    }
    const email = (userRow as { email?: string } | null)?.email?.trim() ?? '';
    if (!email) {
      return NextResponse.json({ error: 'Could not find account email.' }, { status: 404 });
    }

    const nextToken = generateVerificationToken();
    const nowIso = new Date().toISOString();
    const { error: tokenErr } = await supabase
      .from('users')
      .update({ verification_token: nextToken, updated_at: nowIso })
      .eq('id', userId);
    if (tokenErr) {
      return NextResponse.json({ error: tokenErr.message }, { status: 500 });
    }

    const { error: userDataErr } = await supabase
      .from('user_data')
      .update({ user_token: nextToken, updated_at: nowIso })
      .eq('user_id', userId);
    if (userDataErr) {
      return NextResponse.json({ error: userDataErr.message }, { status: 500 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 });
    }
    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
    const origin = nagMagicLinkOrigin(request);
    const actionUrl = buildNagAppUrl(origin, nextToken);
    const sent = await sendNagMagicLinkEmail(email, actionUrl, resendApiKey, fromAddress);
    if (!sent.ok) {
      return NextResponse.json({ error: 'Failed to send reset link email.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      token: nextToken,
      message: 'Token reset. We emailed you a fresh link with the new token.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Token reset failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

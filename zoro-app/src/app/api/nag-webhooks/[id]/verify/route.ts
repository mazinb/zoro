import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { postUserWebhook, verificationChallengeAccepted } from '@/lib/nag-webhook-http';

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const { data: row, error: fErr } = await supabase
      .from('nag_webhooks')
      .select('id, url, secret, verify_token, verified_at')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 500 });
    }
    if (!row?.url) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (row.verified_at) {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 });
    }

    const challenge = typeof row.verify_token === 'string' && row.verify_token ? row.verify_token : randomBytes(16).toString('hex');
    if (!row.verify_token) {
      await supabase.from('nag_webhooks').update({ verify_token: challenge, updated_at: new Date().toISOString() }).eq('id', id);
    }

    const result = await postUserWebhook(row.url, row.secret, {
      type: 'zoro.verification',
      challenge,
    });

    if (!result.ok || !verificationChallengeAccepted(challenge, result.json)) {
      return NextResponse.json(
        {
          error: 'Verification failed',
          detail: `HTTP ${result.status}. Body must be JSON with "challenge" equal to the token we sent.`,
        },
        { status: 422 }
      );
    }

    const now = new Date().toISOString();
    const nextVerify = randomBytes(16).toString('hex');
    const { error: uErr } = await supabase
      .from('nag_webhooks')
      .update({
        verified_at: now,
        verify_token: nextVerify,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, verified_at: now });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'verify failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

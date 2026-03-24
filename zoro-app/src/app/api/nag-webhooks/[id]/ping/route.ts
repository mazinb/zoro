import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { postUserWebhook } from '@/lib/nag-webhook-http';

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
      .select('id, url, secret, verified_at')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 500 });
    }
    if (!row?.url || !row.secret) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!row.verified_at) {
      return NextResponse.json({ error: 'Verify the webhook before ping.' }, { status: 400 });
    }

    const sentAt = new Date().toISOString();
    const result = await postUserWebhook(row.url, row.secret, {
      type: 'zoro.ping',
      sent_at: sentAt,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Ping failed', status: result.status, body_preview: result.text.slice(0, 200) },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, status: result.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ping failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

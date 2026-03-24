import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';

const MAX_WEBHOOKS = 10;

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
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

    const { data, error } = await supabase
      .from('nag_webhooks')
      .select('id, url, verified_at, created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ webhooks: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'list failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const urlRaw = typeof body.url === 'string' ? body.url.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }
    if (!urlRaw || !isHttpsUrl(urlRaw)) {
      return NextResponse.json({ error: 'url must be https' }, { status: 400 });
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

    const { count, error: cErr } = await supabase
      .from('nag_webhooks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.userId);

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_WEBHOOKS) {
      return NextResponse.json({ error: `Maximum ${MAX_WEBHOOKS} webhooks.` }, { status: 400 });
    }

    const secret = randomBytes(32).toString('hex');
    const verify_token = randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const { data: row, error } = await supabase
      .from('nag_webhooks')
      .insert({
        user_id: auth.userId,
        url: urlRaw,
        secret,
        verify_token,
        created_at: now,
        updated_at: now,
      })
      .select('id, url, verified_at, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      webhook: row,
      verify_hint:
        'We POST {"type":"zoro.verification","challenge":"<token>"} with header X-Zoro-Webhook-Secret. Respond 200 JSON {"challenge":"<same token>"}.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'create failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

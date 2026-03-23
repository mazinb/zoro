import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { isValidIanaTimezone } from '@/lib/nag-timezone';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const tzRaw = typeof body.timezone === 'string' ? body.timezone.trim() : '';

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }
    if (!tzRaw) {
      return NextResponse.json({ error: 'timezone is required' }, { status: 400 });
    }
    if (!isValidIanaTimezone(tzRaw)) {
      return NextResponse.json({ error: 'Invalid IANA timezone' }, { status: 400 });
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

    const { error: updErr } = await supabase
      .from('users')
      .update({ timezone: tzRaw, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ timezone: tzRaw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'profile update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

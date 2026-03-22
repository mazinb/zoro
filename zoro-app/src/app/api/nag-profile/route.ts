import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { computeInitialNextAt } from '@/lib/nag-schedule';
import { isValidIanaTimezone } from '@/lib/nag-timezone';
import type { NagRow } from '@/lib/nag-types';

const NAG_SELECT =
  'id,user_id,message,channel,frequency,time_hhmm,day_of_week,day_of_month,end_type,until_date,occurrences_max,occurrences_remaining,status,next_at,last_sent_at,created_at,updated_at';

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

    const { data: active, error: listErr } = await supabase
      .from('nags')
      .select(NAG_SELECT)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 500 });
    }

    for (const row of (active ?? []) as NagRow[]) {
      const nextAt = computeInitialNextAt({
        frequency: row.frequency,
        time_hhmm: row.time_hhmm,
        day_of_week: row.day_of_week,
        day_of_month: row.day_of_month,
        until_date: row.until_date,
        timeZone: tzRaw,
      });
      await supabase
        .from('nags')
        .update({ next_at: nextAt ? nextAt.toISOString() : null, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('user_id', userId);
    }

    return NextResponse.json({ timezone: tzRaw });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'profile update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

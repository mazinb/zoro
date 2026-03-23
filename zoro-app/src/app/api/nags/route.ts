import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { computeInitialNextAt } from '@/lib/nag-schedule';
import { nagConfirmationHtml, sendNagEmail } from '@/lib/nag-email';
import { formatNagNextLabel } from '@/lib/nag-timezone';
import { getUserNagTimezone } from '@/lib/nag-user';
import { isNagStatus, parseNagBehaviorFields, validateScheduleBody, type NagRow } from '@/lib/nag-types';

const SELECT_FIELDS =
  'id,user_id,message,channel,frequency,time_hhmm,day_of_week,day_of_month,end_type,until_date,occurrences_max,occurrences_remaining,status,next_at,last_sent_at,nag_until_done,followup_interval_hours,created_at,updated_at';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
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

    const statusParam = request.nextUrl.searchParams.get('status') ?? 'active';

    let q = supabase.from('nags').select(SELECT_FIELDS).eq('user_id', userId);
    if (statusParam === 'all') {
      q = q.in('status', ['active', 'archived']);
    } else {
      if (!isNagStatus(statusParam)) {
        return NextResponse.json({ error: 'invalid status filter' }, { status: 400 });
      }
      q = q.eq('status', statusParam);
    }
    const { data: nags, error } = await q.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('email,timezone')
      .eq('id', userId)
      .maybeSingle();

    return NextResponse.json({
      nags: nags ?? [],
      profile: {
        email: userRow?.email ?? null,
        timezone: (userRow as { timezone?: string } | null)?.timezone ?? 'UTC',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'list failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
    const { userId } = auth;

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const v = validateScheduleBody(body as Record<string, unknown>);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    const data = v.data;

    const nb = parseNagBehaviorFields(body as Record<string, unknown>);
    if (!nb.ok) {
      return NextResponse.json({ error: nb.error }, { status: 400 });
    }

    const userTz = await getUserNagTimezone(supabase, userId);

    const nextAt = computeInitialNextAt({
      frequency: data.frequency,
      time_hhmm: data.time_hhmm,
      day_of_week: data.day_of_week,
      day_of_month: data.day_of_month,
      until_date: data.until_date,
      timeZone: userTz,
    });

    if (!nextAt) {
      return NextResponse.json(
        { error: 'Could not compute a future schedule from these fields (check date and time).' },
        { status: 400 }
      );
    }

    const insertRow = {
      user_id: userId,
      message: data.message,
      channel: data.channel,
      frequency: data.frequency,
      time_hhmm: data.time_hhmm,
      day_of_week: data.day_of_week,
      day_of_month: data.day_of_month,
      end_type: data.end_type,
      until_date: data.until_date,
      occurrences_max: data.end_type === 'occurrences' ? data.occurrences_max : null,
      occurrences_remaining: data.end_type === 'occurrences' ? data.occurrences_max : null,
      nag_until_done: nb.nag_until_done,
      followup_interval_hours: nb.followup_interval_hours,
      status: 'active' as const,
      next_at: nextAt.toISOString(),
    };

    const { data: row, error } = await supabase
      .from('nags')
      .insert(insertRow)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const nag = row as NagRow;

    if (data.channel === 'email') {
      const { data: userRow } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();
      const to = userRow?.email;
      if (to) {
        const nextLabel = formatNagNextLabel(nextAt, userTz);
        await sendNagEmail({
          to,
          subject: `Nag scheduled: ${data.message.slice(0, 60)}${data.message.length > 60 ? '…' : ''}`,
          html: nagConfirmationHtml(data.message, nextLabel),
        });
      }
    }

    return NextResponse.json(nag, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'create failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

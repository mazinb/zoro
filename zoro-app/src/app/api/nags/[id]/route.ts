import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { computeInitialNextAt } from '@/lib/nag-schedule';
import { getUserNagTimezone } from '@/lib/nag-user';
import {
  isNagChannel,
  isNagEndType,
  isNagFrequency,
  isNagStatus,
  parseHHMM,
  validateScheduleBody,
  type NagRow,
  type NagScheduleInput,
} from '@/lib/nag-types';

const SELECT_FIELDS =
  'id,user_id,message,channel,frequency,time_hhmm,day_of_week,day_of_month,end_type,until_date,occurrences_max,occurrences_remaining,status,next_at,last_sent_at,created_at,updated_at';

function mergeSchedule(existing: NagRow, body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    message: existing.message,
    channel: existing.channel,
    frequency: existing.frequency,
    time_hhmm: existing.time_hhmm,
    day_of_week: existing.day_of_week,
    day_of_month: existing.day_of_month,
    end_type: existing.end_type,
    until_date: existing.until_date,
    occurrences_max: existing.occurrences_max,
  };

  if (typeof body.message === 'string') out.message = body.message;
  if (typeof body.channel === 'string' && isNagChannel(body.channel)) out.channel = body.channel;
  if (typeof body.frequency === 'string' && isNagFrequency(body.frequency)) out.frequency = body.frequency;
  if (typeof body.time_hhmm === 'string' && parseHHMM(body.time_hhmm)) out.time_hhmm = body.time_hhmm;
  if (body.day_of_week !== undefined) {
    if (body.day_of_week === null) out.day_of_week = null;
    else {
      const d = Number(body.day_of_week);
      if (Number.isInteger(d) && d >= 0 && d <= 6) out.day_of_week = d;
    }
  }
  if (body.day_of_month !== undefined) {
    if (body.day_of_month === null) out.day_of_month = null;
    else {
      const d = Number(body.day_of_month);
      if (Number.isInteger(d) && d >= 1 && d <= 31) out.day_of_month = d;
    }
  }
  if (typeof body.end_type === 'string' && isNagEndType(body.end_type)) out.end_type = body.end_type;
  if (body.until_date === null) out.until_date = null;
  else if (typeof body.until_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.until_date)) {
    out.until_date = body.until_date;
  }
  if (body.occurrences_max === null) out.occurrences_max = null;
  else if (body.occurrences_max !== undefined) {
    const n = Number(body.occurrences_max);
    if (Number.isInteger(n) && n >= 1) out.occurrences_max = n;
  }

  return out;
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    const { userId } = auth;

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }
    const { data: existing, error: fetchErr } = await supabase
      .from('nags')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const row = existing as NagRow;

    const scheduleKeys = [
      'message',
      'channel',
      'frequency',
      'time_hhmm',
      'day_of_week',
      'day_of_month',
      'end_type',
      'until_date',
      'occurrences_max',
    ] as const;
    const hasScheduleUpdate = scheduleKeys.some((k) => body[k] !== undefined);

    if (typeof body.status === 'string' && isNagStatus(body.status) && !hasScheduleUpdate) {
      const userTz = await getUserNagTimezone(supabase, userId);
      const payload: Record<string, unknown> = { status: body.status };
      if (body.status === 'active' && row.status !== 'active') {
        const nextAt = computeInitialNextAt({
          frequency: row.frequency,
          time_hhmm: row.time_hhmm,
          day_of_week: row.day_of_week,
          day_of_month: row.day_of_month,
          until_date: row.until_date,
          timeZone: userTz,
        });
        payload.next_at = nextAt ? nextAt.toISOString() : null;
      }
      const { data: updated, error } = await supabase
        .from('nags')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId)
        .select(SELECT_FIELDS)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(updated);
    }

    const merged = mergeSchedule(row, body as Record<string, unknown>);
    const v = validateScheduleBody(merged);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    const data: NagScheduleInput = v.data;

    const userTz = await getUserNagTimezone(supabase, userId);

    const nextAt = computeInitialNextAt({
      frequency: data.frequency,
      time_hhmm: data.time_hhmm,
      day_of_week: data.day_of_week,
      day_of_month: data.day_of_month,
      until_date: data.until_date,
      timeZone: userTz,
    });

    if (!nextAt && data.frequency !== 'once') {
      return NextResponse.json(
        { error: 'Could not compute next run from these fields.' },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      message: data.message,
      channel: data.channel,
      frequency: data.frequency,
      time_hhmm: data.time_hhmm,
      day_of_week: data.day_of_week,
      day_of_month: data.day_of_month,
      end_type: data.end_type,
      until_date: data.until_date,
      occurrences_max: data.end_type === 'occurrences' ? data.occurrences_max : null,
    };

    if (data.end_type === 'occurrences') {
      updatePayload.occurrences_remaining = data.occurrences_max;
    } else {
      updatePayload.occurrences_remaining = null;
    }

    if (row.status === 'active') {
      updatePayload.next_at = nextAt ? nextAt.toISOString() : null;
    }

    const { data: updated, error } = await supabase
      .from('nags')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'update failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
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
    const { data: updated, error } = await supabase
      .from('nags')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', userId)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

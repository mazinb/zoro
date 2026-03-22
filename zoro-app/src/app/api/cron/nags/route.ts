import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { computeNextAfterSend } from '@/lib/nag-schedule';
import { nagReminderHtml, sendNagEmail } from '@/lib/nag-email';
import type { NagRow } from '@/lib/nag-types';

const SELECT_FIELDS =
  'id,user_id,message,channel,frequency,time_hhmm,day_of_week,day_of_month,end_type,until_date,occurrences_max,occurrences_remaining,status,next_at,last_sent_at,created_at,updated_at';

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const q = request.nextUrl.searchParams.get('secret');
  if (q === secret) return true;

  return false;
}

export async function GET(request: NextRequest) {
  return runCron(request);
}

export async function POST(request: NextRequest) {
  return runCron(request);
}

async function runCron(request: NextRequest) {
  try {
    if (!authorizeCron(request)) {
      if (!process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }
    const nowIso = new Date().toISOString();

    const { data: due, error } = await supabase
      .from('nags')
      .select(SELECT_FIELDS)
      .eq('status', 'active')
      .eq('channel', 'email')
      .lte('next_at', nowIso)
      .order('next_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (due ?? []) as NagRow[];
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const { data: userRow } = await supabase
        .from('users')
        .select('email')
        .eq('id', row.user_id)
        .maybeSingle();

      const to = userRow?.email;
      if (!to) {
        failed += 1;
        continue;
      }

      const emailResult = await sendNagEmail({
        to,
        subject: `Reminder: ${row.message.slice(0, 80)}${row.message.length > 80 ? '…' : ''}`,
        html: nagReminderHtml(row.message),
      });

      if (!emailResult.ok) {
        failed += 1;
        continue;
      }

      sent += 1;
      const sentAt = new Date();
      const { next_at, status, occurrences_remaining } = computeNextAfterSend(row, sentAt);

      const updatePayload: Record<string, unknown> = {
        last_sent_at: sentAt.toISOString(),
        next_at: next_at ? next_at.toISOString() : null,
        occurrences_remaining,
      };
      if (status === 'archived') {
        updatePayload.status = 'archived';
      }

      await supabase.from('nags').update(updatePayload).eq('id', row.id);
    }

    return NextResponse.json({
      ok: true,
      checked: rows.length,
      sent,
      failed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'cron failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

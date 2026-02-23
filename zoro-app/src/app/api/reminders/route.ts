import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTokenToUserId } from '@/lib/resolve-token';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase configuration');
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const VALID_CONTEXTS = ['income', 'assets', 'expenses'] as const;
const VALID_RECURRENCE = ['monthly', 'quarterly', 'annually'] as const;

/** Compute next occurrence at 09:00 local (server TZ); cron may use user TZ later. */
function nextScheduledAt(
  recurrence: 'monthly' | 'quarterly' | 'annually',
  recurrenceDay: number,
  recurrenceWeek: number,
  recurrenceMonth: number
): Date {
  const now = new Date();
  const hour = 9;
  const minute = 0;

  if (recurrence === 'monthly') {
    const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayThisMonth = Math.min(recurrenceDay, lastDayThisMonth);
    let next = new Date(now.getFullYear(), now.getMonth(), dayThisMonth, hour, minute, 0, 0);
    if (next <= now) {
      const nextMonth = now.getMonth() + 1;
      const nextYear = nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
      const nextMonthNorm = nextMonth % 12;
      const lastDayNext = new Date(nextYear, nextMonthNorm + 1, 0).getDate();
      next = new Date(nextYear, nextMonthNorm, Math.min(recurrenceDay, lastDayNext), hour, minute, 0, 0);
    }
    return next;
  }

  if (recurrence === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3) + 1;
    const year = now.getFullYear();
    const quarterStartMonth = (q - 1) * 3;
    const dayInQuarter = (recurrenceWeek - 1) * 7 + 1;
    const next = new Date(year, quarterStartMonth, dayInQuarter, hour, minute, 0, 0);
    if (next <= now) {
      const nextQ = q === 4 ? 1 : q + 1;
      const nextYear = nextQ === 1 ? year + 1 : year;
      const nextStartMonth = (nextQ - 1) * 3;
      const nextDay = (recurrenceWeek - 1) * 7 + 1;
      return new Date(nextYear, nextStartMonth, nextDay, hour, minute, 0, 0);
    }
    return next;
  }

  if (recurrence === 'annually') {
    let next = new Date(now.getFullYear(), recurrenceMonth - 1, 1, hour, minute, 0, 0);
    if (next <= now) {
      next = new Date(now.getFullYear() + 1, recurrenceMonth - 1, 1, hour, minute, 0, 0);
    }
    return next;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

/** Store recurrence for cron: "monthly:15" | "quarterly:2" | "annually:6" */
function recurrencePayload(
  recurrence: string,
  recurrenceDay: number,
  recurrenceWeek: number,
  recurrenceMonth: number
): string {
  if (recurrence === 'monthly') return `monthly:${recurrenceDay}`;
  if (recurrence === 'quarterly') return `quarterly:${recurrenceWeek}`;
  if (recurrence === 'annually') return `annually:${recurrenceMonth}`;
  return 'once';
}

/** POST: Create a recurring reminder (token-gated; context = income | assets | expenses) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const context = body.context;
    const recurrence = VALID_RECURRENCE.includes(body.recurrence) ? body.recurrence : 'monthly';
    const recurrenceDay = Math.min(31, Math.max(1, Number(body.recurrence_day) || 1));
    const recurrenceWeek = Math.min(4, Math.max(1, Number(body.recurrence_week) || 1));
    const recurrenceMonth = Math.min(12, Math.max(1, Number(body.recurrence_month) || 1));
    const priority = typeof body.priority === 'string' ? body.priority : 'normal';

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    if (!VALID_CONTEXTS.includes(context)) {
      return NextResponse.json({ error: 'context must be income, assets, or expenses' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;

    const scheduledDate = nextScheduledAt(recurrence, recurrenceDay, recurrenceWeek, recurrenceMonth);
    const recurrenceStored = recurrencePayload(recurrence, recurrenceDay, recurrenceWeek, recurrenceMonth);

    const supabase = getSupabase();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('verification_token')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user?.verification_token) {
      return NextResponse.json({ error: 'Could not resolve user key' }, { status: 500 });
    }
    const userKey = user.verification_token;

    const { data: row, error } = await supabase
      .from('reminders')
      .insert({
        user_id: userId,
        user_key: userKey,
        scheduled_at: scheduledDate.toISOString(),
        description,
        context: context || '',
        recurrence: recurrenceStored,
        priority: priority || 'normal',
        status: 'pending',
      })
      .select('id, scheduled_at, description, context')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create reminder';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

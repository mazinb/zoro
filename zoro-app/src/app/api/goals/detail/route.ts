import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import {
  getDataFilled,
  GOAL_TITLES,
  type GoalId,
  type UserDataRow,
} from '@/lib/goalDataConfig';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase configuration');
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** URL/query goal id → user_data column */
const GOAL_TO_COLUMN: Record<GoalId, string> = {
  save: 'save_more_answers',
  home: 'big_purchase_answers',
  invest: 'invest_answers',
  insurance: 'insurance_answers',
  tax: 'tax_answers',
  retirement: 'retirement_answers',
};

const ALL_GOALS: GoalId[] = ['save', 'home', 'invest', 'insurance', 'tax', 'retirement'];

const PATH_SEGMENTS: Record<GoalId, string> = {
  save: '/save',
  home: '/home',
  invest: '/invest',
  insurance: '/insurance',
  tax: '/tax',
  retirement: '/retire',
};

/**
 * GET ?token=&fields=save,retirement
 * Returns goal answer JSON slices plus wealth data-fill flags (for GoalDataGate logic).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
    const fieldsRaw = request.nextUrl.searchParams.get('fields')?.trim() ?? '';

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;
    const supabase = getSupabase();

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, verification_token')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user?.verification_token) {
      return NextResponse.json({ error: userErr?.message ?? 'User not found' }, { status: 500 });
    }

    const t = user.verification_token;
    const selectCols = [
      'save_more_answers',
      'big_purchase_answers',
      'invest_answers',
      'insurance_answers',
      'tax_answers',
      'retirement_answers',
      'retirement_expense_buckets',
      'shared_data',
      'income_answers',
      'assets_answers',
    ].join(', ');

    const { data: ud, error: udErr } = await supabase
      .from('user_data')
      .select(selectCols)
      .eq('user_id', userId)
      .maybeSingle();

    if (udErr) {
      return NextResponse.json({ error: udErr.message }, { status: 500 });
    }

    const userRow = ud as UserDataRow | null;
    const dataFilled = getDataFilled(userRow);

    const requested: GoalId[] = fieldsRaw
      ? (fieldsRaw.split(',').map((s) => s.trim()) as GoalId[]).filter((g) =>
          ALL_GOALS.includes(g)
        )
      : ALL_GOALS;

    const goals: Partial<
      Record<
        GoalId,
        { title: string; answers: unknown; path: string; retirement_expense_buckets?: unknown }
      >
    > = {};

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.getzoro.com');

    for (const g of requested) {
      const col = GOAL_TO_COLUMN[g];
      const answers = userRow ? (userRow as Record<string, unknown>)[col as string] : null;
      const extra =
        g === 'retirement' && userRow?.retirement_expense_buckets != null
          ? { retirement_expense_buckets: userRow.retirement_expense_buckets }
          : {};
      goals[g] = {
        title: GOAL_TITLES[g],
        answers: answers ?? null,
        ...(g === 'retirement' ? extra : {}),
        path: `${origin}${PATH_SEGMENTS[g]}?token=${encodeURIComponent(t)}`,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        wealth_data_filled: dataFilled,
        goals,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Goals detail failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

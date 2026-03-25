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

function hasJsonData(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'object' && !Array.isArray(v)) return Object.keys(v as object).length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * GET ?token= — compact cross-domain snapshot for LLM orchestration (wealth routes, goals, nags).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
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
      .select('id, email, timezone, verification_token')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user) {
      return NextResponse.json({ error: userErr?.message ?? 'User not found' }, { status: 500 });
    }

    const { data: ud } = await supabase.from('user_data').select('*').eq('user_id', userId).maybeSingle();

    const goals = {
      save_more: hasJsonData(ud?.save_more_answers),
      big_purchase: hasJsonData(ud?.big_purchase_answers),
      invest: hasJsonData(ud?.invest_answers),
      insurance: hasJsonData(ud?.insurance_answers),
      tax: hasJsonData(ud?.tax_answers),
      retirement: hasJsonData(ud?.retirement_answers),
    };

    const wealth = {
      expenses: hasJsonData(ud?.expenses_answers) || Boolean(ud?.shared_data && typeof ud.shared_data === 'object'),
      income: hasJsonData(ud?.income_answers),
      assets: hasJsonData(ud?.assets_answers),
    };

    const [nagRes, remRes, meRes] = await Promise.all([
      supabase.from('nags').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
      supabase.from('reminders').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('monthly_expenses').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    const nagActive = nagRes.count ?? 0;
    const reminderCount = remRes.count ?? 0;
    const monthExpCount = meRes.count ?? 0;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.getzoro.com');

    const t = user.verification_token || token;

    const paths = {
      home: `${origin}/`,
      nag: `${origin}/nag?token=${encodeURIComponent(t)}`,
      expenses: `${origin}/expenses?token=${encodeURIComponent(t)}`,
      income: `${origin}/income?token=${encodeURIComponent(t)}`,
      assets: `${origin}/assets?token=${encodeURIComponent(t)}`,
      save: `${origin}/save?token=${encodeURIComponent(t)}`,
      home_big_purchase: `${origin}/home?token=${encodeURIComponent(t)}`,
      invest: `${origin}/invest?token=${encodeURIComponent(t)}`,
      insurance: `${origin}/insurance?token=${encodeURIComponent(t)}`,
      tax: `${origin}/tax?token=${encodeURIComponent(t)}`,
      retire: `${origin}/retire?token=${encodeURIComponent(t)}`,
      profile: `${origin}/profile?token=${encodeURIComponent(t)}`,
      agent: `${origin}/agent?token=${encodeURIComponent(t)}`,
    };

    return NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, timezone: user.timezone },
        goals,
        wealth,
        counts: {
          active_nags: nagActive ?? 0,
          reminders: reminderCount ?? 0,
          monthly_expense_months: monthExpCount ?? 0,
        },
        paths,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Summary failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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
 * GET ?token= — onboarding payload (requires token).
 * Intended for orchestrator-driven onboarding / routing.
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
      .select('id, email, name, timezone, verification_token, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (userErr || !user) {
      return NextResponse.json({ error: userErr?.message ?? 'User not found' }, { status: 500 });
    }

    const { data: ud, error: udErr } = await supabase
      .from('user_data')
      .select(
        'id,user_id,user_token,shared_data,income_answers,assets_answers,expenses_answers,save_more_answers,big_purchase_answers,invest_answers,insurance_answers,tax_answers,retirement_answers,created_at,updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (udErr) {
      return NextResponse.json({ error: udErr.message }, { status: 500 });
    }

    const t = user.verification_token || token;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.getzoro.com');

    const onboarding = {
      has_profile: Boolean(user.email) || Boolean(user.name),
      has_shared_data: hasJsonData(ud?.shared_data),
      wealth: {
        income: hasJsonData(ud?.income_answers),
        assets: hasJsonData(ud?.assets_answers),
        expenses: hasJsonData(ud?.expenses_answers) || hasJsonData(ud?.shared_data),
      },
      goals: {
        save_more: hasJsonData(ud?.save_more_answers),
        big_purchase: hasJsonData(ud?.big_purchase_answers),
        invest: hasJsonData(ud?.invest_answers),
        insurance: hasJsonData(ud?.insurance_answers),
        tax: hasJsonData(ud?.tax_answers),
        retirement: hasJsonData(ud?.retirement_answers),
      },
    };

    const paths = {
      nag: `${origin}/nag?token=${encodeURIComponent(t)}`,
      wealth: `${origin}/wealth?token=${encodeURIComponent(t)}`,
      goals: `${origin}/goals?token=${encodeURIComponent(t)}`,
      expenses: `${origin}/expenses?token=${encodeURIComponent(t)}`,
      income: `${origin}/income?token=${encodeURIComponent(t)}`,
      assets: `${origin}/assets?token=${encodeURIComponent(t)}`,
      save: `${origin}/save?token=${encodeURIComponent(t)}`,
      profile: `${origin}/profile?token=${encodeURIComponent(t)}`,
      agent: `${origin}/agent?token=${encodeURIComponent(t)}`,
    };

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
          created_at: user.created_at,
        },
        user_data: ud
          ? {
              id: ud.id,
              user_id: ud.user_id,
              user_token: ud.user_token,
              shared_data: ud.shared_data,
              created_at: ud.created_at,
              updated_at: ud.updated_at,
            }
          : null,
        onboarding,
        paths,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onboarding failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


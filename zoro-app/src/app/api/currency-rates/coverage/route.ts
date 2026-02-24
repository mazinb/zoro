import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { toMonthKey, yearToMonthKey, currentMonthKey } from '@/lib/currency';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type MissingItem = { month: string; currency_code: string };

/** GET: Returns { missing: [{ month, currency_code }] } for (month, currency) pairs where user has data but no rate. */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;

    const monthsNeeded = new Set<string>();
    const currenciesNeeded = new Set<string>();

    const { data: userDataRow } = await supabase
      .from('user_data')
      .select('shared_data, income_answers, assets_answers')
      .eq('user_id', userId)
      .maybeSingle();

    const sd = (userDataRow?.shared_data as Record<string, unknown>) ?? {};
    const expensesCountry = typeof sd.expenses_country === 'string' ? sd.expenses_country : null;
    const incomeCountry = typeof sd.income_country === 'string' ? sd.income_country : null;
    const assetsCountry = typeof sd.assets_country === 'string' ? sd.assets_country : null;

    if (expensesCountry) currenciesNeeded.add(expensesCountry);
    if (incomeCountry) currenciesNeeded.add(incomeCountry);
    if (assetsCountry) currenciesNeeded.add(assetsCountry);

    const { data: monthlyRows } = await supabase
      .from('monthly_expenses')
      .select('month')
      .eq('user_id', userId);

    if (monthlyRows?.length && expensesCountry) {
      for (const row of monthlyRows) {
        const m = row.month;
        if (m) monthsNeeded.add(String(m).slice(0, 7));
      }
    }

    const income = userDataRow?.income_answers as Record<string, { currency?: string; rsuCurrency?: string }> | undefined;
    if (income?.yearly && typeof income.yearly === 'object') {
      const yearly = income.yearly as Record<string, { currency?: string; rsuCurrency?: string }>;
      for (const year of Object.keys(yearly)) {
        if (/^\d{4}$/.test(year)) {
          monthsNeeded.add(yearToMonthKey(year));
          const y = yearly[year];
          if (y?.currency) currenciesNeeded.add(y.currency);
          if (y?.rsuCurrency) currenciesNeeded.add(y.rsuCurrency);
        }
      }
    }

    const assets = userDataRow?.assets_answers as {
      accounts?: Array<{ currency?: string }>;
      liabilities?: Array<{ currency?: string }>;
      quarterly_snapshots?: Array<{ captured_at?: string; accounts?: Array<{ currency?: string }>; liabilities?: Array<{ currency?: string }> }>;
    } | undefined;

    if (assets?.accounts?.length || assets?.liabilities?.length) {
      monthsNeeded.add(currentMonthKey());
      for (const a of assets.accounts ?? []) {
        if (a.currency) currenciesNeeded.add(a.currency);
      }
      for (const l of assets.liabilities ?? []) {
        if (l.currency) currenciesNeeded.add(l.currency);
      }
    }
    if (assets?.quarterly_snapshots?.length) {
      for (const s of assets.quarterly_snapshots) {
        if (s.captured_at) monthsNeeded.add(toMonthKey(s.captured_at));
        for (const a of s.accounts ?? []) {
          if (a.currency) currenciesNeeded.add(a.currency);
        }
        for (const l of s.liabilities ?? []) {
          if (l.currency) currenciesNeeded.add(l.currency);
        }
      }
    }

    if (monthsNeeded.size === 0 || currenciesNeeded.size === 0) {
      return NextResponse.json({ data: { missing: [] } });
    }

    const monthDates = Array.from(monthsNeeded).map((m) => {
      const [y, mo] = m.split('-').map(Number);
      return `${y}-${String(mo).padStart(2, '0')}-01`;
    });
    const currencies = Array.from(currenciesNeeded);

    const { data: rates } = await supabase
      .from('currency_rates')
      .select('month, currency_code')
      .in('month', monthDates)
      .in('currency_code', currencies);

    const haveSet = new Set<string>();
    for (const r of rates ?? []) {
      const monthKey = String(r.month).slice(0, 7);
      haveSet.add(`${monthKey}:${r.currency_code}`);
    }

    const missing: MissingItem[] = [];
    for (const monthKey of monthsNeeded) {
      for (const currency_code of currenciesNeeded) {
        if (!haveSet.has(`${monthKey}:${currency_code}`)) {
          missing.push({ month: monthKey, currency_code });
        }
      }
    }

    return NextResponse.json({ data: { missing } });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: 'Server error',
        details: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

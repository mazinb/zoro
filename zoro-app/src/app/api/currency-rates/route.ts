import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Parse YYYY-MM to first day of month for DB query */
function monthToDate(monthStr: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return null;
  const m = parseInt(match[2], 10);
  if (m < 1 || m > 12) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-01`;
}

/** GET: Fetch currency rates. ?month=YYYY-MM for one month, or omit for last 6 months. */
export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get('month');

    if (monthParam) {
      const monthDate = monthToDate(monthParam);
      if (!monthDate) {
        return NextResponse.json(
          { error: 'Invalid month (use YYYY-MM)' },
          { status: 400 }
        );
      }
      const { data, error } = await supabase
        .from('currency_rates')
        .select('month, currency_code, rate_to_inr')
        .eq('month', monthDate)
        .order('currency_code');

      if (error) {
        return NextResponse.json(
          { error: 'Failed to load currency rates', details: error.message },
          { status: 500 }
        );
      }
      const byCode = (data ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.currency_code] = Number(row.rate_to_inr);
        return acc;
      }, {});
      return NextResponse.json({ data: { month: monthDate, rates: byCode } });
    }

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('currency_rates')
      .select('month, currency_code, rate_to_inr')
      .gte('month', startDate)
      .order('month', { ascending: true })
      .order('currency_code');

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load currency rates', details: error.message },
        { status: 500 }
      );
    }

    const byMonth: Record<string, Record<string, number>> = {};
    for (const row of data ?? []) {
      const monthKey = String(row.month).slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = {};
      byMonth[monthKey][row.currency_code] = Number(row.rate_to_inr);
    }
    return NextResponse.json({ data: byMonth });
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

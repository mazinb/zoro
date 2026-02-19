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

const BUCKET_KEYS = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other'] as const;

function firstDayOfMonth(monthStr: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (m < 1 || m > 12) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-01`;
}

/** GET: Fetch monthly expense for a month, or list months with data */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const month = request.nextUrl.searchParams.get('month');

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;
    const supabase = getSupabase();

    if (month) {
      const monthDate = firstDayOfMonth(month);
      if (!monthDate) {
        return NextResponse.json({ error: 'Invalid month (use YYYY-MM)' }, { status: 400 });
      }
      const { data, error } = await supabase
        .from('monthly_expenses')
        .select('id, month, buckets, imported_at, created_at, updated_at')
        .eq('user_id', userId)
        .eq('month', monthDate)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to load monthly data', details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ data: data ?? null });
    }

    const { data, error } = await supabase
      .from('monthly_expenses')
      .select('id, month, buckets, imported_at, created_at, updated_at')
      .eq('user_id', userId)
      .order('month', { ascending: false })
      .limit(24);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to list monthly data', details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ data: data ?? [] });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'Server error', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/** POST: Save monthly buckets. Set finalizeImport: true when saving after AI import (sets imported_at, blocks re-import). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, month: monthStr, buckets, finalizeImport } = body as {
      token?: string;
      month?: string;
      buckets?: Record<string, { value?: number } | number>;
      finalizeImport?: boolean;
    };

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    if (!monthStr || typeof monthStr !== 'string') {
      return NextResponse.json({ error: 'month (YYYY-MM) is required' }, { status: 400 });
    }
    if (!buckets || typeof buckets !== 'object') {
      return NextResponse.json({ error: 'buckets object is required' }, { status: 400 });
    }

    const monthDate = firstDayOfMonth(monthStr);
    if (!monthDate) {
      return NextResponse.json({ error: 'Invalid month (use YYYY-MM)' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;
    const supabase = getSupabase();

    const normalized: Record<string, number> = {};
    for (const k of BUCKET_KEYS) {
      const v = buckets[k];
      const num =
        v != null && typeof (v as { value?: number }).value === 'number'
          ? (v as { value: number }).value
          : typeof v === 'number'
            ? v
            : 0;
      normalized[k] = num;
    }
    const bucketsJson = Object.fromEntries(
      Object.entries(normalized).map(([k, v]) => [k, { value: v }])
    );

    if (finalizeImport) {
      const { data: existing } = await supabase
        .from('monthly_expenses')
        .select('id, imported_at')
        .eq('user_id', userId)
        .eq('month', monthDate)
        .maybeSingle();

      if (existing?.imported_at) {
        return NextResponse.json(
          { error: 'This month was already imported. Edit totals manually.' },
          { status: 409 }
        );
      }
    }

    const row = {
      user_id: userId,
      month: monthDate,
      buckets: bucketsJson,
      ...(finalizeImport ? { imported_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('monthly_expenses')
      .upsert(row, { onConflict: 'user_id,month', ignoreDuplicates: false })
      .select('id, month, buckets, imported_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save monthly data', details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: 'Server error', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

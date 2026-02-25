import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTokenToUserId } from '@/lib/resolve-token';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET_KEYS = ['housing', 'food', 'transportation', 'healthcare', 'entertainment', 'other', 'one_time', 'travel'] as const;

/** POST: Save expense estimates to expense_estimates table */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, buckets, comparedToActuals } = body as {
      token?: string;
      buckets?: Record<string, { value?: number }>;
      comparedToActuals?: boolean;
    };

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    if (!buckets || typeof buckets !== 'object') {
      return NextResponse.json({ error: 'buckets object is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;

    const normalized: Record<string, { value: number }> = {};
    for (const k of BUCKET_KEYS) {
      const v = buckets[k];
      const num = v != null && typeof (v as { value?: number }).value === 'number'
        ? (v as { value: number }).value
        : typeof v === 'number' ? v : 0;
      normalized[k] = { value: num };
    }

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const row = {
      user_id: userId,
      snapshot_date: snapshotDate,
      compared_to_actuals_at: comparedToActuals ? new Date().toISOString() : null,
      buckets: normalized,
    };

    const { data, error } = await supabase
      .from('expense_estimates')
      .insert(row)
      .select('id, snapshot_date, compared_to_actuals_at, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save estimates', details: error.message },
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

/** GET: List or get latest expense estimates for the user */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const latest = request.nextUrl.searchParams.get('latest') === '1';

    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token.trim());
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const userId = resolved.userId;

    if (latest) {
      const { data, error } = await supabase
        .from('expense_estimates')
        .select('id, snapshot_date, compared_to_actuals_at, buckets, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to load estimates', details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ data: data ?? null });
    }

    const { data, error } = await supabase
      .from('expense_estimates')
      .select('id, snapshot_date, compared_to_actuals_at, buckets, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to load estimates', details: error.message },
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

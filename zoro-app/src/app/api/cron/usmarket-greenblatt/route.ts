import { NextRequest, NextResponse } from 'next/server';

import { refreshGreenblattSnapshot } from '@/lib/usmarket/greenblatt-store';
import { tryGetSupabaseServiceRole } from '@/lib/supabase-server';

export const maxDuration = 300;

function authorize(request: NextRequest): boolean {
  const key = process.env.NAG_DISPATCH_KEY || process.env.USMARKET_REFRESH_KEY;
  if (!key) return false;
  return request.headers.get('authorization') === `Bearer ${key}`;
}

/** POST daily refresh of S&P 500 Greenblatt metrics (Yahoo Finance → Supabase cache). */
export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = tryGetSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  try {
    const result = await refreshGreenblattSnapshot(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
      },
      { status: 500 },
    );
  }
}

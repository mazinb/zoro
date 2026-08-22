import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import {
  isSnapshotStale,
  loadGreenblattSnapshot,
} from '@/lib/usmarket/greenblatt-store';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getPublicSupabase() {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getPublicSupabase();
    const snapshot = await loadGreenblattSnapshot(supabase);

    if (!snapshot) {
      return NextResponse.json({ error: 'No data yet' }, { status: 404 });
    }

    const stale = isSnapshotStale(snapshot.meta.refreshedAt);
    const sector = request.nextUrl.searchParams.get('sector');
    const stocks = sector
      ? snapshot.stocks.filter((s) => s.sector === sector)
      : snapshot.stocks;

    return NextResponse.json({
      data: {
        meta: { ...snapshot.meta, stale },
        stocks,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load snapshot',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

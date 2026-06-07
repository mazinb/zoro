import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServiceRole } from '@/lib/supabase-server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/** Closes the one-time onboarding import pool for this device. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const deviceId = toNonEmptyString((body as Record<string, unknown>)?.deviceId);
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  const { error } = await supabase.rpc('mobile_finish_onboarding_imports', {
    device_id_in: deviceId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deviceId, onboardingImportsEligible: false } });
}

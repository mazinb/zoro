import { NextRequest, NextResponse } from 'next/server';

import { entitlementsApiDataFromConsume } from '@/lib/mobile-token-billing';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const deviceId = toNonEmptyString(o.deviceId);
  const kind = toNonEmptyString(o.kind);
  if (!deviceId || !kind) {
    return NextResponse.json({ error: 'deviceId and kind are required' }, { status: 400 });
  }

  const onboardingPhase = o.onboardingPhase === true;
  const supabase = getSupabaseServiceRole();

  const { data, error } = await supabase.rpc('mobile_consume_import', {
    device_id_in: deviceId,
    kind_in: kind,
    onboarding_phase_in: onboardingPhase,
  });

  if (error) {
    const notEnough = /not enough tokens|not enough credits/i.test(error.message);
    const msg = notEnough ? 'Not enough tokens' : error.message;
    return NextResponse.json({ error: msg }, { status: notEnough ? 402 : 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'Entitlements missing' }, { status: 500 });

  return NextResponse.json({
    data: entitlementsApiDataFromConsume(row as Record<string, unknown>, deviceId),
  });
}

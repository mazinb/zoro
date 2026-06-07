import { NextRequest, NextResponse } from 'next/server';

import { effectiveIsPro } from '@/lib/mobile-entitlements';
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
    const msg = /not enough credits/i.test(error.message) ? 'Not enough credits' : error.message;
    return NextResponse.json({ error: msg }, { status: msg === 'Not enough credits' ? 402 : 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: 'Entitlements missing' }, { status: 500 });

  return NextResponse.json({
    data: {
      deviceId: row.device_id_out ?? deviceId,
      isPro: effectiveIsPro({
        is_pro: !!row.is_pro,
        pro_expires_at: row.pro_expires_at,
      }),
      proExpiresAt: row.pro_expires_at,
      creditsBalance: row.credits_balance ?? 0,
      freeAiMonthKey: row.free_ai_month_key,
      freeAiUsed: !!row.free_ai_used,
      onboardingImportsUsed: row.onboarding_imports_used ?? 0,
      onboardingImportsEligible: row.onboarding_imports_eligible !== false,
      updatedAt: row.updated_at,
    },
  });
}


import { NextRequest, NextResponse } from 'next/server';

import { entitlementsApiData } from '@/lib/mobile-token-billing';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Minimal device-based entitlements.
 *
 * Request: { deviceId, platform?, appVersion?, buildNumber? }
 * Response: { data: { deviceId, isPro, proExpiresAt?, creditsBalance, tokenBalance, tokensUsedTotal, ... } }
 *
 * Notes:
 * - Uses Supabase service role (server-side only). RLS is enabled on these tables.
 * - This is intentionally unauthenticated; deviceId should be random and stored on device.
 * - Later: verify IAP receipts server-side and update entitlements here.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const deviceId = toNonEmptyString(o.deviceId);
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }

  const platform = toNonEmptyString(o.platform) ?? 'ios';
  const appVersion = toNonEmptyString(o.appVersion);
  const buildNumber = toNonEmptyString(o.buildNumber);

  const supabase = getSupabaseServiceRole();

  // Upsert device row, and create entitlements if missing.
  const nowIso = new Date().toISOString();
  const { error: upsertDeviceError } = await supabase.from('mobile_devices').upsert(
    {
      device_id: deviceId,
      platform,
      app_version: appVersion,
      build_number: buildNumber,
      last_seen_at: nowIso,
    },
    { onConflict: 'device_id' }
  );
  if (upsertDeviceError) {
    return NextResponse.json({ error: upsertDeviceError.message }, { status: 500 });
  }

  // Ensure entitlements row exists (no-op if already present).
  const { error: ensureEntError } = await supabase.from('mobile_entitlements').upsert(
    {
      device_id: deviceId,
      // Defaults apply if row is created; provided values are ignored on conflict.
    },
    { onConflict: 'device_id', ignoreDuplicates: true as any }
  );
  if (ensureEntError) {
    // Some supabase-js versions don't support ignoreDuplicates on upsert options; fallback to insert.
    const { error: insertErr } = await supabase.from('mobile_entitlements').insert({ device_id: deviceId });
    if (insertErr && !/duplicate key/i.test(insertErr.message)) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  await supabase.rpc('mobile_reconcile_pro_status');
  // Month grant only — ignore until the token-billing migration is applied.
  await supabase.rpc('mobile_consume_tokens', {
    device_id_in: deviceId,
    tokens_in: 0,
    onboarding_phase_in: false,
    grant_only_in: true,
  });

  const { data, error } = await supabase
    .from('mobile_entitlements')
    .select(
      'device_id,is_pro,pro_expires_at,credits_balance,token_balance,tokens_used_total,free_ai_month_key,free_ai_used,onboarding_imports_used,onboarding_imports_eligible,updated_at',
    )
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Entitlements missing' }, { status: 500 });
  }

  return NextResponse.json({ data: entitlementsApiData(data) });
}


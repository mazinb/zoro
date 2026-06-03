import { NextRequest, NextResponse } from 'next/server';

import { effectiveIsPro } from '@/lib/mobile-entitlements';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

type EntitlementsRow = {
  device_id: string;
  is_pro: boolean;
  pro_expires_at: string | null;
  credits_balance: number;
  free_ai_month_key: string | null;
  free_ai_used: boolean;
  updated_at: string;
};

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

function clampInt(n: unknown, fallback = 0): number {
  const x = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(n, 10) : NaN;
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.floor(x));
}

/**
 * Minimal device-based entitlements.
 *
 * Request: { deviceId, platform?, appVersion?, buildNumber? }
 * Response: { data: { deviceId, isPro, proExpiresAt?, creditsBalance, freeAiMonthKey?, freeAiUsed } }
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

  // Monthly reset for free import grant.
  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const { data: currentEnt, error: entFetchErr } = await supabase
    .from('mobile_entitlements')
    .select('free_ai_month_key,free_ai_used')
    .eq('device_id', deviceId)
    .maybeSingle<{ free_ai_month_key: string | null; free_ai_used: boolean }>();
  if (entFetchErr) {
    return NextResponse.json({ error: entFetchErr.message }, { status: 500 });
  }
  if (currentEnt && (currentEnt.free_ai_month_key ?? '') !== monthKey) {
    const { error: resetErr } = await supabase
      .from('mobile_entitlements')
      .update({ free_ai_month_key: monthKey, free_ai_used: false })
      .eq('device_id', deviceId);
    if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 });
  } else if (!currentEnt?.free_ai_month_key) {
    const { error: seedErr } = await supabase
      .from('mobile_entitlements')
      .update({ free_ai_month_key: monthKey })
      .eq('device_id', deviceId);
    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });
  }

  await supabase.rpc('mobile_reconcile_pro_status');

  const { data, error } = await supabase
    .from('mobile_entitlements')
    .select('device_id,is_pro,pro_expires_at,credits_balance,free_ai_month_key,free_ai_used,updated_at')
    .eq('device_id', deviceId)
    .maybeSingle<EntitlementsRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Entitlements missing' }, { status: 500 });
  }

  const proActive = effectiveIsPro(data);

  return NextResponse.json({
    data: {
      deviceId: data.device_id,
      isPro: proActive,
      proExpiresAt: data.pro_expires_at,
      creditsBalance: clampInt(data.credits_balance, 0),
      freeAiMonthKey: data.free_ai_month_key,
      freeAiUsed: !!data.free_ai_used,
      updatedAt: data.updated_at,
    },
  });
}


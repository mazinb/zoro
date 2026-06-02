import { NextRequest, NextResponse } from 'next/server';

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
  const productId = toNonEmptyString(o.productId);
  if (!deviceId || !productId) {
    return NextResponse.json({ error: 'deviceId and productId are required' }, { status: 400 });
  }

  const transactionId = typeof o.transactionId === 'string' ? o.transactionId.trim() : null;
  const source = typeof o.source === 'string' ? o.source.trim() : null;
  const verificationData =
    typeof o.verificationData === 'string' ? o.verificationData : null;

  const supabase = getSupabaseServiceRole();

  // Ensure device exists.
  const { error: upsertDeviceError } = await supabase.from('mobile_devices').upsert(
    {
      device_id: deviceId,
      platform: 'ios',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'device_id' }
  );
  if (upsertDeviceError) {
    return NextResponse.json({ error: upsertDeviceError.message }, { status: 500 });
  }

  const { error } = await supabase.from('mobile_iap_events').insert({
    device_id: deviceId,
    product_id: productId,
    transaction_id: transactionId,
    source,
    verification_data: verificationData,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


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

  const supabase = getSupabaseServiceRole();

  const { error: rpcError } = await supabase.rpc('mobile_apply_product', {
    device_id_in: deviceId,
    product_id_in: productId,
  });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('mobile_entitlements')
    .select('device_id,is_pro,pro_expires_at,credits_balance,free_ai_month_key,free_ai_used,updated_at')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Entitlements missing' }, { status: 500 });

  return NextResponse.json({
    data: {
      deviceId: data.device_id,
      isPro: !!data.is_pro,
      proExpiresAt: data.pro_expires_at,
      creditsBalance: data.credits_balance ?? 0,
      freeAiMonthKey: data.free_ai_month_key,
      freeAiUsed: !!data.free_ai_used,
      updatedAt: data.updated_at,
    },
  });
}


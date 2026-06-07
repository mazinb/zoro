import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServiceRole } from '@/lib/supabase-server';

const ALLOWED_PROVIDERS = new Set([
  'appleFoundation',
  'zoroCloud',
  'openai',
  'anthropic',
  'gemini',
]);

function toNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Records user consent before the app sends personal data to a third-party AI provider.
 *
 * Request: { deviceId, provider, consentedAt?, appVersion?, platform?, privacyPolicyVersion? }
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
  const provider = toNonEmptyString(o.provider);
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId is required' }, { status: 400 });
  }
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'provider is invalid' }, { status: 400 });
  }

  const consentedAtRaw = toNonEmptyString(o.consentedAt);
  const consentedAt = consentedAtRaw ?? new Date().toISOString();
  const appVersion = toNonEmptyString(o.appVersion);
  const platform = toNonEmptyString(o.platform) ?? 'ios';
  const privacyPolicyVersion = toNonEmptyString(o.privacyPolicyVersion) ?? '2026-06-07';

  const supabase = getSupabaseServiceRole();
  const nowIso = new Date().toISOString();

  const { error: upsertDeviceError } = await supabase.from('mobile_devices').upsert(
    {
      device_id: deviceId,
      platform,
      app_version: appVersion,
      last_seen_at: nowIso,
    },
    { onConflict: 'device_id' }
  );
  if (upsertDeviceError) {
    return NextResponse.json({ error: upsertDeviceError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('mobile_ai_consents')
    .upsert(
      {
        device_id: deviceId,
        provider,
        consented_at: consentedAt,
        revoked_at: null,
        app_version: appVersion,
        platform,
        privacy_policy_version: privacyPolicyVersion,
      },
      { onConflict: 'device_id,provider' }
    )
    .select('device_id,provider,consented_at,privacy_policy_version')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      deviceId: data?.device_id ?? deviceId,
      provider: data?.provider ?? provider,
      consentedAt: data?.consented_at ?? consentedAt,
      privacyPolicyVersion: data?.privacy_policy_version ?? privacyPolicyVersion,
    },
  });
}

/** Revoke cloud / provider consent (opt out). */
export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const o = (body ?? {}) as Record<string, unknown>;
  const deviceId = toNonEmptyString(o.deviceId);
  const provider = toNonEmptyString(o.provider);
  if (!deviceId || !provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'deviceId and provider are required' }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('mobile_ai_consents')
    .update({ revoked_at: nowIso })
    .eq('device_id', deviceId)
    .eq('provider', provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { deviceId, provider, revokedAt: nowIso } });
}

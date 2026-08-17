import { NextRequest, NextResponse } from 'next/server';

import { cloudAssistantCompletion } from '@/lib/mobile-assistant-llm';
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
  const system = toNonEmptyString(o.system);
  const user = toNonEmptyString(o.user);
  if (!deviceId || !system || !user) {
    return NextResponse.json(
      { error: 'deviceId, system, and user are required' },
      { status: 400 },
    );
  }

  const preferJsonObject = o.preferJsonObject === true;
  const maxOutputTokens =
    typeof o.maxOutputTokens === 'number' && Number.isFinite(o.maxOutputTokens)
      ? Math.min(Math.max(Math.round(o.maxOutputTokens), 64), 8192)
      : undefined;
  const onboardingPhase = o.onboardingPhase === true;

  const supabase = getSupabaseServiceRole();
  const preflight = await supabase.rpc('mobile_consume_tokens', {
    device_id_in: deviceId,
    tokens_in: 0,
    onboarding_phase_in: onboardingPhase,
  });
  if (preflight.error) {
    const msg = /not enough tokens/i.test(preflight.error.message)
      ? 'Not enough tokens'
      : preflight.error.message;
    return NextResponse.json({ error: msg }, { status: msg === 'Not enough tokens' ? 402 : 500 });
  }

  try {
    const { text, tokensUsed } = await cloudAssistantCompletion({
      system,
      user,
      preferJsonObject,
      maxOutputTokens,
    });
    const billed = Math.max(1, tokensUsed);
    const consumed = await supabase.rpc('mobile_consume_tokens', {
      device_id_in: deviceId,
      tokens_in: billed,
      onboarding_phase_in: onboardingPhase,
    });
    const row = Array.isArray(consumed.data) ? consumed.data[0] : consumed.data;
    return NextResponse.json({
      text,
      tokensUsed: billed,
      data: row ? entitlementsApiDataFromConsume(row as Record<string, unknown>, deviceId) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Assistant failed';
    if (msg === 'FILE_TOO_LONG') {
      return NextResponse.json({ error: 'Prompt too long.' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Assistant failed. Try again.' }, { status: 502 });
  }
}

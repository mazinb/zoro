import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';

type PersonalityOptions = {
  tone: 'friendly' | 'direct' | 'firm';
  style: 'short' | 'balanced' | 'detailed';
};

type PersonalityPayload = {
  enabled: boolean;
  personality: string;
  soul_text: string;
  user_text: string;
  options: PersonalityOptions;
};

const DEFAULT_OPTIONS: PersonalityOptions = {
  tone: 'friendly',
  style: 'balanced',
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function normalizeOptions(raw: unknown): PersonalityOptions {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const toneRaw = asString(obj.tone).trim();
  const styleRaw = asString(obj.style).trim();
  const tone: PersonalityOptions['tone'] =
    toneRaw === 'direct' || toneRaw === 'firm' ? toneRaw : 'friendly';
  const style: PersonalityOptions['style'] =
    styleRaw === 'short' || styleRaw === 'detailed' ? styleRaw : 'balanced';
  return { tone, style };
}

function readFromSharedData(sharedData: unknown): Omit<PersonalityPayload, 'soul_default'> {
  const shared = sharedData && typeof sharedData === 'object' ? (sharedData as Record<string, unknown>) : {};
  return {
    enabled: shared.nag_personality_enabled === true,
    personality: asString(shared.nag_personality || shared.personality),
    soul_text: '',
    user_text: '',
    options: normalizeOptions(shared.nag_personality_options),
  };
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const [ctxResult, userDataResult] = await Promise.all([
      supabase
        .from('user_context')
        .select('soul_text,user_text')
        .eq('user_id', auth.userId)
        .maybeSingle(),
      supabase
        .from('user_data')
        .select('shared_data')
        .eq('user_id', auth.userId)
        .maybeSingle(),
    ]);

    if (ctxResult.error) {
      return NextResponse.json({ error: ctxResult.error.message }, { status: 500 });
    }
    if (userDataResult.error) {
      return NextResponse.json({ error: userDataResult.error.message }, { status: 500 });
    }

    const saved = readFromSharedData(userDataResult.data?.shared_data);
    const soulText = asString(ctxResult.data?.soul_text);
    const userText = asString(ctxResult.data?.user_text);

    return NextResponse.json({
      enabled: saved.enabled,
      personality: saved.personality,
      soul_text: soulText,
      user_text: userText,
      options: saved.options,
    } satisfies PersonalityPayload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'load personality failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const enabled = body.enabled === true;
    const personality = asString(body.personality).trim();
    const soulText = asString(body.soul_text);
    const userText = asString(body.user_text);
    const options = normalizeOptions(body.options ?? DEFAULT_OPTIONS);

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const [{ data: userRow, error: userErr }, { data: userDataRow, error: userDataErr }] = await Promise.all([
      supabase.from('users').select('verification_token').eq('id', auth.userId).maybeSingle(),
      supabase.from('user_data').select('id,shared_data').eq('user_id', auth.userId).maybeSingle(),
    ]);

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
    if (userDataErr) {
      return NextResponse.json({ error: userDataErr.message }, { status: 500 });
    }

    const existingShared =
      userDataRow?.shared_data && typeof userDataRow.shared_data === 'object'
        ? (userDataRow.shared_data as Record<string, unknown>)
        : {};

    const mergedShared = {
      ...existingShared,
      nag_personality_enabled: enabled,
      nag_personality: personality,
      nag_personality_options: options,
      updated_at: new Date().toISOString(),
    };

    if (userDataRow?.id) {
      const { error: updateErr } = await supabase
        .from('user_data')
        .update({
          shared_data: mergedShared,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userDataRow.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      const { error: upsertErr } = await supabase.from('user_data').upsert(
        {
          user_id: auth.userId,
          user_token: userRow?.verification_token ?? token,
          shared_data: mergedShared,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_token' }
      );
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    const { error: ctxUpdateErr } = await supabase
      .from('user_context')
      .update({
        soul_text: soulText,
        user_text: userText,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId);
    if (ctxUpdateErr) {
      return NextResponse.json({ error: ctxUpdateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      enabled,
      personality,
      soul_text: soulText,
      user_text: userText,
      options,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'save personality failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveTokenToUserId } from '@/lib/resolve-token';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabase() {
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase configuration');
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isSameUtcDay(a: string | null, b: Date): boolean {
  if (!a) return false;
  const d = new Date(a);
  return (
    d.getUTCFullYear() === b.getUTCFullYear() &&
    d.getUTCMonth() === b.getUTCMonth() &&
    d.getUTCDate() === b.getUTCDate()
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const result = await resolveTokenToUserId(token);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { userId } = result;

    const supabase = getSupabase();
    const { data: ctx, error } = await supabase
      .from('user_context')
      .select('soul_text, user_text, last_agent_edit_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!ctx) {
      return NextResponse.json({ error: 'No agent context found', status: 404 });
    }

    const now = new Date();
    const canEditToday = !isSameUtcDay(ctx.last_agent_edit_at ?? null, now);

    return NextResponse.json({
      soul_text: ctx.soul_text ?? '',
      user_text: ctx.user_text ?? '',
      last_agent_edit_at: ctx.last_agent_edit_at ?? null,
      can_edit_today: canEditToday,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const result = await resolveTokenToUserId(token);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { userId } = result;

    const body = await request.json().catch(() => ({}));
    const { soul_text: soulText, user_text: userText } = body;
    if (soulText === undefined && userText === undefined) {
      return NextResponse.json(
        { error: 'Provide soul_text and/or user_text to update' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data: ctx, error: fetchError } = await supabase
      .from('user_context')
      .select('soul_text, user_text, last_agent_edit_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!ctx) {
      return NextResponse.json({ error: 'No agent context found', status: 404 });
    }

    const now = new Date();
    if (isSameUtcDay(ctx.last_agent_edit_at ?? null, now)) {
      return NextResponse.json(
        { error: 'You can only update once per day. Try again tomorrow.' },
        { status: 429 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: now.toISOString(),
      last_agent_edit_at: now.toISOString(),
    };
    if (soulText !== undefined) updates.soul_text = soulText;
    if (userText !== undefined) updates.user_text = userText;

    const { data: updated, error: updateError } = await supabase
      .from('user_context')
      .update(updates)
      .eq('user_id', userId)
      .select('soul_text, user_text, last_agent_edit_at')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      soul_text: updated.soul_text ?? '',
      user_text: updated.user_text ?? '',
      last_agent_edit_at: updated.last_agent_edit_at ?? null,
      can_edit_today: false,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

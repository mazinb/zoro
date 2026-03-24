import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { getNagUserFlags } from '@/lib/nag-user';

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';
    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const { nag_developer } = await getNagUserFlags(supabase, auth.userId);
    if (!nag_developer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('nag_webhooks')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId);

    if (error) {
      if (error.code === '23503' || error.message.includes('foreign key')) {
        return NextResponse.json(
          { error: 'Remove or reassign nags using this webhook before deleting.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'delete failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

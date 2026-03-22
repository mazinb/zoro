import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { parseNagTextWithOpenAI } from '@/lib/nag-parse-openai';
import { tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { DEFAULT_NAG_TIMEZONE } from '@/lib/nag-timezone';
import { getUserNagTimezone } from '@/lib/nag-user';
import { isNagChannel } from '@/lib/nag-types';

/**
 * Natural-language → schedule draft. Lives at /api/nag-parse (not under /api/nags/parse)
 * so it cannot be shadowed by /api/nags/[id] in any router configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const defaultChannel =
      typeof body.default_channel === 'string' && isNagChannel(body.default_channel)
        ? body.default_channel
        : 'email';

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }
    if (!text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { userId } = auth;

    const supabase = tryGetSupabaseServiceRole();
    const profileTz = supabase ? await getUserNagTimezone(supabase, userId) : DEFAULT_NAG_TIMEZONE;
    if (!supabase && process.env.NODE_ENV === 'production') {
      console.warn('[nag-parse] Missing service role; using UTC for parse prompt');
    }

    const draft = await parseNagTextWithOpenAI(text, defaultChannel, profileTz);
    return NextResponse.json({ draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'parse failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

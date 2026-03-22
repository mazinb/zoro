import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { parseNagTextWithOpenAI } from '@/lib/nag-parse-openai';
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

    const draft = await parseNagTextWithOpenAI(text, defaultChannel);
    return NextResponse.json({ draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'parse failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

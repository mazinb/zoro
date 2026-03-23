import { NextRequest, NextResponse } from 'next/server';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { nagRequireUserId } from '@/lib/nag-auth';
import { SUPABASE_SERVICE_ROLE_SETUP, tryGetSupabaseServiceRole } from '@/lib/supabase-server';
import { isNagMemoryItem } from '@/lib/nag-memory-log';

export type NagSentLogEntry = {
  nag_id: string | null;
  sent_at: string;
  subject: string | null;
  body_preview: string | null;
  resend_id: string | null;
};

function extractNagSentLog(memoryJsonb: unknown, nagIdFilter: string | null): NagSentLogEntry[] {
  const memory = Array.isArray(memoryJsonb) ? memoryJsonb : [];
  const out: NagSentLogEntry[] = [];

  for (const raw of memory) {
    if (isNagMemoryItem(raw)) {
      if (nagIdFilter && raw.nag_id !== nagIdFilter) continue;
      out.push({
        nag_id: raw.nag_id,
        sent_at: raw.timestamp,
        subject: typeof raw.subject === 'string' ? raw.subject : null,
        body_preview: typeof raw.bodyPreview === 'string' ? raw.bodyPreview : null,
        resend_id: typeof raw.resend_id === 'string' ? raw.resend_id : null,
      });
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    if (o.type !== 'outbound') continue;
    const sub = typeof o.subject === 'string' ? o.subject : '';
    if (!sub.startsWith('Reminder:')) continue;
    if (nagIdFilter) continue;
    out.push({
      nag_id: typeof o.nag_id === 'string' ? o.nag_id : null,
      sent_at: typeof o.timestamp === 'string' ? o.timestamp : '',
      subject: sub || null,
      body_preview: typeof o.bodyPreview === 'string' ? o.bodyPreview : typeof o.body === 'string' ? o.body : null,
      resend_id: typeof o.resend_id === 'string' ? o.resend_id : null,
    });
  }

  return out
    .filter((e) => e.sent_at)
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const resolved = await resolveTokenToUserId(token);
    const auth = nagRequireUserId(resolved);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { userId } = auth;

    const nagId = request.nextUrl.searchParams.get('nag_id')?.trim() || null;

    const supabase = tryGetSupabaseServiceRole();
    if (!supabase) {
      return NextResponse.json({ error: SUPABASE_SERVICE_ROLE_SETUP }, { status: 503 });
    }

    const { data: ctx, error } = await supabase
      .from('user_context')
      .select('memory_jsonb')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const log = extractNagSentLog(ctx?.memory_jsonb ?? [], nagId);
    const limitRaw = request.nextUrl.searchParams.get('limit');
    const limit = limitRaw ? Math.min(200, Math.max(1, Number(limitRaw) || 50)) : 50;

    return NextResponse.json({ log: log.slice(0, limit) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sent-log failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

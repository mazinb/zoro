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

function startOfTodayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthUtc(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

type MemoryItem = {
  type?: string;
  subject?: string;
  timestamp?: string;
  bodyPreview?: string;
  body?: string;
  direction?: string;
};

/**
 * Pair each outbound (reply) to the inbound it was sent in response to:
 * for each outbound in time order, assign to the inbound with received_at <= outbound.timestamp
 * that is the most recent and not yet assigned. Returns inbounds in received_at DESC (newest first).
 */
function pairInboundsWithReplies(
  inbounds: Array<{
    id: string;
    received_at: string;
    from_address: string;
    subject: string | null;
    intent: string | null;
    intent_type: string | null;
    intent_confidence: number | null;
    intent_rationale: string | null;
    requires_human_review: boolean | null;
    user_flagged_for_review: boolean | null;
    user_review_comment: string | null;
    text_body: string | null;
  }>,
  memoryJsonb: unknown
): Array<{
  id: string;
  from_address: string;
  subject: string | null;
  received_at: string;
  intent: string | null;
  intent_type: string | null;
  intent_confidence: number | null;
  intent_rationale: string | null;
  requires_human_review: boolean | null;
  user_flagged_for_review: boolean | null;
  user_review_comment: string | null;
  text_body: string | null;
  reply_preview: string | null;
}> {
  const memory = (Array.isArray(memoryJsonb) ? memoryJsonb : []) as MemoryItem[];
  const outbounds = memory
    .filter((m) => m.type === 'outbound' && (m.bodyPreview ?? m.body))
    .map((m) => ({ timestamp: m.timestamp || '', bodyPreview: (m.bodyPreview ?? m.body) ?? '' }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const inboundsByTime = [...inbounds].sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  );

  const replyByInboundId = new Map<string, string>();
  const usedInboundIdx = new Set<number>();

  for (const ob of outbounds) {
    const outboundMs = new Date(ob.timestamp).getTime();
    let bestIdx: number | null = null;
    let bestReceivedMs = -1;
    for (let i = 0; i < inboundsByTime.length; i++) {
      if (usedInboundIdx.has(i)) continue;
      const receivedMs = new Date(inboundsByTime[i].received_at).getTime();
      if (receivedMs <= outboundMs && receivedMs > bestReceivedMs) {
        bestReceivedMs = receivedMs;
        bestIdx = i;
      }
    }
    if (bestIdx !== null) {
      usedInboundIdx.add(bestIdx);
      replyByInboundId.set(inboundsByTime[bestIdx].id, ob.bodyPreview);
    }
  }

  return inbounds.map((inv) => ({
    ...inv,
    reply_preview: replyByInboundId.get(inv.id) ?? null,
  })).sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
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
    const todayStart = startOfTodayUtc();
    const monthStart = startOfMonthUtc();

    const [
      { count: dailyUsed },
      { count: monthlyUsed },
      userRow,
      inboundsResult,
      ctxResult,
    ] = await Promise.all([
      supabase
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('sent_at', todayStart),
      supabase
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('sent_at', monthStart),
      supabase
        .from('users')
        .select('auto_responses_enabled, daily_email_limit, monthly_email_limit')
        .eq('id', userId)
        .single(),
      supabase
        .from('inbound_emails')
        .select(
          'id, from_address, subject, received_at, intent, intent_type, intent_confidence, intent_rationale, requires_human_review, user_flagged_for_review, user_review_comment, text_body'
        )
        .eq('user_id', userId)
        .order('received_at', { ascending: false }),
      supabase
        .from('user_context')
        .select('memory_jsonb')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const inbounds = inboundsResult.data ?? [];
    const memoryJsonb = ctxResult.data?.memory_jsonb ?? [];
    const paired = pairInboundsWithReplies(inbounds, memoryJsonb);

    const dailyLimit = userRow.data?.daily_email_limit ?? 3;
    const monthlyLimit = userRow.data?.monthly_email_limit ?? 10;

    return NextResponse.json({
      usage: {
        daily_used: dailyUsed ?? 0,
        daily_limit: dailyLimit,
        monthly_used: monthlyUsed ?? 0,
        monthly_limit: monthlyLimit,
      },
      auto_responses_enabled: userRow.data?.auto_responses_enabled ?? true,
      inbounds: paired,
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
    const { auto_responses_enabled } = body;
    if (typeof auto_responses_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Provide auto_responses_enabled (boolean)' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('users')
      .update({
        auto_responses_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('auto_responses_enabled')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ auto_responses_enabled: data?.auto_responses_enabled ?? true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

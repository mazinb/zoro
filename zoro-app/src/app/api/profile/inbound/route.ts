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

/**
 * PATCH /api/profile/inbound?token=...
 * Body: { inbound_id: string, user_flagged_for_review?: boolean, user_review_comment?: string }
 * Updates user flag and/or comment for an inbound email belonging to the token user.
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const result = await resolveTokenToUserId(token);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { userId } = result;

    const body = await request.json().catch(() => ({}));
    const { inbound_id: inboundId, user_flagged_for_review, user_review_comment } = body;
    if (!inboundId || typeof inboundId !== 'string') {
      return NextResponse.json(
        { error: 'inbound_id is required' },
        { status: 400 }
      );
    }
    if (user_flagged_for_review !== undefined && typeof user_flagged_for_review !== 'boolean') {
      return NextResponse.json(
        { error: 'user_flagged_for_review must be boolean if provided' },
        { status: 400 }
      );
    }
    if (user_review_comment !== undefined && typeof user_review_comment !== 'string') {
      return NextResponse.json(
        { error: 'user_review_comment must be string if provided' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const updates: Record<string, unknown> = {};
    if (user_flagged_for_review !== undefined) updates.user_flagged_for_review = user_flagged_for_review;
    if (user_review_comment !== undefined) updates.user_review_comment = user_review_comment;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Provide user_flagged_for_review and/or user_review_comment' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('inbound_emails')
      .update(updates)
      .eq('id', inboundId)
      .eq('user_id', userId)
      .select('id, user_flagged_for_review, user_review_comment')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Inbound not found or access denied' }, { status: 404 });
    }
    return NextResponse.json({
      id: data.id,
      user_flagged_for_review: data.user_flagged_for_review ?? false,
      user_review_comment: data.user_review_comment ?? null,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

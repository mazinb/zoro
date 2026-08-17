import { NextRequest, NextResponse } from 'next/server';

import { MAILBOX_BUCKET } from '@/lib/mobile-mailbox';
import { tryGetSupabaseServiceRole } from '@/lib/supabase-server';

function authorize(request: NextRequest): boolean {
  const key = process.env.NAG_DISPATCH_KEY || process.env.MAILBOX_PURGE_KEY;
  if (!key) return false;
  return request.headers.get('authorization') === `Bearer ${key}`;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = tryGetSupabaseServiceRole();
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  const { data: expired } = await supabase
    .from('mobile_mailbox_messages')
    .select('id,storage_path')
    .or('acked_at.not.is.null,expires_at.lt.' + new Date().toISOString());

  const paths = (expired ?? []).map((r) => r.storage_path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from(MAILBOX_BUCKET).remove(paths);
  }
  const { data: n, error } = await supabase.rpc('mobile_mailbox_purge_expired');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, purged: n ?? 0, files: paths.length });
}

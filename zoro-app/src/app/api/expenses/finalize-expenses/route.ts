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

/** Sets expenses_used_at for the user so they cannot run the flow again. */
export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
  }

  const resolved = await resolveTokenToUserId(token);
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error === 'Invalid or expired link' ? resolved.error : 'Invalid token.' },
      { status: resolved.status }
    );
  }
  const userId = resolved.userId;

  const supabase = getSupabase();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, expenses_used_at')
    .eq('id', userId)
    .maybeSingle();

  if (userError || !user?.id) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }
  if (user.expenses_used_at) {
    return NextResponse.json(
      { error: 'Already used', message: "You've already used the expenses analysis once." },
      { status: 409 }
    );
  }

  const { error: updateErr } = await supabase
    .from('users')
    .update({ expenses_used_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to finalize.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

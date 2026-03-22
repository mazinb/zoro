import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST { email } → { registered: boolean }
 * Does not send email. Used by /nag Get started before asking for name.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Service not configured.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('[nag-email-check]', error.message);
      return NextResponse.json({ error: 'Could not check email.' }, { status: 500 });
    }

    return NextResponse.json({ registered: Boolean(user?.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Check failed';
    console.error('[nag-email-check]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

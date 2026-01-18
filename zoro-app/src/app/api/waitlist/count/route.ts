import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const clientKey = serviceRoleKey || anonKey!;
    const supabase = createClient(supabaseUrl, clientKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { count, error } = await supabase
      .from('form_submissions')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Waitlist count error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch waitlist count' },
        { status: 500 }
      );
    }

    return NextResponse.json({ count: count || 0 }, { status: 200 });
  } catch (error) {
    console.error('Waitlist count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waitlist count' },
      { status: 500 }
    );
  }
}


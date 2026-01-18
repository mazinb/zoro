import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Verify email verification token
// In production, this should check against a database table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 }
      );
    }

    const isValidToken = /^[a-f0-9]{64}$/.test(token);

    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Verification service unavailable' },
        { status: 503 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const tokenClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: tokenRow, error: tokenError } = await tokenClient
      .from('email_verification_tokens')
      .select('id, email, expires_at, used_at')
      .eq('token', token)
      .eq('email', normalizedEmail)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    if (tokenRow.used_at) {
      return NextResponse.json(
        { error: 'Verification token already used' },
        { status: 400 }
      );
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Verification token expired' },
        { status: 400 }
      );
    }

    const { error: updateError } = await tokenClient
      .from('email_verification_tokens')
      .update({
        used_at: new Date().toISOString()
      })
      .eq('id', tokenRow.id);

    if (updateError) {
      console.error('Error marking verification token used:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify token' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        valid: true,
        email: normalizedEmail
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying token:', error);
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}


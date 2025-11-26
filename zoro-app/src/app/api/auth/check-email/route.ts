import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Check if email exists and generate verification token if needed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Use service role key to check if user exists (if available)
    // Otherwise, we'll check via form_submissions table
    let userExists = false;

    if (supabaseServiceKey && supabaseServiceKey !== process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Try to get user by email using admin API
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (!listError && users?.users) {
          userExists = users.users.some(
            user => user.email?.toLowerCase() === normalizedEmail
          );
        }
      } catch (err) {
        console.error('Error checking users with admin API:', err);
        // Fall through to check form_submissions
      }
    }

    // Also check form_submissions for existing email
    if (!userExists) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: submissions } = await supabase
        .from('form_submissions')
        .select('email, user_id')
        .eq('email', normalizedEmail)
        .limit(1);

      // If submission exists with a user_id, user likely exists
      if (submissions && submissions.length > 0 && submissions[0].user_id) {
        userExists = true;
      }
    }

    if (userExists) {
      return NextResponse.json(
        { 
          exists: true,
          message: 'An account with this email already exists. Please log in instead.'
        },
        { status: 200 }
      );
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    // Store token in database (we'll need a table for this)
    // For now, we'll return the token and the client will store it temporarily
    // In production, store this in a database table like email_verification_tokens

    return NextResponse.json(
      { 
        exists: false,
        token,
        expiresAt: expiresAt.toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in check-email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


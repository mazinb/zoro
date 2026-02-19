import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateUserToken(): string {
  return randomBytes(16).toString('hex');
}

// GET - Load user data by token (users.verification_token) or email
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token && !email) {
      return NextResponse.json(
        { error: 'Token or email is required' },
        { status: 400 }
      );
    }

    let userId: string | null = null;

    // Step 1: Find user in users table by verification_token or email
    if (token) {
      const { data: tokenUser, error: tokenError } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('verification_token', token)
        .maybeSingle();

      if (tokenError) {
        return NextResponse.json(
          { error: 'Failed to fetch user data', details: tokenError.message },
          { status: 500 }
        );
      }
      
      if (tokenUser?.id) {
        userId = tokenUser.id;
      }
    }

    // If not found by token, try email
    if (!userId && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const { data: emailUser, error: emailError } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (emailError) {
        return NextResponse.json(
          { error: 'Failed to fetch user data', details: emailError.message },
          { status: 500 }
        );
      }
      
      if (emailUser?.id) {
        userId = emailUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ data: null });
    }

    // Step 2: Load user_data by user_id
    const { data: userData, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch user data', details: error.message },
        { status: 500 }
      );
    }

    // If no user_data record exists, return user info from users table
    if (!userData) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('id', userId)
        .single();

      if (userError) {
        return NextResponse.json(
          { error: 'Failed to fetch user data', details: userError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        data: {
          email: user?.email || null,
          verification_token: user?.verification_token || null,
        }
      });
    }

    return NextResponse.json({ data: userData });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch user data', details: error?.message },
      { status: 500 }
    );
  }
}

// POST - Create or update user data
// Uses users.verification_token as primary identifier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      email,
      name,
      formType,
      formData,
      expenseBuckets, // For retirement form
      sharedData,
    } = body;

    if (!formType) {
      return NextResponse.json(
        { error: 'formType is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

    // Step 1: Find or create user in users table
    let userId: string | null = null;
    let userToken: string | null = token || null;

    // Try to find user by verification_token
    if (userToken) {
      const { data: tokenUser, error: tokenError } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('verification_token', userToken)
        .maybeSingle();

      if (tokenError) {
        return NextResponse.json(
          { error: 'Failed to save user data', details: tokenError.message },
          { status: 500 }
        );
      }
      
      if (tokenUser?.id) {
        userId = tokenUser.id;
        // If email was provided and different, update it
        if (normalizedEmail && tokenUser.email !== normalizedEmail) {
          const { error: updateEmailError } = await supabase
            .from('users')
            .update({ email: normalizedEmail })
            .eq('id', userId);
          if (updateEmailError) {
            return NextResponse.json(
              { error: 'Failed to save user data', details: updateEmailError.message },
              { status: 500 }
            );
          }
        }
      }
    }

    // If not found by token, try email
    if (!userId && normalizedEmail) {
      const { data: emailUser, error: emailError } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (emailError) {
        return NextResponse.json(
          { error: 'Failed to save user data', details: emailError.message },
          { status: 500 }
        );
      }
      
      if (emailUser?.id) {
        userId = emailUser.id;
        userToken = emailUser.verification_token || userToken;
        
        // If user exists but has no verification_token, generate one
        if (!emailUser.verification_token && userToken) {
          const { error: updateTokenError } = await supabase
            .from('users')
            .update({ verification_token: userToken })
            .eq('id', userId);
          if (updateTokenError) {
            return NextResponse.json(
              { error: 'Failed to save user data', details: updateTokenError.message },
              { status: 500 }
            );
          }
        }
      }
    }

    // Create new user if doesn't exist
    if (!userId) {
      // Generate token if not provided
      if (!userToken) {
        userToken = generateUserToken();
      }

      const nextCheckinDue = new Date();
      nextCheckinDue.setDate(nextCheckinDue.getDate() + 15);

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: normalizedEmail,
          verification_token: userToken,
          checkin_frequency: 'monthly',
          next_checkin_due: nextCheckinDue.toISOString(),
        })
        .select('id')
        .single();

      if (createError) {
        // If insert failed (e.g., duplicate email), try to find again
        if (normalizedEmail) {
          const { data: existingUser, error: relookupError } = await supabase
            .from('users')
            .select('id, verification_token')
            .eq('email', normalizedEmail)
            .maybeSingle();

          if (relookupError) {
            return NextResponse.json(
              { error: 'Failed to save user data', details: relookupError.message },
              { status: 500 }
            );
          }
          
          if (existingUser?.id) {
            userId = existingUser.id;
            userToken = existingUser.verification_token || userToken;
            
            // Update token if missing
            if (!existingUser.verification_token && userToken) {
              const { error: updateExistingTokenError } = await supabase
                .from('users')
                .update({ verification_token: userToken })
                .eq('id', userId);
              if (updateExistingTokenError) {
                return NextResponse.json(
                  { error: 'Failed to save user data', details: updateExistingTokenError.message },
                  { status: 500 }
                );
              }
            }
          }
        }
      } else if (newUser?.id) {
        userId = newUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Failed to create or find user' },
        { status: 500 }
      );
    }

    const sharedDataUpdate = sharedData
      ? { shared_data: sharedData }
      : {};

    const updateData: Record<string, any> = {
      user_id: userId, // Link to users table
      user_token: userToken, // Keep legacy column in sync for compatibility
      updated_at: new Date().toISOString(),
      ...sharedDataUpdate,
    };

    if (normalizedEmail) {
      updateData.email = normalizedEmail;
    }

    if (name) {
      updateData.name = String(name).trim();
    }

    // Update form-specific data
    if (formData) {
      updateData[`${formType}_answers`] = formData;
    }

    // Handle expense buckets for retirement or expenses form
    if ((formType === 'retirement' || formType === 'expenses') && expenseBuckets) {
      updateData.retirement_expense_buckets = expenseBuckets;
    }

    // Upsert by user_token so we always have a single row per verification token
    const upsertData: Record<string, any> = {
      user_id: userId,
      user_token: userToken,
      email: normalizedEmail,
      name: name ? String(name).trim() : null,
      [`${formType}_answers`]: formData || null,
      shared_data: sharedData || {},
      ...updateData,
    };

    // Add expense buckets for retirement or expenses form
    if ((formType === 'retirement' || formType === 'expenses') && expenseBuckets) {
      upsertData.retirement_expense_buckets = expenseBuckets;
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('user_data')
      .upsert(upsertData, { onConflict: 'user_token' })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save user data', details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: userToken,
      data: upserted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save user data', details: error?.message },
      { status: 500 }
    );
  }
}


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
      const { data: tokenUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('verification_token', token)
        .maybeSingle();
      
      if (tokenUser?.id) {
        userId = tokenUser.id;
      }
    }

    // If not found by token, try email
    if (!userId && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const { data: emailUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
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
      const { data: user } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('id', userId)
        .single();
      
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
      const { data: tokenUser } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('verification_token', userToken)
        .maybeSingle();
      
      if (tokenUser?.id) {
        userId = tokenUser.id;
        // If email was provided and different, update it
        if (normalizedEmail && tokenUser.email !== normalizedEmail) {
          await supabase
            .from('users')
            .update({ email: normalizedEmail })
            .eq('id', userId);
        }
      }
    }

    // If not found by token, try email
    if (!userId && normalizedEmail) {
      const { data: emailUser } = await supabase
        .from('users')
        .select('id, email, verification_token')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (emailUser?.id) {
        userId = emailUser.id;
        userToken = emailUser.verification_token || userToken;
        
        // If user exists but has no verification_token, generate one
        if (!emailUser.verification_token && userToken) {
          await supabase
            .from('users')
            .update({ verification_token: userToken })
            .eq('id', userId);
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
          const { data: existingUser } = await supabase
            .from('users')
            .select('id, verification_token')
            .eq('email', normalizedEmail)
            .maybeSingle();
          
          if (existingUser?.id) {
            userId = existingUser.id;
            userToken = existingUser.verification_token || userToken;
            
            // Update token if missing
            if (!existingUser.verification_token && userToken) {
              await supabase
                .from('users')
                .update({ verification_token: userToken })
                .eq('id', userId);
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

    // Step 2: Check if user_data record exists for this user
    const { data: existing } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const sharedDataUpdate = sharedData
      ? { shared_data: sharedData }
      : {};

    const updateData: Record<string, any> = {
      user_id: userId, // Link to users table
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

    // Handle expense buckets for retirement form
    if (formType === 'retirement' && expenseBuckets) {
      updateData.retirement_expense_buckets = expenseBuckets;
    }

    if (existing) {
      // Update existing record
      const { data: updated, error } = await supabase
        .from('user_data')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to update user data', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        token: userToken,
        data: updated,
      });
    } else {
      // Create new record
      const insertData: Record<string, any> = {
        user_id: userId, // Link to users table
        email: normalizedEmail,
        name: name ? String(name).trim() : null,
        [`${formType}_answers`]: formData || null,
        shared_data: sharedData || {},
        ...updateData,
      };

      // Add expense buckets for retirement form
      if (formType === 'retirement' && expenseBuckets) {
        insertData.retirement_expense_buckets = expenseBuckets;
      }

      const { data: created, error } = await supabase
        .from('user_data')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to create user data', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        token: userToken,
        data: created,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save user data', details: error?.message },
      { status: 500 }
    );
  }
}


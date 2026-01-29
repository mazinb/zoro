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

// GET - Load user data by token
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

    let query = supabase.from('user_data').select('*');

    if (token) {
      query = query.eq('user_token', token);
    } else if (email) {
      query = query.eq('email', email.toLowerCase().trim());
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch user data', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch user data', details: error?.message },
      { status: 500 }
    );
  }
}

// POST - Create or update user data
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

    // Determine user token
    let userToken = token;
    if (!userToken) {
      // Try to find existing user by email
      if (normalizedEmail) {
        const { data: existing } = await supabase
          .from('user_data')
          .select('user_token')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (existing?.user_token) {
          userToken = existing.user_token;
        }
      }

      // Generate new token if still no token
      if (!userToken) {
        userToken = generateUserToken();
      }
    }

    // Check if user exists
    const { data: existing } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_token', userToken)
      .maybeSingle();

    const formDataField = `${formType}_answers` as keyof typeof existing;
    const sharedDataUpdate = sharedData
      ? { shared_data: sharedData }
      : {};

    const updateData: Record<string, any> = {
      user_token: userToken,
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
        .eq('user_token', userToken)
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
        user_token: userToken,
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


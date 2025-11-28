import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const getClient = (token: string) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getClient(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { advisorId, registrationNo, name, email } = body;

    if (!advisorId || !registrationNo || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Verify advisor exists
    const { data: advisorData, error: advisorError } = await supabase
      .from('advisors')
      .select('id')
      .eq('id', advisorId)
      .maybeSingle();

    if (advisorError || !advisorData) {
      return NextResponse.json(
        { error: 'Advisor not found' },
        { status: 404 },
      );
    }

    // Check if signup already exists
    const { data: existingSignup } = await supabase
      .from('advisor_signups')
      .select('id')
      .eq('user_id', user.id)
      .eq('advisor_id', advisorId)
      .maybeSingle();

    if (existingSignup) {
      return NextResponse.json({
        success: true,
        message: 'Advisor signup already recorded',
      });
    }

    // Insert advisor signup (RLS policy allows authenticated users to insert their own)
    const { data, error } = await supabase
      .from('advisor_signups')
      .insert({
        advisor_id: advisorId,
        user_id: user.id,
        registration_no: registrationNo,
        advisor_name: name,
        email: email,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving advisor signup:', error);
      return NextResponse.json(
        { error: 'Failed to save advisor signup', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Advisor signup recorded successfully',
      data,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/advisors/signup:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getSupabaseClient(token?: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from('checkin_settings')
      .select('frequency, goals, last_updated')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching check-in settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch check-in settings', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        frequency: data?.frequency ?? null,
        goals: data?.goals ?? [],
        last_updated: data?.last_updated ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in GET /api/checkin/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { frequency, goals } = body as {
      frequency?: string;
      goals?: string[];
    };

    const allowedFrequencies = [
      'Daily',
      'Every 3 days',
      'Weekly',
      'Bi-weekly',
      'Monthly',
    ];

    if (!frequency || !allowedFrequencies.includes(frequency)) {
      return NextResponse.json(
        {
          error:
            'Invalid frequency. Must be one of: Daily, Every 3 days, Weekly, Bi-weekly, Monthly',
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(goals)) {
      return NextResponse.json(
        { error: 'Goals must be an array of strings' },
        { status: 400 },
      );
    }

    if (goals.length === 0 || goals.length > 3) {
      return NextResponse.json(
        { error: 'Please select between 1 and 3 goals' },
        { status: 400 },
      );
    }

    const cleanGoals = goals.map((g) => String(g));

    const { data, error } = await supabase
      .from('checkin_settings')
      .upsert(
        {
          user_id: user.id,
          frequency,
          goals: cleanGoals,
          last_updated: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      )
      .select('frequency, goals, last_updated')
      .single();

    if (error) {
      console.error('Error saving check-in settings:', error);
      return NextResponse.json(
        { error: 'Failed to save check-in settings', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        frequency: data.frequency,
        goals: data.goals,
        last_updated: data.last_updated,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in POST /api/checkin/settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}



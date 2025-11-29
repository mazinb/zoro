import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

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
    const supabase = getSupabaseClient(token);

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
    const { advisorId, checkInFrequency, selectedGoals, expertiseExplanation } = body;

    if (!advisorId || !checkInFrequency || !selectedGoals || !expertiseExplanation) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    if (!Array.isArray(selectedGoals) || selectedGoals.length === 0) {
      return NextResponse.json(
        { error: 'At least one goal must be selected' },
        { status: 400 },
      );
    }

    const validFrequencies = ['weekly', 'biweekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(checkInFrequency)) {
      return NextResponse.json(
        { error: 'Invalid check-in frequency' },
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

    // Upsert advisor preferences
    const { data, error } = await supabase
      .from('advisor_preferences')
      .upsert(
        {
          advisor_id: advisorId,
          user_id: user.id,
          check_in_frequency: checkInFrequency,
          selected_goals: selectedGoals,
          expertise_explanation: expertiseExplanation.trim(),
        },
        {
          onConflict: 'advisor_id,user_id',
        },
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving advisor preferences:', error);
      return NextResponse.json(
        { error: 'Failed to save preferences', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      preferences: data,
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/advisors/preferences:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .from('advisor_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching advisor preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      preferences: data,
    });
  } catch (err) {
    console.error('Unexpected error in GET /api/advisors/preferences:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}


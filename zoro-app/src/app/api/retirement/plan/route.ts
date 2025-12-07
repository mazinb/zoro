import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
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
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('retirement_plans')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching retirement plan:', error);
      return NextResponse.json(
        { error: 'Failed to fetch retirement plan', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan: data || null });
  } catch (error: any) {
    console.error('Error in GET /api/retirement/plan:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
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
        { status: 401 }
      );
    }

    const body = await request.json();

    // Check if plan already exists
    const { data: existing } = await supabase
      .from('retirement_plans')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const planData = {
      user_id: user.id,
      lifestyle: body.lifestyle || null,
      country: body.country || 'India',
      housing: body.housing || null,
      healthcare: body.healthcare || null,
      travel: body.travel || null,
      safety: body.safety || null,
      expense_buckets: body.expense_buckets || null,
      annual_spend: body.annual_spend || null,
      required_amount: body.required_amount || null,
      aggressive_amount: body.aggressive_amount || null,
      balanced_amount: body.balanced_amount || null,
      conservative_amount: body.conservative_amount || null,
      currency: body.currency || '₹',
      email_for_breakdown: body.email_for_breakdown || null,
      liquid_net_worth: body.liquid_net_worth ? parseFloat(body.liquid_net_worth) : null,
      annual_income_job: body.annual_income_job ? parseFloat(body.annual_income_job) : null,
      other_income: body.other_income ? parseFloat(body.other_income) : null,
      pension: body.pension ? parseFloat(body.pension) : null,
    };

    let result;
    if (existing) {
      // Update existing plan
      const { data, error } = await supabase
        .from('retirement_plans')
        .update(planData)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      result = data;
    } else {
      // Insert new plan
      const { data, error } = await supabase
        .from('retirement_plans')
        .insert(planData)
        .select()
        .single();

      if (error) {
        throw error;
      }
      result = data;
    }

    return NextResponse.json({ 
      success: true, 
      plan: result 
    });
  } catch (error: any) {
    console.error('Error in POST /api/retirement/plan:', error);
    return NextResponse.json(
      { error: 'Failed to save retirement plan', details: error.message },
      { status: 500 }
    );
  }
}


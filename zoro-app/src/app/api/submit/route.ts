import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log the form data
    console.log('Form submission received:', body);
    
    // Validate required fields
    if (!body.primaryGoal || !body.netWorth || !body.estateStatus || !body.timeHorizon || !body.concernLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (!body.contactMethod) {
      return NextResponse.json(
        { error: 'Contact method is required' },
        { status: 400 }
      );
    }
    
    // Save to database - convert camelCase to snake_case
    // Convert empty strings to null for optional fields
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        primary_goal: body.primaryGoal,
        net_worth: body.netWorth,
        estate_status: body.estateStatus,
        time_horizon: body.timeHorizon,
        concern_level: body.concernLevel,
        contact_method: body.contactMethod,
        phone: body.phone && body.phone.trim() ? body.phone : null,
        additional_info: body.additionalInfo && body.additionalInfo.trim() ? body.additionalInfo : null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving form submission to database:', error);
      return NextResponse.json(
        { error: 'Failed to save form submission', details: error.message },
        { status: 500 }
      );
    }
    
    // Return success with the saved data
    return NextResponse.json(
      { 
        success: true, 
        message: 'Form submitted successfully',
        data: data
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing form submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


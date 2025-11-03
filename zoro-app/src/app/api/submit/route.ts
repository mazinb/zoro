import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // Get user if authenticated
    let userId = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
      
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (!authError && user) {
        userId = user.id;
      }
    }

    // Use userId from body if provided (fallback for client-side)
    if (!userId && body.userId) {
      userId = body.userId;
    }
    
    // Save to database - convert camelCase to snake_case
    // Convert empty strings to null for optional fields
    const { data, error } = await supabase
      .from('form_submissions')
      .insert({
        user_id: userId || null,
        primary_goal: body.primaryGoal,
        net_worth: body.netWorth,
        estate_status: body.estateStatus,
        time_horizon: body.timeHorizon,
        concern_level: body.concernLevel,
        contact_method: body.contactMethod,
        phone: body.phone && body.phone.trim() ? body.phone : null,
        additional_info: body.additionalInfo && body.additionalInfo.trim() ? body.additionalInfo : null,
        email: body.email && body.email.trim() ? body.email.trim() : null
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


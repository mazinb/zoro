import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
      );
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client with the user's token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Verify the user's session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferred_communication_method } = body;

    // Validate the communication method
    if (!preferred_communication_method || !['email', 'whatsapp'].includes(preferred_communication_method)) {
      return NextResponse.json(
        { error: 'Invalid communication method. Must be "email" or "whatsapp"' },
        { status: 400 }
      );
    }

    // Update or insert user profile
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .upsert({
        id: user.id,
        email: user.email,
        preferred_communication_method: preferred_communication_method,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving communication preference:', error);
      return NextResponse.json(
        { error: 'Failed to save preference', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Communication preference saved successfully',
        data: data
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing preference update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No authorization header' },
        { status: 401 }
      );
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client with the user's token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Verify the user's session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // Get user profile
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('preferred_communication_method')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching communication preference:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preference', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        preferred_communication_method: data?.preferred_communication_method || null
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing preference fetch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


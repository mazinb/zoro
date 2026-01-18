import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Form submission received:', body);

    const hasLegacyShape =
      body.primaryGoal &&
      body.netWorth &&
      body.estateStatus &&
      body.timeHorizon &&
      body.concernLevel &&
      body.contactMethod;

    const hasNewShape = Array.isArray(body.goals) && body.goals.length > 0 && body.contactMethod;

    if (!hasLegacyShape && !hasNewShape) {
      return NextResponse.json(
        { error: 'Missing required fields for form submission' },
        { status: 400 },
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const adminClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
      : null;
    
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Waitlist service unavailable' },
        { status: 503 }
      );
    }

    // Get user if authenticated
    let userId = null;
    let userEmailConfirmed = false;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseClient = getSupabaseClient(token);

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (!authError && user) {
        userId = user.id;
        userEmailConfirmed = Boolean((user as any).email_confirmed_at || (user as any).confirmed_at);
      }
    }

    // Use userId from body if provided (fallback for client-side)
    if (!userId && body.userId) {
      userId = body.userId;
    }

    let insertPayload: Record<string, unknown>;
    const normalizedEmail = body.email && String(body.email).trim()
      ? String(body.email).trim().toLowerCase()
      : null;

    if (hasLegacyShape) {
      // Original question-based flow
      insertPayload = {
        user_id: userId || null,
        primary_goal: body.primaryGoal,
        net_worth: body.netWorth,
        estate_status: body.estateStatus,
        time_horizon: body.timeHorizon,
        concern_level: body.concernLevel,
        contact_method: body.contactMethod,
        phone: body.phone && body.phone.trim() ? body.phone : null,
        additional_info: body.additionalInfo && body.additionalInfo.trim() ? body.additionalInfo : null,
        email: normalizedEmail
      };
    } else {
      // New landing/onboarding flow: goals + details
      const goals: string[] = Array.isArray(body.goals) ? body.goals : [];
      const primaryGoal = goals[0] || 'not_set';

      const enrichedAdditionalInfo = {
        goals,
        goalDetails: body.goalDetails || null,
        additionalInfo: body.additionalInfo || null,
      };

      insertPayload = {
        user_id: userId || null,
        primary_goal: primaryGoal,
        net_worth: body.netWorth || '',
        estate_status: 'not_provided_v2',
        time_horizon: 'not_provided_v2',
        concern_level: 'not_provided_v2',
        contact_method: body.contactMethod,
        phone: body.phone && String(body.phone).trim() ? String(body.phone) : null,
        additional_info: JSON.stringify(enrichedAdditionalInfo),
        email: normalizedEmail
      };
    }

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: 'Email is required to join the waitlist' },
        { status: 400 }
      );
    }

    const verificationClient = adminClient;

    // Enforce verified email before saving to waitlist
    let emailIsVerified = userEmailConfirmed;
    if (!emailIsVerified) {
      const { data: verificationRow } = await verificationClient
        .from('email_verification_tokens')
        .select('id, used_at')
        .eq('email', normalizedEmail)
        .not('used_at', 'is', null)
        .limit(1)
        .maybeSingle();

      emailIsVerified = Boolean(verificationRow?.used_at);
    }

    if (!emailIsVerified) {
      return NextResponse.json(
        { error: 'Email must be verified before joining the waitlist' },
        { status: 403 }
      );
    }

    // Ensure only one entry per email
    const { data: existingSubmission } = await verificationClient
      .from('form_submissions')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (existingSubmission?.id) {
      return NextResponse.json(
        { error: 'An entry already exists for this email' },
        { status: 409 }
      );
    }

    // Insert form submission
    const { data: submissionData, error: submissionError } = await supabase
      .from('form_submissions')
      .insert(insertPayload)
      .select()
      .single();

    if (submissionError) {
      console.error('Error saving form submission to database:', submissionError);
      return NextResponse.json(
        { error: 'Failed to save form submission', details: submissionError.message },
        { status: 500 }
      );
    }

    // If we have goal details in the new flow, save them to goal_details table
    if (!hasLegacyShape && body.goalDetails && submissionData?.id) {
      const goalDetails = body.goalDetails as Record<string, { main: string; extra?: string }>;
      const goalsArray = Array.isArray(body.goals) ? body.goals : [];

      const goalDetailsInserts = goalsArray
        .filter((goalId: string) => goalDetails[goalId]?.main)
        .map((goalId: string) => ({
          form_submission_id: submissionData.id,
          user_id: userId || null,
          goal_id: goalId,
          main_context: goalDetails[goalId].main,
          extra_context: goalDetails[goalId].extra || null,
        }));

      if (goalDetailsInserts.length > 0) {
        // Use authenticated client if available, otherwise use service role
        const token = authHeader?.replace('Bearer ', '');
        const clientForGoalDetails = userId && token
          ? getSupabaseClient(token)
          : supabase;

        const { error: goalDetailsError } = await clientForGoalDetails
          .from('goal_details')
          .insert(goalDetailsInserts);

        if (goalDetailsError) {
          console.error('Error saving goal details:', goalDetailsError);
          // Don't fail the whole submission if goal details fail
        }
      }
    }

    // Return success with the saved data
    return NextResponse.json(
      {
        success: true,
        message: 'Form submitted successfully',
        data: submissionData
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


import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-server';
import { buildDraftResponseEmail } from '@/lib/email-drafting';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
      : supabase;

    if (!serviceRoleKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set; using anon client for submission checks');
    }

    // Get user if authenticated
    let userId = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const supabaseClient = getSupabaseClient(token);

      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (!authError && user) {
        userId = user.id;
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

    // Ensure only one entry per email
    const { data: existingSubmission } = await verificationClient
      .from('form_submissions')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    let submissionData: any = null;
    let submissionError: any = null;

    if (existingSubmission?.id) {
      // Update existing submission for this email
      const updateResult = await supabase
        .from('form_submissions')
        .update(insertPayload)
        .eq('id', existingSubmission.id)
        .select()
        .single();

      submissionData = updateResult.data;
      submissionError = updateResult.error;
    } else {
      // Insert form submission
      const insertResult = await supabase
        .from('form_submissions')
        .insert(insertPayload)
        .select()
        .single();

      submissionData = insertResult.data;
      submissionError = insertResult.error;
    }

    if (submissionError) {
      console.error('Error saving form submission to database:', submissionError);
      const isDuplicateEmail =
        submissionError.code === '23505' ||
        /duplicate key/i.test(submissionError.message || '') ||
        /form_submissions_email_key/i.test(submissionError.message || '');

      if (isDuplicateEmail) {
        return NextResponse.json(
          { error: 'This email is already on the waitlist. Try a different email or log in.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to save form submission', details: submissionError.message },
        { status: 500 }
      );
    }

    // If we have goal details in the new flow, save them to goal_details table
    if (!hasLegacyShape && body.goalDetails && submissionData?.id) {
      const goalDetails = body.goalDetails as Record<
        string,
        { selections?: string[]; other?: string; main?: string; extra?: string }
      >;
      const goalsArray = Array.isArray(body.goals) ? body.goals : [];
      type GoalDetailsInsert = {
        form_submission_id: string;
        user_id: string | null;
        goal_id: string;
        main_context: string;
        extra_context: string | null;
      };

      const goalDetailsInserts = goalsArray
        .map((goalId: string): GoalDetailsInsert | null => {
          const detail = goalDetails[goalId];
          if (!detail) return null;
          const selections = Array.isArray(detail.selections)
            ? detail.selections
            : detail.main
              ? [detail.main]
              : [];
          const otherText = typeof detail.other === 'string'
            ? detail.other
            : detail.extra || '';
          const mainContext = selections.length > 0
            ? selections.join(', ')
            : otherText
              ? 'Other'
              : '';

          if (!mainContext && !otherText) {
            return null;
          }

          return {
            form_submission_id: submissionData.id,
            user_id: userId || null,
            goal_id: goalId,
            main_context: mainContext,
            extra_context: otherText || null,
          };
        })
        .filter(
          (item: GoalDetailsInsert | null): item is GoalDetailsInsert =>
            Boolean(item),
        );

      if (goalDetailsInserts.length > 0) {
        const token = authHeader?.replace('Bearer ', '');
        const canInsertGoalDetails = Boolean(serviceRoleKey || (userId && token));

        if (!canInsertGoalDetails) {
          console.warn('Skipping goal_details insert without service role or auth');
        } else {
          // Use authenticated client if available, otherwise use service role
          const clientForGoalDetails = userId && token
            ? getSupabaseClient(token)
            : adminClient;

          const { error: goalDetailsError } = await clientForGoalDetails
            .from('goal_details')
            .insert(goalDetailsInserts);

          if (goalDetailsError) {
            console.error('Error saving goal details:', goalDetailsError);
            // Don't fail the whole submission if goal details fail
          }
        }
      }
    }

    // Send admin notification email
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
      const adminEmail = process.env.SUBMISSION_NOTIFY_EMAIL || 'mazin.biviji1@gmail.com';
      const submissionSummary = {
        submissionId: submissionData?.id || null,
        email: normalizedEmail,
        name: body.name || null,
        contactMethod: body.contactMethod || null,
        phone: body.phone || null,
        netWorth: body.netWorth || null,
        primaryGoal: body.primaryGoal || null,
        goals: body.goals || null,
        goalDetails: body.goalDetails || null,
        estateStatus: body.estateStatus || null,
        timeHorizon: body.timeHorizon || null,
        concernLevel: body.concernLevel || null,
        additionalInfo: body.additionalInfo || null,
        userId: userId || null,
      };

      const prettyJson = JSON.stringify(submissionSummary, null, 2);
      let draftEmail: string | null = null;

      try {
        draftEmail = await buildDraftResponseEmail({
          ...body,
          email: normalizedEmail
        });
      } catch (error) {
        console.error('Failed to build draft response email:', error);
      }

      const emailPayload = {
        from: fromAddress,
        to: adminEmail,
        subject: `New form submission: ${normalizedEmail || 'unknown email'}`,
        html: [
          `<p><strong>New form submission received.</strong></p>`,
          `<p><strong>Contact email:</strong> ${normalizedEmail || 'Not provided'}</p>`,
          draftEmail
            ? `<p><strong>Draft response to user:</strong></p><pre style="background:#f6f8fa;border:1px solid #e1e4e8;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(draftEmail)}</pre>`
            : '',
          `<p><strong>Full form info:</strong></p>`,
          `<pre style="background:#f6f8fa;border:1px solid #e1e4e8;padding:12px;border-radius:6px;white-space:pre-wrap;">${prettyJson}</pre>`,
        ].join(''),
      };

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error('Resend email failed:', resendResponse.status, errorText);
      }
    } else {
      console.warn('RESEND_API_KEY not set; skipping submission email');
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


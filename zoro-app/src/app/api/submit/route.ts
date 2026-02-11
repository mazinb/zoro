import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const anonClient = supabase;

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
    const normalizedName = body.name && String(body.name).trim()
      ? String(body.name)
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : null;

    if (!normalizedEmail) {
      return NextResponse.json(
        { error: 'Email is required to join the waitlist' },
        { status: 400 }
      );
    }

    const verificationClient = anonClient;

    if (!userId && normalizedEmail) {
      const { data: existingUser, error: existingUserError } = await verificationClient
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (!existingUserError && existingUser?.id) {
        userId = existingUser.id;
      } else if (!existingUserError) {
        const nextCheckinDue = new Date();
        nextCheckinDue.setDate(nextCheckinDue.getDate() + 15);

        const { data: newUser, error: newUserError } = await verificationClient
          .from('users')
          .insert({
            email: normalizedEmail,
            checkin_frequency: 'monthly',
            next_checkin_due: nextCheckinDue.toISOString(),
          })
          .select('id')
          .single();

        if (newUserError) {
          console.error('Error creating user from form submission:', newUserError);
        } else if (newUser?.id) {
          userId = newUser.id;
        }
      } else {
        console.error('Error checking existing user:', existingUserError);
      }
    }

    if (hasLegacyShape) {
      // Original question-based flow
      insertPayload = {
        user_id: userId || null,
        name: normalizedName,
        // primary_goal removed from schema
        net_worth: body.netWorth,
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
        name: normalizedName,
        // primary_goal removed from schema
        net_worth: body.netWorth || '',
        contact_method: body.contactMethod,
        phone: body.phone && String(body.phone).trim() ? String(body.phone) : null,
        additional_info: JSON.stringify(enrichedAdditionalInfo),
        email: normalizedEmail
      };
    }

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

    let waitlistPosition: number | null = null;

    const { count: totalCount, error: totalError } = await verificationClient
      .from('form_submissions')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('Failed to calculate waitlist position:', totalError);
    } else {
      waitlistPosition = totalCount || 0;
    }

    // Send admin notification email
    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey) {
      const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
      const senderName = normalizedName || 'zoro';
      const senderLocalPart = normalizedName || 'user';
      const userFromAddress = `${senderName} <${senderLocalPart}@getzoro.com>`;
      const adminEmail = process.env.SUBMISSION_NOTIFY_EMAIL || 'mazin.biviji1@gmail.com';
      const submissionSummary = {
        submissionId: submissionData?.id || null,
        email: normalizedEmail,
        name: normalizedName,
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
      let draftEmail: { text: string; html: string } | null = null;

      try {
        // Get or generate user token from users table by email
        // Uses users.verification_token as the primary identifier
        let userToken = null;
        if (normalizedEmail) {
          // Find user in users table
          const { data: user } = await anonClient
            .from('users')
            .select('id, email, verification_token')
            .eq('email', normalizedEmail)
            .maybeSingle();
          
          if (user?.verification_token) {
            userToken = user.verification_token;
          } else if (user?.id) {
            // User exists but has no verification_token, generate one
            userToken = randomBytes(16).toString('hex');
            await anonClient
              .from('users')
              .update({ verification_token: userToken })
              .eq('id', user.id);
          }
        }
        
        // Generate a token and create user in users table if user doesn't exist yet
        // This ensures links work and the token is saved to the database
        if (!userToken) {
          userToken = randomBytes(16).toString('hex');
          const nextCheckinDue = new Date();
          nextCheckinDue.setDate(nextCheckinDue.getDate() + 15);
          
          // Create user in users table with the token
          const { data: newUser, error: createError } = await anonClient
            .from('users')
            .insert({
              email: normalizedEmail,
              verification_token: userToken,
              checkin_frequency: 'monthly',
              next_checkin_due: nextCheckinDue.toISOString(),
            })
            .select('id')
            .maybeSingle();
          
          // If insert failed (e.g., duplicate email), try to find again
          if (createError && normalizedEmail) {
            const { data: existingUser } = await anonClient
              .from('users')
              .select('id, verification_token')
              .eq('email', normalizedEmail)
              .maybeSingle();
            
            if (existingUser?.verification_token) {
              userToken = existingUser.verification_token;
            } else if (existingUser?.id) {
              // Update with token
              await anonClient
                .from('users')
                .update({ verification_token: userToken })
                .eq('id', existingUser.id);
            }
          }
        }
        
        draftEmail = await buildDraftResponseEmail({
          ...body,
          email: normalizedEmail,
          waitlistPosition,
          userToken: userToken
        });
      } catch (error) {
        console.error('Failed to build draft response email:', error);
      }
      if (!draftEmail) {
        const pos = typeof waitlistPosition === 'number' ? waitlistPosition : 0;
        const fallbackText = `Hi ${body.name || 'there'}\n\nThanks for sharing your goals!\n\nYou're #${pos} on our waitlist. We are still building Zoro.\n\nWhile we do, I'd be happy to schedule a 15 min call to get you set up and schedule customized follow ups to make sure you stay on track.\n\nOr simply reply to this email to interact with our agent.\n\nThanks,\nZoro\n\nhttps://calendly.com/mazinb/15min`;
        draftEmail = {
          text: fallbackText,
          html: fallbackText.split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>\n'),
        };
      }

      // Extract reply-to email from userFromAddress (the @getzoro.com sender)
      // This should be the same as the sender email (e.g., mazinb@getzoro.com)
      const replyToEmailMatch = userFromAddress.match(/<(.+)>/);
      const replyToEmail = replyToEmailMatch ? replyToEmailMatch[1] : (userFromAddress.includes('@') ? userFromAddress : 'admin@getzoro.com');

      const emailPayload = {
        from: fromAddress,
        to: adminEmail,
        subject: `New form submission: ${normalizedEmail || 'unknown email'}`,
        html: [
          `<p><strong>New form submission received.</strong></p>`,
          `<p><strong>Contact email:</strong> ${normalizedEmail || 'Not provided'}</p>`,
          draftEmail
            ? `<p><strong>Draft response to user:</strong></p><pre style="background:#f6f8fa;border:1px solid #e1e4e8;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(draftEmail.text)}</pre>`
            : '',
          `<p><strong>Full form info:</strong></p>`,
          `<pre style="background:#f6f8fa;border:1px solid #e1e4e8;padding:12px;border-radius:6px;white-space:pre-wrap;">${prettyJson}</pre>`,
        ].join(''),
      };

      const userEmailPayload = {
        from: userFromAddress,
        to: normalizedEmail,
        reply_to: replyToEmail,
        subject: 'Welcome to Zoro',
        text: draftEmail.text,
        html: draftEmail.html,
      };

      const sendResendEmail = async (payload: Record<string, unknown>, label: string) => {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error(`Resend ${label} email failed:`, resendResponse.status, errorText);
        }
      };

      await Promise.all([
        sendResendEmail(emailPayload, 'admin'),
        sendResendEmail(userEmailPayload, 'user')
      ]);
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


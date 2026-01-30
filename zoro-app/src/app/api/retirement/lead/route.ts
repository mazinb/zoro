import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const answers = body?.answers ?? null;
    const expenseBuckets = body?.expenseBuckets ?? null;
    const additionalInfo = body?.additionalInfo ? String(body.additionalInfo) : null;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user_data already exists for this email
    const { data: existingUserData } = await supabase
      .from('user_data')
      .select('id, retirement_answers, retirement_expense_buckets')
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    // Update or insert retirement data in user_data table
    if (existingUserData?.id) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('user_data')
        .update({
          retirement_answers: answers,
          retirement_expense_buckets: expenseBuckets,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUserData.id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update retirement data', details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Create new record - need to generate user_token
      const userToken = randomBytes(16).toString('hex');

      const { error: insertError } = await supabase
        .from('user_data')
        .insert({
          user_token: userToken,
          email,
          retirement_answers: answers,
          retirement_expense_buckets: expenseBuckets,
        });

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to save retirement request', details: insertError.message },
          { status: 500 }
        );
      }
    }

    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
    const adminEmail = process.env.SUBMISSION_NOTIFY_EMAIL || 'mazin.biviji1@gmail.com';

    const payload = {
      email,
      answers,
      expenseBuckets,
      additionalInfo,
      submittedAt: new Date().toISOString(),
    };

    const prettyJson = JSON.stringify(payload, null, 2);
    const emailPayload = {
      from: fromAddress,
      to: adminEmail,
      subject: `New retirement calculator submission: ${email}`,
      html: [
        `<p><strong>New retirement calculator submission received.</strong></p>`,
        `<p><strong>Contact email:</strong> ${email}</p>`,
        `<p><strong>Submission data:</strong></p>`,
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
      return NextResponse.json(
        { error: `Failed to send email: ${errorText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to submit retirement lead', details: error?.message },
      { status: 500 }
    );
  }
}


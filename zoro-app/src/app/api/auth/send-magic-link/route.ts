import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Reusable magic-link sender for gated forms (expenses, etc.).
 * POST { email, redirectPath } — redirectPath is the path to open with ?token= (e.g. "/expenses").
 * If email is not registered (no row in users), returns { registered: false }.
 * If registered, sends email with action link and returns { success: true }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const redirectPath = String(body?.redirectPath ?? '/').trim() || '/';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Service not configured.' }, { status: 500 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: 'Email service not configured.' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, verification_token')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error('[send-magic-link] Find user error:', findError.message);
      return NextResponse.json({ error: 'Could not check registration.' }, { status: 500 });
    }

    if (!user?.id) {
      return NextResponse.json({ registered: false }, { status: 200 });
    }

    const token = user.verification_token;
    if (!token) {
      return NextResponse.json({ error: 'Account has no link token.' }, { status: 500 });
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? 'https://www.getzoro.com' : null) ||
      request.headers.get('origin') ||
      request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
      'https://www.getzoro.com';
    const actionUrl = `${origin.replace(/\/$/, '')}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}?token=${encodeURIComponent(token)}`;

    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
    const subject = 'Your link to open the form – Zoro';
    const html = [
      `<p>Hi,</p>`,
      `<p>Use the button below to open the form. This link is tied to your account.</p>`,
      `<p style="margin:24px 0"><a href="${actionUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open form</a></p>`,
      `<p style="color:#64748b;font-size:14px">If the button doesn’t work, copy and paste this link into your browser:</p>`,
      `<p style="word-break:break-all;font-size:14px">${actionUrl}</p>`,
    ].join('');

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('[send-magic-link] Resend error:', resendResponse.status, errText);
      return NextResponse.json({ error: 'Failed to send email.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, registered: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Send magic link failed';
    console.error('[send-magic-link]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

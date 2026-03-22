import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildNagAppUrl, nagMagicLinkOrigin, sendNagMagicLinkEmail } from '@/lib/nag-magic-link-mail';

/**
 * Reusable magic-link sender for gated forms (expenses, /nag, etc.).
 * POST { email, redirectPath } — redirectPath is the path to open with ?token= (e.g. "/expenses").
 * Optional: context "nag" — adjusts email copy for Nags.
 * Optional: inviteIfUnregistered true — if email is not in users, send a signup email (getzoro.com) instead of returning only { registered: false }.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const redirectPath = String(body?.redirectPath ?? '/').trim() || '/';
    const context = String(body?.context ?? '').trim().toLowerCase();
    const inviteIfUnregistered = Boolean(body?.inviteIfUnregistered);

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
      if (!inviteIfUnregistered) {
        return NextResponse.json({ registered: false }, { status: 200 });
      }

      const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
      const subject =
        context === 'nag'
          ? 'Create your Zoro account to use Nags'
          : 'Create your Zoro account';
      const html = [
        `<p>Hi,</p>`,
        context === 'nag'
          ? `<p>We don’t have a Zoro account for this email yet. Sign up to use <strong>Nags</strong> and the rest of Zoro.</p>`
          : `<p>We don’t have a Zoro account for this email yet. Sign up to get started.</p>`,
        `<p style="margin:24px 0"><a href="https://www.getzoro.com" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Sign up at Zoro</a></p>`,
        `<p style="color:#64748b;font-size:14px">Or open: <a href="https://www.getzoro.com">https://www.getzoro.com</a></p>`,
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
        console.error('[send-magic-link] Resend (invite) error:', resendResponse.status, errText);
        return NextResponse.json({ error: 'Failed to send email.' }, { status: 502 });
      }

      return NextResponse.json({ registered: false, invited: true }, { status: 200 });
    }

    const token = user.verification_token;
    if (!token) {
      return NextResponse.json({ error: 'Account has no link token.' }, { status: 500 });
    }

    const origin = nagMagicLinkOrigin(request);
    const actionUrl =
      context === 'nag' && redirectPath.replace(/^\//, '') === 'nag'
        ? buildNagAppUrl(origin, token)
        : `${origin}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}?token=${encodeURIComponent(token)}`;

    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

    if (context === 'nag' && redirectPath.replace(/^\//, '') === 'nag') {
      const nagSent = await sendNagMagicLinkEmail(email, actionUrl, resendApiKey, fromAddress);
      if (!nagSent.ok) {
        console.error('[send-magic-link] Resend error:', nagSent.status, nagSent.text);
        return NextResponse.json({ error: 'Failed to send email.' }, { status: 502 });
      }
      return NextResponse.json({ success: true, registered: true });
    }

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

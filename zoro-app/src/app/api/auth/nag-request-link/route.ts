import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  buildNagAppUrl,
  nagMagicLinkOrigin,
  sendNagMagicLinkEmail,
} from '@/lib/nag-magic-link-mail';
import { DEFAULT_NAG_TIMEZONE, isValidIanaTimezone } from '@/lib/nag-timezone';

function generateVerificationToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * POST { email, name? }
 * Existing user → email magic link to /nag?token=…
 * New user → create users row (+ optional user_data name), then same email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const nameRaw = body?.name != null ? String(body.name).trim() : '';
    const tzRaw = typeof body.timezone === 'string' ? body.timezone.trim() : '';
    if (tzRaw && !isValidIanaTimezone(tzRaw)) {
      return NextResponse.json({ error: 'Invalid IANA timezone' }, { status: 400 });
    }
    const timezoneToSet = tzRaw ? tzRaw : null;

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

    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existing, error: findError } = await supabase
      .from('users')
      .select('id, verification_token')
      .eq('email', email)
      .maybeSingle();

    if (findError) {
      console.error('[nag-request-link] find:', findError.message);
      return NextResponse.json({ error: 'Could not look up email.' }, { status: 500 });
    }

    let userId = existing?.id ?? '';
    let token = existing?.verification_token?.trim() ?? '';
    let created = false;

    if (userId) {
      if (!token) {
        token = generateVerificationToken();
        const { error: upErr } = await supabase
          .from('users')
          .update({
            verification_token: token,
            ...(timezoneToSet ? { timezone: timezoneToSet, updated_at: new Date().toISOString() } : {}),
          })
          .eq('id', userId);
        if (upErr) {
          console.error('[nag-request-link] token update:', upErr.message);
          return NextResponse.json({ error: 'Could not issue link.' }, { status: 500 });
        }
      } else if (timezoneToSet) {
        const { error: upErr } = await supabase
          .from('users')
          .update({ timezone: timezoneToSet, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (upErr) {
          console.error('[nag-request-link] timezone update:', upErr.message);
          return NextResponse.json({ error: 'Could not update timezone.' }, { status: 500 });
        }
      }
    } else {
      if (!nameRaw) {
        return NextResponse.json(
          { error: 'Please enter your name so we can set up your account.' },
          { status: 400 }
        );
      }

      token = generateVerificationToken();
      const nextCheckinDue = new Date();
      nextCheckinDue.setDate(nextCheckinDue.getDate() + 15);

      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          email,
          verification_token: token,
          timezone: timezoneToSet ?? DEFAULT_NAG_TIMEZONE,
          checkin_frequency: 'monthly',
          next_checkin_due: nextCheckinDue.toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        const { data: raced } = await supabase
          .from('users')
          .select('id, verification_token')
          .eq('email', email)
          .maybeSingle();
        if (raced?.id) {
          userId = raced.id;
          token = raced.verification_token?.trim() || generateVerificationToken();
          if (!raced.verification_token) {
            await supabase.from('users').update({ verification_token: token }).eq('id', userId);
          }
          created = false;
        } else {
          console.error('[nag-request-link] insert:', insertError.message);
          return NextResponse.json({ error: 'Could not create account.' }, { status: 500 });
        }
      } else if (inserted?.id) {
        userId = inserted.id;
        created = true;
        const { error: udError } = await supabase.from('user_data').upsert(
          {
            user_id: userId,
            user_token: token,
            email,
            name: nameRaw,
            shared_data: {},
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_token' }
        );
        if (udError) {
          console.error('[nag-request-link] user_data:', udError.message);
        }
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'Could not issue link.' }, { status: 500 });
    }

    const origin = nagMagicLinkOrigin(request);
    const actionUrl = buildNagAppUrl(origin, token);
    const sent = await sendNagMagicLinkEmail(email, actionUrl, resendApiKey, fromAddress);

    if (!sent.ok) {
      console.error('[nag-request-link] Resend:', sent.status, sent.text);
      return NextResponse.json({ error: 'Failed to send email.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    console.error('[nag-request-link]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

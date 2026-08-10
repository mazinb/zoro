import { NextRequest, NextResponse } from 'next/server';
import { sendEmailViaResend } from '@/lib/email-send';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { z } from 'zod';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

const ReplySchema = z.object({
  inbound_id: z.string().uuid('Invalid inbound_id'),
  body: z.string().min(1, 'Body is required'),
  html: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const userIdResult = await resolveTokenToUserId(token);
    if ('error' in userIdResult) {
      return NextResponse.json({ error: userIdResult.error }, { status: userIdResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { inbound_id: inboundId, body: replyBody, html } = parsed.data;

    // Look up the inbound email to find the sender and threading info
    const supabase = getSupabaseServiceRole();
    const { data: inbound, error: fetchError } = await supabase
      .from('inbound_emails')
      .select('from_address, subject, id')
      .eq('id', inboundId)
      .eq('user_id', userIdResult.userId)
      .single();

    if (fetchError || !inbound) {
      return NextResponse.json(
        { error: 'Inbound email not found or access denied' },
        { status: 404 }
      );
    }

    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

    const subject = inbound.subject?.startsWith('Re: ') ? inbound.subject : `Re: ${inbound.subject || ''}`;

    const result = await sendEmailViaResend({
      userId: userIdResult.userId,
      from: fromAddress,
      to: inbound.from_address,
      subject,
      ...(html ? { html: replyBody } : { text: replyBody }),
      inReplyTo: inboundId, // use inbound UUID for threading
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

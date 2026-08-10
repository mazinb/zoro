import { NextRequest, NextResponse } from 'next/server';
import { sendEmailViaResend } from '@/lib/email-send';
import { resolveTokenToUserId } from '@/lib/resolve-token';
import { z } from 'zod';

const SendSchema = z.object({
  to: z.string().email('Invalid recipient email'),
  subject: z.string().min(1, 'Subject is required').max(200),
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
    const parsed = SendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { to, subject, body: emailBody, html } = parsed.data;
    const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

    const result = await sendEmailViaResend({
      userId: userIdResult.userId,
      from: fromAddress,
      to,
      subject,
      ...(html ? { html: emailBody } : { text: emailBody }),
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

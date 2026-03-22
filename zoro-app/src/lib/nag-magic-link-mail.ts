import type { NextRequest } from 'next/server';

const RESEND_URL = 'https://api.resend.com/emails';

export function nagMagicLinkOrigin(request: NextRequest): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? 'https://www.getzoro.com' : null) ||
    request.headers.get('origin') ||
    request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
    'https://www.getzoro.com';
  return raw.replace(/\/$/, '');
}

export function buildNagAppUrl(origin: string, token: string): string {
  return `${origin}/nag?token=${encodeURIComponent(token)}`;
}

export async function sendNagMagicLinkEmail(
  email: string,
  actionUrl: string,
  resendApiKey: string,
  fromAddress: string
): Promise<{ ok: true } | { ok: false; status: number; text: string }> {
  const subject = 'Your link to Nags – Zoro';
  const html = [
    `<p>Hi,</p>`,
    `<p>Use the button below to open <strong>Nags</strong>. This link is tied to your account.</p>`,
    `<p style="margin:24px 0"><a href="${actionUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open Nags</a></p>`,
    `<p style="color:#64748b;font-size:14px">If the button doesn’t work, copy and paste this link into your browser:</p>`,
    `<p style="word-break:break-all;font-size:14px">${actionUrl}</p>`,
  ].join('');

  const resendResponse = await fetch(RESEND_URL, {
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
    const text = await resendResponse.text();
    return { ok: false, status: resendResponse.status, text };
  }
  return { ok: true };
}

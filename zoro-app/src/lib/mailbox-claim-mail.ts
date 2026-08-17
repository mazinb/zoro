const RESEND_URL = 'https://api.resend.com/emails';

export function mailboxClaimOrigin(requestOrigin?: string | null): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? 'https://www.getzoro.com' : null) ||
    requestOrigin ||
    'https://www.getzoro.com';
  return raw.replace(/\/$/, '');
}

export function mailboxClaimHttpsUrl(origin: string, nonce: string): string {
  return `${origin}/mailbox/claim?nonce=${encodeURIComponent(nonce)}`;
}

export function mailboxClaimAppUrl(nonce: string): string {
  return `zoro://mailbox/claim?nonce=${encodeURIComponent(nonce)}`;
}

export async function sendMailboxClaimEmail(opts: {
  email: string;
  actionUrl: string;
  resendApiKey: string;
  fromAddress: string;
}): Promise<{ ok: true } | { ok: false; status: number; text: string }> {
  const html = [
    `<p>Hi,</p>`,
    `<p>Confirm this email to claim a <strong>private Hermes mailbox</strong> in Zoro. Forward PDFs here from this address only. The link expires in 30 minutes.</p>`,
    `<p style="margin:24px 0"><a href="${opts.actionUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Open Zoro and confirm</a></p>`,
    `<p style="color:#64748b;font-size:14px">If the button doesn’t work, copy this link:</p>`,
    `<p style="word-break:break-all;font-size:14px">${opts.actionUrl}</p>`,
  ].join('');

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.fromAddress,
      to: opts.email,
      subject: 'Claim your Zoro mailbox',
      html,
    }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  return { ok: true };
}

const RESEND_URL = 'https://api.resend.com/emails';

export type NagEmailResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendNagEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<NagEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  const body: Record<string, string> = {
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };
  if (params.text) body.text = params.text;

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[nag-email] Resend error:', res.status, errText);
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send failed';
    return { ok: false, error: msg };
  }
}

export function nagReminderHtml(message: string): string {
  return [
    `<p style="font-size:16px;margin:0 0 12px">Reminder from Zoro</p>`,
    `<p style="font-size:18px;font-weight:600;margin:0 0 16px">${escapeHtml(message)}</p>`,
    `<p style="color:#64748b;font-size:14px;margin:0">You asked us to nag you until it’s done. Reply to this thread or open your Zoro link to manage nags.</p>`,
  ].join('');
}

export function nagConfirmationHtml(message: string, nextLabel: string): string {
  return [
    `<p style="font-size:16px;margin:0 0 12px">Nag scheduled</p>`,
    `<p style="font-size:18px;font-weight:600;margin:0 0 8px">${escapeHtml(message)}</p>`,
    `<p style="color:#64748b;font-size:14px;margin:0">Next reminder: <strong>${escapeHtml(nextLabel)}</strong> (UTC)</p>`,
  ].join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

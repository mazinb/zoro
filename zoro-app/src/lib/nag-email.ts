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

export function nagReminderHtml(message: string, nagUntilDone?: boolean): string {
  const footer = nagUntilDone
    ? `<p style="color:#64748b;font-size:14px;margin:0">We’ll keep sending follow-ups until you open your Nags page and mark this task done.</p>`
    : `<p style="color:#64748b;font-size:14px;margin:0">You asked us to nag you until it’s done. Reply to this thread or open your Zoro link to manage nags.</p>`;
  return [
    `<p style="font-size:16px;margin:0 0 12px">Reminder from Zoro</p>`,
    `<p style="font-size:18px;font-weight:600;margin:0 0 16px">${escapeHtml(message)}</p>`,
    footer,
  ].join('');
}

export function nagReminderText(message: string, nagUntilDone?: boolean): string {
  const footer = nagUntilDone
    ? 'Follow-ups continue until you mark this task done on your Nags page (use the link from your email).'
    : 'Manage nags from your Zoro link.';
  return `Reminder from Zoro\n\n${message}\n\n${footer}`;
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

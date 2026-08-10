import { getSupabaseServiceRole } from './supabase-server';

export type SendEmailParams = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string; // inbound UUID for threading
  userId: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends an email via Resend and logs it to user_context.memory_jsonb
 * (same store used for nag outbound tracking).
 */
export async function sendEmailViaResend(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM || 'Zoro <admin@getzoro.com>';

  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  let resendId: string | undefined;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(params.inReplyTo ? { 'In-Reply-To': params.inReplyTo } : {}),
      },
      body: JSON.stringify({
        from: params.from || fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.inReplyTo ? { in_reply_to: params.inReplyTo } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    const json = await res.json() as { id?: string };
    resendId = json.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'send failed';
    return { ok: false, error: msg };
  }

  // Log to user_context.memory_jsonb (same pattern as nag-memory-log.ts)
  try {
    const supabase = getSupabaseServiceRole();
    const timestamp = new Date().toISOString();

    const { data: row } = await supabase
      .from('user_context')
      .select('memory_jsonb')
      .eq('user_id', params.userId)
      .maybeSingle();

    let mem: unknown[];

    if (row && Array.isArray(row.memory_jsonb)) {
      mem = [...(row.memory_jsonb as unknown[])];
    } else {
      // Create a new user_context row if it doesn't exist
      const { error: createErr } = await supabase
        .from('user_context')
        .insert({
          user_id: params.userId,
          memory_jsonb: [],
          updated_at: timestamp,
        });

      if (createErr) {
        console.error('[email-send] create user_context failed:', createErr.message);
      }
      mem = [];
    }

    const entry = {
      type: 'outbound',
      timestamp,
      subject: params.subject,
      bodyPreview: (params.text ?? params.html ?? '').slice(0, 200),
      resend_id: resendId,
      in_reply_to: params.inReplyTo ?? null,
    } as Record<string, unknown>;
    mem.push(entry);

    // Keep last 50 entries to avoid unbounded growth
    const trimmed = mem.slice(-50);

    await supabase
      .from('user_context')
      .update({ memory_jsonb: trimmed, updated_at: timestamp })
      .eq('user_id', params.userId);
  } catch (dbErr) {
    console.error('[email-send] memory_jsonb log failed:', dbErr);
    // Don't fail the send — email went out, just logging failed
  }

  return { ok: true, id: resendId ?? '' };
}

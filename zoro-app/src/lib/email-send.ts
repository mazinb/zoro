import { getSupabaseClient } from './supabase-server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bnqrzxscdrivvsbqtggq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function getSupabaseRestHeaders() {
  return {
    'apikey': SUPABASE_SERVICE_KEY || '',
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || ''}`,
    'Content-Type': 'application/json',
  };
}

export type SendEmailParams = {
  from?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string; // inbound UUID for threading
  userId: string;
  userToken?: string; // user's auth token for RLS
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

  // Log to user_context.memory_jsonb using direct REST API
  // (avoids Supabase client which fails when service key env var is missing)
  try {
    const timestamp = new Date().toISOString();
    const headers = getSupabaseRestHeaders();
    const baseUrl = `${SUPABASE_URL}/rest/v1`;

    // Try to fetch existing row
    const fetchUrl = `${baseUrl}/user_context?select=memory_jsonb&user_id=eq.${encodeURIComponent(params.userId)}`;
    const fetchRes = await fetch(fetchUrl, { headers });
    let mem: unknown[] = [];

    if (fetchRes.ok) {
      const rows = await fetchRes.json() as Array<{ memory_jsonb: unknown[] }>;
      if (rows.length > 0 && Array.isArray(rows[0].memory_jsonb)) {
        mem = [...rows[0].memory_jsonb];
        console.log('[email-send] found existing user_context, appending');
      } else {
        console.log('[email-send] empty memory_jsonb in existing user_context, will populate');
      }
    } else {
      console.log('[email-send] fetch user_context returned', fetchRes.status, '- will create new row');
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

    // Upsert: insert if new, update if exists
    const url = `${baseUrl}/user_context?select=*&on_conflict=user_id`;
    const upsertRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: params.userId,
        memory_jsonb: trimmed,
        updated_at: timestamp,
      }),
    });

    if (upsertRes.ok) {
      console.log('[email-send] successfully logged email to memory_jsonb');
    } else {
      const errText = await upsertRes.text();
      console.error('[email-send] upsert user_context failed:', upsertRes.status, errText);
    }
  } catch (dbErr) {
    const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.error('[email-send] memory_jsonb log fatal error:', errMsg);
  }

  return { ok: true, id: resendId ?? '' };
}
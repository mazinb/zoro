const WEBHOOK_TIMEOUT_MS = 12_000;

export type WebhookPostResult = {
  ok: boolean;
  status: number;
  json: unknown;
  text: string;
};

/**
 * POST JSON to a user webhook with shared secret header.
 */
export async function postUserWebhook(
  url: string,
  secret: string,
  body: Record<string, unknown>
): Promise<WebhookPostResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zoro-Webhook-Secret': secret,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export function verificationChallengeAccepted(
  verifyToken: string,
  json: unknown
): boolean {
  if (!json || typeof json !== 'object') return false;
  const c = (json as Record<string, unknown>).challenge;
  return typeof c === 'string' && c === verifyToken;
}

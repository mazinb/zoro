import { setLinkedInToken } from './linkedin-token';

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

export type CallbackResult =
  | { ok: true }
  | { ok: false; status: number; error: string; details?: string };

export async function handleLinkedInCallback(code: string, redirectUri: string): Promise<CallbackResult> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, status: 500, error: 'LinkedIn env not configured' };
  }

  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return { ok: false, status: 502, error: 'Token exchange failed', details: err.slice(0, 300) };
  }
  const data = (await tokenRes.json()) as { access_token: string; expires_in?: number };
  await setLinkedInToken(data.access_token, data.expires_in);
  return { ok: true };
}

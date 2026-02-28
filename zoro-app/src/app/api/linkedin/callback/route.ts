import { NextRequest, NextResponse } from 'next/server';
import { setLinkedInToken } from '@/lib/linkedin-token';

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

/**
 * GET /api/linkedin/callback
 * LinkedIn redirects here with ?code=...&state=...
 * Exchanges code for access token and saves it for POST /api/linkedin/post.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  if (error) {
    return NextResponse.json({ error: 'LinkedIn auth failed', linkedin_error: error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'LinkedIn env not configured' }, { status: 500 });
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
    return NextResponse.json({ error: 'Token exchange failed', details: err.slice(0, 300) }, { status: 502 });
  }
  const data = (await tokenRes.json()) as { access_token: string; expires_in?: number };
  await setLinkedInToken(data.access_token, data.expires_in);
  return NextResponse.json({ success: true, message: 'LinkedIn token saved. You can now POST to /api/linkedin/post with { "text": "..." }.' });
}

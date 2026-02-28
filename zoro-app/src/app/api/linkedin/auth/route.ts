import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const SCOPES = ['openid', 'profile', 'w_member_social'].join(' ');

/**
 * GET /api/linkedin/auth
 * Redirects to LinkedIn OAuth. After auth, LinkedIn redirects to callback.
 * Uses request origin + /auth/linkedin/callback so it matches the callback URL.
 *
 * Add this redirect URL in LinkedIn Developer Portal → Auth:
 * https://www.getzoro.com/auth/linkedin/callback
 *
 * Required Products: "Sign In with LinkedIn using OpenID Connect", "Share on LinkedIn"
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID required' }, { status: 500 });
  }
  const origin = request.nextUrl?.origin || `https://${request.headers.get('host') || 'www.getzoro.com'}`;
  const redirectUri = `${origin.replace(/\/$/, '')}/auth/linkedin/callback`;
  const state = randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });
  return NextResponse.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`);
}

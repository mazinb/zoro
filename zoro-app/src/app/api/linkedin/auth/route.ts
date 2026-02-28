import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const SCOPES = ['openid', 'profile', 'w_member_social'].join(' ');

/**
 * GET /api/linkedin/auth
 * Redirects to LinkedIn OAuth. After auth, LinkedIn redirects to callback.
 *
 * Required in LinkedIn Developer Portal → Your app → Products:
 * - "Sign In with LinkedIn using OpenID Connect" (for openid, profile)
 * - "Share on LinkedIn" (for w_member_social)
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI required' }, { status: 500 });
  }
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

import { NextRequest, NextResponse } from 'next/server';
import { handleLinkedInCallback } from '@/lib/linkedin-callback';

/**
 * GET /auth/linkedin/callback
 * LinkedIn redirects here. Exchanges code, saves token, redirects to success page.
 * Set LINKEDIN_REDIRECT_URI=https://www.getzoro.com/auth/linkedin/callback in .env
 * and add that exact URL in LinkedIn Developer Portal (no typos like auth¯).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const successUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.getzoro.com'}/auth/linkedin/success`;
  const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.getzoro.com'}/auth/linkedin/success?error=1`;

  if (error) {
    return NextResponse.redirect(`${errorUrl}&linkedin_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${errorUrl}&msg=${encodeURIComponent('Missing code')}`);
  }
  if (!redirectUri) {
    return NextResponse.redirect(`${errorUrl}&msg=${encodeURIComponent('LINKEDIN_REDIRECT_URI not set')}`);
  }

  const result = await handleLinkedInCallback(code, redirectUri);
  if (result.ok) {
    return NextResponse.redirect(successUrl);
  }
  return NextResponse.redirect(
    `${errorUrl}&msg=${encodeURIComponent(result.error)}${result.details ? `&details=${encodeURIComponent(result.details)}` : ''}`
  );
}

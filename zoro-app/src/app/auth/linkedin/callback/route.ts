import { NextRequest, NextResponse } from 'next/server';
import { handleLinkedInCallback } from '@/lib/linkedin-callback';

/**
 * GET /auth/linkedin/callback
 * LinkedIn redirects here. Exchanges code, saves token, redirects to success page.
 * Uses the request URL (without query) as redirect_uri so it always matches LinkedIn.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const redirectUri = `${url.origin}${url.pathname}`;
  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin || 'https://www.getzoro.com';
  const successUrl = `${base.replace(/\/$/, '')}/auth/linkedin/success`;
  const errorUrl = `${base.replace(/\/$/, '')}/auth/linkedin/success?error=1`;

  if (error) {
    return NextResponse.redirect(`${errorUrl}&linkedin_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${errorUrl}&msg=${encodeURIComponent('Missing code')}`);
  }

  const result = await handleLinkedInCallback(code, redirectUri);
  if (result.ok) {
    return NextResponse.redirect(successUrl);
  }
  return NextResponse.redirect(
    `${errorUrl}&msg=${encodeURIComponent(result.error)}${result.details ? `&details=${encodeURIComponent(result.details)}` : ''}`
  );
}

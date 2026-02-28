import { NextRequest, NextResponse } from 'next/server';
import { handleLinkedInCallback } from '@/lib/linkedin-callback';

/**
 * GET /api/linkedin/callback
 * Alternative callback. Derives redirect_uri from request URL to match LinkedIn.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const redirectUri = `${url.origin}${url.pathname}`;

  if (error) {
    return NextResponse.json({ error: 'LinkedIn auth failed', linkedin_error: error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const result = await handleLinkedInCallback(code, redirectUri);
  if (result.ok) {
    return NextResponse.json({ success: true, message: 'Token saved. POST to /api/linkedin/post with { "text": "..." }.' });
  }
  return NextResponse.json({ error: result.error, details: result.details }, { status: result.status });
}

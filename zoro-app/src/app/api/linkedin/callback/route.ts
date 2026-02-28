import { NextRequest, NextResponse } from 'next/server';
import { handleLinkedInCallback } from '@/lib/linkedin-callback';

/**
 * GET /api/linkedin/callback
 * Alternative callback (use /auth/linkedin/callback for success page redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  if (error) {
    return NextResponse.json({ error: 'LinkedIn auth failed', linkedin_error: error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }
  if (!redirectUri) {
    return NextResponse.json({ error: 'LINKEDIN_REDIRECT_URI not set' }, { status: 500 });
  }

  const result = await handleLinkedInCallback(code, redirectUri);
  if (result.ok) {
    return NextResponse.json({ success: true, message: 'Token saved. POST to /api/linkedin/post with { "text": "..." }.' });
  }
  return NextResponse.json({ error: result.error, details: result.details }, { status: result.status });
}

import { NextResponse } from 'next/server';
import { getLinkedInToken } from '@/lib/linkedin-token';

/**
 * GET /api/linkedin/status
 * Returns whether a LinkedIn token is saved (for debugging).
 */
export async function GET() {
  try {
    const token = await getLinkedInToken();
    return NextResponse.json({ hasToken: !!token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ hasToken: false, error: msg }, { status: 500 });
  }
}

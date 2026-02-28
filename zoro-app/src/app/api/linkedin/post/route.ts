import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInToken } from '@/lib/linkedin-token';

const LINKEDIN_ME_URL = 'https://api.linkedin.com/v2/me';
const LINKEDIN_UGC_POST_URL = 'https://api.linkedin.com/v2/ugcPosts';

/**
 * POST /api/linkedin/post
 * Body: { text: string } — text only. Uses saved token from /api/linkedin/callback.
 * Run /api/linkedin/auth once to authorize and save the token.
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getLinkedInToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No LinkedIn token. Visit /api/linkedin/auth to authorize first.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text.trim() : 'Posted via Zoro API';
    if (!text) {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }

    const meRes = await fetch(LINKEDIN_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!meRes.ok) {
      const err = await meRes.text();
      return NextResponse.json({ error: 'Invalid or expired token', details: err.slice(0, 300) }, { status: 401 });
    }
    const me = (await meRes.json()) as { id?: string };
    const personId = me?.id;
    if (!personId) {
      return NextResponse.json({ error: 'Profile missing id' }, { status: 502 });
    }

    const postBody = {
      author: `urn:li:person:${personId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: text.slice(0, 3000), attributes: [] },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };

    const postRes = await fetch(LINKEDIN_UGC_POST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postBody),
    });

    if (!postRes.ok) {
      const err = await postRes.text();
      return NextResponse.json({ error: 'LinkedIn post failed', details: err.slice(0, 500) }, { status: 502 });
    }

    const postId = postRes.headers.get('x-restli-id');
    return NextResponse.json({ success: true, postId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Post failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

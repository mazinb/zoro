import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInToken } from '@/lib/linkedin-token';

const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
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

    const authorUrn = 'urn:li:organization:112682958';

    const postBody = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: text.slice(0, 3000), attributes: [] },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      distribution: {
        feedDistribution: 'MAIN_FEED',
        distributedViaFollowFeed: true,
      },
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

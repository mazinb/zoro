import { NextRequest, NextResponse } from 'next/server';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const headerSecret = request.headers.get('x-webhook-secret')?.trim();
  if (headerSecret && headerSecret === secret) return true;

  const auth = request.headers.get('authorization')?.trim();
  if (auth === `Bearer ${secret}`) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const event = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).event : null;
    const instance =
      payload && typeof payload === 'object' ? (payload as Record<string, unknown>).instance : null;

    // Keep this lightweight for now: accept events and log a tiny trace for debugging.
    console.info('[evolution-webhook]', {
      event: typeof event === 'string' ? event : 'unknown',
      instance: typeof instance === 'string' ? instance : 'unknown',
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'webhook failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}

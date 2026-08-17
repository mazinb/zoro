import { NextResponse } from 'next/server';

export async function GET() {
  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID: 'Y4KNF8GPPR.com.getzoro.zoroFlutter',
          paths: ['/mailbox/claim', '/mailbox/claim/*'],
        },
      ],
    },
  };
  return NextResponse.json(body, {
    headers: { 'Content-Type': 'application/json' },
  });
}

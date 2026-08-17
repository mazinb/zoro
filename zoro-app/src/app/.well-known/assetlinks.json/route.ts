import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.getzoro.zoroFlutter',
        sha256_cert_fingerprints: [],
      },
    },
  ]);
}

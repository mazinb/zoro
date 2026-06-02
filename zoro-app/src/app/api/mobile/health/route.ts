import { NextRequest, NextResponse } from 'next/server';

/**
 * Production-safe health probe for mobile backend.
 * Never returns secrets; only tells whether required env vars are present.
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    ok: true,
    env: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceRole: !!(
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_SECRET_KEY ||
        process.env.SUPABASE_SECRET_KEY
      ),
      openaiApiKey: !!process.env.OPENAI_API_KEY,
      geminiApiKey: !!process.env.GEMINI_API_KEY,
      nodeEnv: process.env.NODE_ENV ?? null,
    },
  });
}


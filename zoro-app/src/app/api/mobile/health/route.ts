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
      /** Cloud AI assistant uses Qwen/vLLM when QWEN_BASE_URL is set; else Gemini. */
      qwenBaseUrl: !!process.env.QWEN_BASE_URL?.trim(),
      qwenApiKey: !!process.env.QWEN_API_KEY?.trim(),
      mailboxInboundDomain: !!process.env.MAILBOX_INBOUND_DOMAIN?.trim(),
      resendInboundWebhook: !!(process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() || process.env.WEBHOOK_SECRET?.trim()),
      nodeEnv: process.env.NODE_ENV ?? null,
    },
  });
}


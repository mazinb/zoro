import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Shown in API JSON when service role is unset (nags, cron, etc.). */
export const SUPABASE_SERVICE_ROLE_SETUP =
  'Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase Dashboard → Project Settings → API → service_role secret). The public anon key alone cannot access the nags table because RLS has no anon policies.';

function resolveServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  );
}

/**
 * Service role client, or null if URL / service key missing (use for graceful API errors).
 */
export function tryGetSupabaseServiceRole(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = resolveServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Get Supabase client for server-side operations
 * @param token - Optional authentication token for user-scoped operations
 * @returns Supabase client instance
 * @throws Error if required environment variables are missing
 */
export function getSupabaseClient(token?: string): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Get Supabase client with service role key. Bypasses RLS.
 * Use only in API routes after validating the request (e.g. token → user_id).
 * Never expose the service role key to the client.
 */
export function getSupabaseServiceRole(): SupabaseClient {
  const client = tryGetSupabaseServiceRole();
  if (!client) {
    throw new Error(
      `Missing Supabase server config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY). ${SUPABASE_SERVICE_ROLE_SETUP}`
    );
  }
  return client;
}


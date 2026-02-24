import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase server config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}


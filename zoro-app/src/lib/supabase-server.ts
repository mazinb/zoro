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


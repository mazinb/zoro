'use client';

import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client for authentication
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if keys are available (dev envs without keys)
let supabaseClient: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export { supabaseClient };

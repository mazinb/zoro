import { createClient } from '@supabase/supabase-js';

// Environment variables are read from .env file (or .env.local)
// Next.js automatically loads these from .env, .env.local, .env.development, etc.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Debug logging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase Config Check:');
  console.log('  URL present:', !!supabaseUrl, supabaseUrl ? `(${supabaseUrl.substring(0, 30)}...)` : '(missing)');
  console.log('  Anon Key present:', !!supabaseAnonKey, supabaseAnonKey ? `(${supabaseAnonKey.substring(0, 30)}...)` : '(missing)');
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type ResolveTokenResult = { userId: string } | { error: string; status: number };

/**
 * Resolves token (users.verification_token or user_data.user_token) to user_id.
 * Used by /api/agent and /api/profile.
 */
export async function resolveTokenToUserId(token: string | null): Promise<ResolveTokenResult> {
  if (!token?.trim()) {
    return { error: 'Token is required', status: 400 };
  }

  if (!supabaseUrl || !anonKey) {
    return { error: 'Missing Supabase configuration', status: 500 };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Primary: users.verification_token
  const { data: tokenUser, error: tokenError } = await supabase
    .from('users')
    .select('id')
    .eq('verification_token', token.trim())
    .maybeSingle();

  if (tokenError) {
    return { error: tokenError.message, status: 500 };
  }
  if (tokenUser?.id) {
    return { userId: tokenUser.id };
  }

  // Fallback: user_data.user_token
  const { data: userData, error: udError } = await supabase
    .from('user_data')
    .select('user_id')
    .eq('user_token', token.trim())
    .maybeSingle();

  if (udError) {
    return { error: udError.message, status: 500 };
  }
  if (userData?.user_id) {
    return { userId: userData.user_id };
  }

  return { error: 'Invalid or expired link', status: 404 };
}

import { getSupabaseServiceRole } from './supabase-server';

const ROW_ID = 1;

export async function getLinkedInToken(): Promise<string | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from('linkedin_token')
    .select('access_token, expires_at')
    .eq('id', ROW_ID)
    .maybeSingle();
  if (error || !data?.access_token) return null;
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null;
  if (expiresAt != null && Date.now() >= expiresAt) return null;
  return data.access_token;
}

export async function setLinkedInToken(accessToken: string, expiresInSeconds?: number): Promise<void> {
  const supabase = getSupabaseServiceRole();
  const expiresAt =
    expiresInSeconds != null
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null;
  const { error } = await supabase.from('linkedin_token').upsert(
    { id: ROW_ID, access_token: accessToken, expires_at: expiresAt },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

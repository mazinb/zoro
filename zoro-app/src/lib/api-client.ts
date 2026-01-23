import { supabaseClient } from './supabase-client';

// Helper to get auth headers for API calls
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  return headers;
}


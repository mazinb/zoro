import { supabase } from '../services/supabase';

export async function verifyEmail(token: string) {
  // Find user by token
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('id, is_verified')
    .eq('verification_token', token)
    .single();
  
  if (findError || !user) {
    throw new Error('Invalid or expired verification token');
  }
  
  if (user.is_verified) {
    return { message: 'Email already verified' };
  }
  
  // Update user
  const { error: updateError } = await supabase
    .from('users')
    .update({
      is_verified: true,
      verification_token: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);
  
  if (updateError) throw updateError;
  
  return { message: 'Email verified successfully' };
}


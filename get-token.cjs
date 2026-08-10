const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  'https://bnqrzxscdrivvsbqtggq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc2NjMxNywiZXhwIjoyMDc2MzQyMzE3fQ.6P40lB58JmUNlmTleXgiwsXBlx4TPaKgJnzB0Km9AIg'
);

async function test() {
  const email = 'mazin.biviji1@gmail.com';
  
  // Try to find existing user
  const { data: existing } = await supabase
    .from('users')
    .select('id, verification_token, email, created_at')
    .eq('email', email)
    .maybeSingle();
    
  if (existing?.verification_token) {
    console.log('FOUND EXISTING TOKEN:', existing.verification_token);
    console.log('User ID:', existing.id);
    return;
  }
  
  // Create user
  const newToken = crypto.randomBytes(16).toString('hex');
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      email,
      verification_token: newToken,
      token: newToken,
    })
    .select('id, verification_token')
    .single();
    
  if (error) {
    console.error('CREATE ERROR:', error.message);
    return;
  }
  
  console.log('CREATED USER TOKEN:', newToken);
  console.log('User ID:', newUser.id);
}

test().catch(console.error);

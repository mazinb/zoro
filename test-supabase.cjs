const http = require('http');

const SUPABASE_URL = 'https://bnqrzxscdrivvsbqtggq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc2NjMxNywiZXhwIjoyMDc2MzQyMzE3fQ.6P40lB58JmUNlmTleXgiwsXBlx4TPaKgJnzB0Km9AIg';

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// Test 1: Check existing user_context for the test user
console.log('=== Test 1: Fetch existing user_context ===');
const fetchUrl = `${SUPABASE_URL}/rest/v1/user_context?select=memory_jsonb&user_id=eq.9b2bd63d-7404-41fd-aba6-f354a8d2fcef`;

const fetchOptions = {
  hostname: 'bnqrzxscdrivvsbqtggq.supabase.co',
  path: `/rest/v1/user_context?select=memory_jsonb&user_id=eq.9b2bd63d-7404-41fd-aba6-f354a8d2fcef`,
  method: 'GET',
  headers,
};

const fetchReq = http.request(fetchOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
    
    // Test 2: Try to insert
    console.log('\n=== Test 2: Insert new user_context ===');
    const insertUrl = `${SUPABASE_URL}/rest/v1/user_context?select=*&on_conflict=user_id`;
    
    const insertOptions = {
      hostname: 'bnqrzxscdrivvsbqtggq.supabase.co',
      path: '/rest/v1/user_context?select=*&on_conflict=user_id',
      method: 'POST',
      headers,
    };
    
    const insertData = JSON.stringify({
      user_id: '9b2bd63d-7404-41fd-aba6-f354a8d2fcef',
      memory_jsonb: [{
        type: 'outbound',
        timestamp: new Date().toISOString(),
        subject: 'Test Email from REST API',
        bodyPreview: 'This is a test entry created directly via REST API.',
        resend_id: 'test123',
      }],
      updated_at: new Date().toISOString(),
    });
    
    const insertReq = http.request(insertOptions, (res2) => {
      let body = '';
      res2.on('data', (chunk) => body += chunk);
      res2.on('end', () => {
        console.log('Status:', res2.statusCode);
        console.log('Headers:', JSON.stringify(res2.headers));
        console.log('Body:', body);
      });
    });
    
    insertReq.on('error', (e) => {
      console.error('Insert error:', e.message);
    });
    
    insertReq.write(insertData);
    insertReq.end();
  });
});

fetchReq.on('error', (e) => {
  console.error('Fetch error:', e.message);
});

fetchReq.end();
const http = require('http');

// Check user_context for the test user
const options = {
  hostname: 'bnqrzxscdrivvsbqtggq.supabase.co',
  path: '/rest/v1/user_context?select=user_id,memory_jsonb&user_id=eq.9b2bd63d-7404-41fd-aba6-f354a8d2fcef',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc2NjMxNywiZXhwIjoyMDc2MzQyMzE3fQ.6P40lB58JmUNlmTleXgiwsXBlx4TPaKgJnzB0Km9AIg',
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('=== user_context ===');
    console.log('Status:', res.statusCode);
    console.log('Result:', data);
  });
});

req.on('error', (e) => console.error(e));
req.end();

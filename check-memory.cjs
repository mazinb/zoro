const http = require('http');

const options = {
  hostname: 'bnqrzxscdrivvsbqtggq.supabase.co',
  path: '/rest/v1/user_context?select=memory_jsonb,user_id&eq=user_id,fcb3f7b2-0c26-462e-905f-8a34c7f1488f&limit=1',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYzMTcsImV4cCI6MjA3NjM0MjMxN30.66-uxFsrWXyq0OZ6DREWwQrAFjBUpR5cT15HfvbvOKs',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc2NjMxNywiZXhwIjoyMDc2MzQyMzE3fQ.6P40lB58JmUNlmTleXgiwsXBlx4TPaKgJnzB0Km9AIg',
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log('MEMORY_JSONB:', JSON.stringify(parsed[0].memory_jsonb, null, 2));
    } else {
      console.log('No memory_jsonb found or empty:', parsed);
    }
  });
});

req.on('error', (e) => console.error(e));
req.end();

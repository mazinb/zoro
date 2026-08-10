const http = require('http');

const options = {
  hostname: 'bnqrzxscdrivvsbqtggq.supabase.co',
  path: '/rest/v1/users?select=id,email,verification_token,token&limit=5',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYzMTcsImV4cCI6MjA3NjM0MjMxN30.66-uxFsrWXyq0OZ6DREWwQrAFjBUpR5cT15HfvbvOKs',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc2NjMxNywiZXhwIjoyMDc2MzQyMzE3fQ.6P40lB58JmUNlmTleXgiwsXBlx4TPaKgJnzB0Km9AIg',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const users = JSON.parse(data);
    console.log(JSON.stringify(users, null, 2));
  });
});

req.on('error', (e) => console.error(e));
req.end();

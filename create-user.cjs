const http = require('http');
const crypto = require('crypto');

const newToken = crypto.randomBytes(16).toString('hex');
const email = 'mazin.biviji1@gmail.com';

// First, create the user via service role
const createOptions = {
  hostname: 'bnqrzxscdrivvsbqtggq.supabase.co',
  path: '/rest/v1/users',
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjYzMTcsImV4cCI6MjA3NjM0MjMxN30.66-uxFsrWXyq0OZ6DREWwQrAFjBUpR5cT15HfvbvOKs',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJucXJ6eHNjZHJpdnZzYnF0Z2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDc2NjMxNywiZXhwIjoyMDc2MzQyMzE3fQ.6P40lB58JmUNlmTleXgiwsXBlx4TPaKgJnzB0Km9AIg',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    email,
    verification_token: newToken,
    token: newToken
  })
};

const createReq = http.request(createOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('CREATE RESPONSE:', res.statusCode, data);
  });
});

createReq.on('error', (e) => console.error('CREATE ERROR:', e));
createReq.write(JSON.stringify({
  email,
  verification_token: newToken,
  token: newToken
}));
createReq.end();

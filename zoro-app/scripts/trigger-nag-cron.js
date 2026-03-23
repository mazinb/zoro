/**
 * Trigger /api/cron/nags (same contract as Supabase Cron HTTP job).
 *
 *   npm run nag:cron
 *
 * .env.local:
 *   NAG_DISPATCH_KEY=...        — required; must match Next.js env
 *   NAG_CRON_BASE_URL=...      — optional; default http://127.0.0.1:3000
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const base = (process.env.NAG_CRON_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const key = process.env.NAG_DISPATCH_KEY;

if (!key) {
  console.error('Missing NAG_DISPATCH_KEY. Add it to .env.local (see docs/nag/supabase-cron.md).');
  process.exit(1);
}

const url = `${base}/api/cron/nags`;

fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
})
  .then(async (res) => {
    const text = await res.text();
    console.log(`${res.status} ${res.statusText}`);
    try {
      const j = JSON.parse(text);
      console.log(JSON.stringify(j, null, 2));
    } catch {
      console.log(text);
    }
    process.exit(res.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });

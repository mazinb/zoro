/**
 * Seed / refresh the S&P 500 Greenblatt cache in Supabase.
 *
 *   npx tsx scripts/refresh-greenblatt.ts
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

import { refreshGreenblattSnapshot } from '../src/lib/usmarket/greenblatt-store';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_SECRET_KEY;

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Refreshing Greenblatt snapshot from Yahoo Finance…');
  const result = await refreshGreenblattSnapshot(supabase);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

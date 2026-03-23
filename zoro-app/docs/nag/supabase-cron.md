# Run nag dispatch from Supabase (cron + monitoring)

Nags are sent when your **Next.js** app handles `POST /api/cron/nags`. Supabase runs the schedule; the app still performs Resend + DB updates (same as today).

## 1. Environment (Next.js)

Set a long random string and deploy it with the app:

| Variable | Purpose |
|----------|---------|
| `NAG_DISPATCH_KEY` | `Authorization: Bearer <this value>` must match on every dispatch request |

**Do not** put this key in client-side code or public env vars.

## 2. Supabase Cron (recommended: Dashboard)

1. Open **Project → Integrations → [Cron / Jobs](https://supabase.com/dashboard/project/_/integrations/cron/jobs)**.
2. **Create job**
   - **Name:** `nag-dispatch` (names are case-sensitive and sticky)
   - **Schedule:** `*/10 * * * *` (every 10 minutes) or tighter if you need faster follow-ups
   - **Type:** **HTTP request**
   - **URL:** `https://YOUR_DEPLOYED_ORIGIN/api/cron/nags` (your real Next site)
   - **Method:** `POST`
   - **Headers:** `Authorization` = `Bearer YOUR_NAG_DISPATCH_KEY` (same value as Next env)

The dashboard stores the schedule and runs it from Supabase infrastructure—no Vercel involved.

### Alternative: SQL + `pg_net` (HTTP from Postgres)

Enable extension **pg_net** (Database → Extensions) if not already on.

Replace placeholders (`YOUR_ORIGIN`, `YOUR_KEY`):

```sql
select
  cron.schedule(
    'nag-dispatch',
    '*/10 * * * *',
    $$
    select
      net.http_post(
        url := 'https://YOUR_ORIGIN/api/cron/nags',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer YOUR_NAG_DISPATCH_KEY'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      ) as request_id;
    $$
  );
```

To stop: `select cron.unschedule('nag-dispatch');`

For production, prefer storing the bearer token in [Vault](https://supabase.com/docs/guides/database/vault) and building the header in a small SQL function so the key is not plain in `cron.job`.

## 3. Monitoring

### A. Supabase Cron job history

In the **Jobs** UI, use **History** on `nag-dispatch`.  
Or query:

```sql
select *
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'nag-dispatch')
order by start_time desc
limit 20;
```

This shows whether Postgres fired the job; it does not parse HTTP status bodies.

### B. Application run log (`nag_dispatch_runs`)

Each successful or failed **application** run of `/api/cron/nags` inserts a row (service role from Next.js):

| Column | Meaning |
|--------|---------|
| `finished_at` | When the handler finished |
| `ok` | HTTP handler completed without throw |
| `checked` | Due nags considered |
| `sent` | Emails accepted by Resend |
| `failed` | Skipped or send errors |
| `error` | Error message if `ok = false` |

Query in **SQL Editor**:

```sql
select finished_at, ok, checked, sent, failed, error
from public.nag_dispatch_runs
order by finished_at desc
limit 50;
```

There are **no RLS policies** for anon/authenticated users; only the service role (your API) inserts. Project owners can always read tables in the Dashboard.

## 4. Local testing

```bash
# .env.local: NAG_DISPATCH_KEY=...
npm run dev
npm run nag:cron
```

`scripts/trigger-nag-cron.js` sends `Authorization: Bearer …` only.

## 5. Why not run sends inside Postgres only?

Email (Resend) and your existing schedule logic live in Next.js. Supabase Cron only needs to **wake** that route on an interval; moving sends into Edge Functions would duplicate logic. This pattern keeps a single implementation and uses Supabase for **scheduling + job history**, and the DB table for **delivery metrics**.

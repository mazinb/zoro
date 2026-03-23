# Nag feature

Scheduled reminders ("nags") with delivery via Resend (email) and Evolution API (WhatsApp), natural-language scheduling via OpenAI, and persistence in Supabase (`nags` table).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key (token resolution uses anon client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; all `nags` reads/writes after token check |
| `RESEND_API_KEY` | Yes for email | Send confirmation and recurring nag emails |
| `RESEND_FROM` | No | Default `Zoro <admin@getzoro.com>` |
| `OPENAI_API_KEY` | Recommended | `POST /api/nag-parse`; if missing, API returns a safe default draft |
| `OPENAI_NAG_PARSE_MODEL` | No | Default `gpt-4o-mini` |
| `NEXT_PUBLIC_NAG_DEV_TOKEN` | No | **Local / dev only:** your real `verification_token` so `/nag` and the sandbox work without pasting the query string. Never use a production secret in a public build. |
| `NAG_DISPATCH_KEY` | Yes for dispatch | Shared secret for `Authorization: Bearer` on `POST /api/cron/nags` (Supabase Cron, local script, etc.) |
| `EVOLUTION_API_BASE_URL` | Yes for WhatsApp | Evolution API server base URL |
| `EVOLUTION_API_KEY` | Yes for WhatsApp | Evolution API key (`apikey` header) |
| `EVOLUTION_API_INSTANCE` | Yes for WhatsApp | Evolution instance name (e.g. `zoro-nags`) |
| `EVOLUTION_API_TIMEOUT_MS` | No | WhatsApp send timeout in milliseconds (default `15000`) |
| `EVOLUTION_WEBHOOK_SECRET` | Recommended | Secret for `/api/webhooks/evolution` (`x-webhook-secret` or Bearer auth) |
| `GEMINI_API_KEY` | No | Not used by Nag; reserved for future provider swap |

## User access

**Get started** on `/nag` collects email and calls the shared endpoint `POST /api/auth/send-magic-link` with `redirectPath: "/nag"`, `context: "nag"`, and `inviteIfUnregistered: true`:

- If the email exists in `users`, they receive a magic link to `/nag?token=…`.
- If not, they receive an email pointing them to **https://www.getzoro.com** to sign up.

The same endpoint (without `inviteIfUnregistered`) is used elsewhere; see [`/api/auth/send-magic-link`](../../src/app/api/auth/send-magic-link/route.ts).

## Docs in this folder

- [api.md](./api.md) — HTTP endpoints and payloads
- [supabase-cron.md](./supabase-cron.md) — **Schedule dispatch with Supabase Cron + monitoring**
- [mcp.md](./mcp.md) — MCP server (Cursor): stdio tools that call the Nag API
- [schema.md](./schema.md) — Database tables and RLS
- [whatsapp-evolution.md](./whatsapp-evolution.md) — Evolution hosting, dashboard options, and WhatsApp setup

## Dispatch schedule (Supabase Cron)

Use **[supabase-cron.md](./supabase-cron.md)** to wire **Supabase Integrations → Cron** (HTTP POST to your Next app) or `pg_net` + `cron.schedule`. The app records each run in **`nag_dispatch_runs`** for monitoring.

**Local:** `npm run nag:cron` (same `Authorization` header as production).

### End-to-end test (email + “until done” follow-ups)

1. **Env:** `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NAG_DISPATCH_KEY`, and run the app (`npm run dev` or `npm run build && npm run start`).
2. **User:** Open `/nag`, sign in with magic link, set Profile timezone if needed.
3. **Create a nag:** Email channel, enable **Nag until I mark it done**, pick a short follow-up interval in the UI (minimum explicit API interval is **1 hour**).
4. **Make it due now:** In Supabase SQL Editor:

   ```sql
   update nags
   set next_at = now() - interval '1 minute'
   where id = 'YOUR_NAG_UUID';
   ```

5. **Run dispatch:** `npm run nag:cron` — check email, `nags` row, and `nag_dispatch_runs`.
6. **Second follow-up:** Set `next_at` in the past again, run `npm run nag:cron` again.
7. **Finish:** Tap **Done** on `/nag` or `PATCH` with `task_completed: true`.
8. **Sent log:** “Recent reminder emails” / `GET /api/nags/sent-log` when `user_context` exists.

If `user_context` is missing for the user, reminder emails still send; the memory append is skipped until that row exists.

## Timezone

Schedule times (`time_hhmm`) use the user’s **`users.timezone`** (IANA, e.g. `America/New_York`), editable from the Nags **Profile** sheet. Changing timezone updates **`next_at`** for all **active** nags. Default is **UTC** for existing rows after migration.

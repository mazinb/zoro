# Nag feature

Scheduled reminders (“nags”) with email delivery via Resend, natural-language scheduling via OpenAI, and persistence in Supabase (`nags` table).

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
| `CRON_SECRET` | Yes for cron | Bearer token for `/api/cron/nags` |
| `GEMINI_API_KEY` | No | Not used by Nag; reserved for future provider swap |

## User access

**Get started** on `/nag` collects email and calls the shared endpoint `POST /api/auth/send-magic-link` with `redirectPath: "/nag"`, `context: "nag"`, and `inviteIfUnregistered: true`:

- If the email exists in `users`, they receive a magic link to `/nag?token=…`.
- If not, they receive an email pointing them to **https://www.getzoro.com** to sign up.

The same endpoint (without `inviteIfUnregistered`) is used elsewhere; see [`/api/auth/send-magic-link`](../../src/app/api/auth/send-magic-link/route.ts).

## Docs in this folder

- [api.md](./api.md) — HTTP endpoints and payloads
- [schema.md](./schema.md) — Database table and RLS

## Cron (production)

The repo includes [`vercel.json`](../../vercel.json) with a cron entry for `/api/cron/nags` every 10 minutes. Set **`CRON_SECRET`** in the Vercel project; Vercel sends `Authorization: Bearer <CRON_SECRET>` when that env var is configured.

Alternatively call `GET` or `POST /api/cron/nags` with `?secret=<CRON_SECRET>`. See [api.md](./api.md).

## Timezone (MVP)

Schedule times (`time_hhmm`) are interpreted in **UTC**. Document any change to user-local TZ in future releases.

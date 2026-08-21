# Mobile Hermes mailbox

Private PDF-only forwarding inbox for the Zoro app. Not Gmail/Outlook access.

## Flow

1. Agent tab → **Claim private mailbox** → pick a **username** and enter the email you send statements from.
2. Magic link opens `https://www.getzoro.com/mailbox/claim?nonce=…` and then `zoro://mailbox/claim?nonce=…`.
3. The phone receives `username@getzoro.com` (domain from `MAILBOX_INBOUND_DOMAIN`). Forward PDFs **from the claimed address only**.
4. The app pulls pending PDFs (`/fetch` or Agent actions), then acks so getzoro deletes the server copy (default retention 48h).

One claimed email may have **one active mailbox** at a time. Disconnecting clears the remote inbox and local credential, not PDFs already on the phone.

## Inbound wiring (important)

Resend webhooks do **not** include attachment bytes — only metadata. This API lists/downloads attachments via the Resend Receiving Attachments API (`RESEND_API_KEY`).

If Resend already posts to an **external mail pipeline** (outside this repo), pick one:

1. **Preferred:** add a second Resend webhook pointing at  
   `https://www.getzoro.com/api/webhooks/resend/inbound`  
   (event: `email.received`, secret → `RESEND_INBOUND_WEBHOOK_SECRET`), **or**
2. From that external service, forward mailbox-bound mail to  
   `POST /api/mobile/mailbox/ingest` with  
   `Authorization: Bearer <MAILBOX_INGEST_SECRET>`  
   (body: raw Resend payload, or `{ emailId, from, to, subject, attachments? }`).

Without (1) or (2), claim/deep-link works but PDFs never land in `mobile_mailbox_messages`.

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/mobile/mailbox/claim` | `{ deviceId, email, username }` |
| GET | `/api/mobile/mailbox/claim?deviceId=` | claim state |
| GET | `/api/mobile/mailbox/username?username=` | availability (`deviceId` optional) |
| GET | `/api/mobile/mailbox/claim/finish?nonce=` | marks email verified |
| POST | `/api/mobile/mailbox/claim/finish` | `{ deviceId, nonce? }` → `{ address, mailboxToken, claimedEmail }` |
| GET | `/api/mobile/mailbox/status` | Bearer or `?deviceId=` |
| POST | `/api/mobile/mailbox/register` | Bearer — rotate token |
| GET | `/api/mobile/mailbox/pending` | Bearer |
| GET | `/api/mobile/mailbox/download?id=` | Bearer |
| POST | `/api/mobile/mailbox/ack` | Bearer `{ id }` |
| POST | `/api/mobile/mailbox/revoke` | Bearer |
| POST | `/api/mobile/mailbox/ingest` | `MAILBOX_INGEST_SECRET` (or `NAG_DISPATCH_KEY`) |
| POST | `/api/webhooks/resend/inbound` | Svix (`RESEND_INBOUND_WEBHOOK_SECRET`) |
| POST | `/api/cron/mailbox-purge` | `NAG_DISPATCH_KEY` / `MAILBOX_PURGE_KEY` |

## Env

| Variable | Notes |
|----------|--------|
| `MAILBOX_INBOUND_DOMAIN` | Optional receiving-domain override; defaults to verified `getzoro.com` |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Resend/Svix signing secret for `/api/webhooks/resend/inbound` |
| `MAILBOX_INGEST_SECRET` | Shared secret for external pipeline → `/api/mobile/mailbox/ingest` |
| `MAILBOX_RETENTION_HOURS` | Default 48 |
| `RESEND_API_KEY` / `RESEND_FROM` | Claim emails + attachment download |

PDF only, max 12MB, 5 files per message. Username: 3–32 chars, starts with a letter, `[a-z0-9_-]`.

## Schema

Apply `supabase/migrations/20260821120000_mailbox_local_part.sql` (`mobile_mailbox_claims.local_part`).

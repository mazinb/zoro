# Mobile Hermes mailbox

Private PDF-only forwarding inbox for the Zoro app. Not Gmail/Outlook access.

## Flow

1. Agent tab → **Claim private mailbox** → enter the email you send statements from.
2. Magic link opens `https://www.getzoro.com/mailbox/claim?nonce=…` and then `zoro://mailbox/claim?nonce=…`.
3. The phone receives a private address (`zoro-…@inbox.getzoro.com` by default). Forward PDFs **from the claimed address only**.
4. The app pulls pending PDFs, then acks so getzoro deletes the server copy (default retention 48h).

One claimed email may have **one active mailbox** at a time. Disconnecting clears the remote inbox and local credential, not PDFs already on the phone.

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/mobile/mailbox/claim` | `{ deviceId, email }` |
| GET | `/api/mobile/mailbox/claim?deviceId=` | claim state |
| GET | `/api/mobile/mailbox/claim/finish?nonce=` | marks email verified |
| POST | `/api/mobile/mailbox/claim/finish` | `{ deviceId, nonce? }` → `{ address, mailboxToken, claimedEmail }` |
| GET | `/api/mobile/mailbox/status` | Bearer or `?deviceId=` |
| POST | `/api/mobile/mailbox/register` | Bearer — rotate token |
| GET | `/api/mobile/mailbox/pending` | Bearer |
| GET | `/api/mobile/mailbox/download?id=` | Bearer |
| POST | `/api/mobile/mailbox/ack` | Bearer `{ id }` |
| POST | `/api/mobile/mailbox/revoke` | Bearer |
| POST | `/api/webhooks/resend/inbound` | Svix (`RESEND_INBOUND_WEBHOOK_SECRET`) |
| POST | `/api/cron/mailbox-purge` | `NAG_DISPATCH_KEY` / `MAILBOX_PURGE_KEY` |

## Env

| Variable | Notes |
|----------|--------|
| `MAILBOX_INBOUND_DOMAIN` | Default `inbox.getzoro.com` |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Resend/Svix signing secret |
| `MAILBOX_RETENTION_HOURS` | Default 48 |
| `RESEND_API_KEY` / `RESEND_FROM` | Claim emails |

Point Resend inbound at `/api/webhooks/resend/inbound` for the mailbox domain. PDF only, max 12MB, 5 files per message.

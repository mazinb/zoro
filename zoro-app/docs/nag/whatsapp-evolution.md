# WhatsApp via Evolution API (Nags)

This guide covers:

- Hosting Evolution API
- Connecting a WhatsApp instance
- Dashboard options
- The exact environment variable names expected by this app

## 1) Host Evolution API

You can self-host Evolution API with Docker on any VPS (Hetzner, DigitalOcean, AWS, etc.).

Recommended baseline:

- 2 vCPU / 4 GB RAM
- Persistent volume for sessions
- Reverse proxy (Nginx/Caddy) + HTTPS
- Optional Redis/Postgres based on your Evolution setup profile

Official docs:

- Intro: <https://doc.evolution-api.com/v2/en/get-started/introduction>
- Docker: <https://doc.evolution-api.com/v2/en/install/docker>
- Nginx/SSL: <https://doc.evolution-api.com/v2/en/install/nginx>

## 2) Create and connect your instance

After your Evolution server is live:

1. Create instance (`POST /instance/create`) with `integration: WHATSAPP-BAILEYS`
2. Connect phone (`GET /instance/connect/{instance}`) and scan pairing/QR
3. Verify connected state (`GET /instance/connectionState/{instance}` returns `open`)

Useful docs:

- Create instance: <https://doc.evolution-api.com/v2/api-reference/instance-controller/create-instance-basic>
- Connect: <https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect>
- Connection state: <https://doc.evolution-api.com/v2/api-reference/instance-controller/connection-state>

## 3) Configure webhook to this app

Set Evolution webhook to:

- `https://<your-zoro-domain>/api/webhooks/evolution`

Subscribe to at least:

- `CONNECTION_UPDATE`
- `MESSAGES_UPSERT`
- `SEND_MESSAGE`

Webhook docs:

- Set webhook: <https://doc.evolution-api.com/v2/api-reference/webhook/set>
- Events: <https://doc.evolution-api.com/v2/en/configuration/webhooks>

## 4) Dashboard options

### Option A (fastest): Evolution Swagger/API docs UI

Use the built-in API docs/openapi endpoints on your Evolution server for operational checks and endpoint testing.

### Option B (recommended): N8N as ops dashboard + automations

Evolution has first-class integration docs for n8n. You can build:

- event monitor workflow (message statuses)
- reconnect alerts
- dead-letter/retry flow for failed sends

Docs:

- <https://doc.evolution-api.com/v2/en/integrations/n8n>

### Option C: Chatwoot UI (if you want inbox-style operations)

Useful when you want an agent inbox/conversation dashboard beyond simple nag dispatch.

Docs:

- <https://doc.evolution-api.com/v2/en/integrations/chatwoot>

## 5) Env vars this code expects

Add these in your deployment/local env (do not commit secrets):

- `EVOLUTION_API_BASE_URL`  
  Example: `https://evolution.yourdomain.com`
- `EVOLUTION_API_KEY`  
  Your Evolution server API key (used in `apikey` header)
- `EVOLUTION_API_INSTANCE`  
  Instance name (example: `zoro-nags`)
- `EVOLUTION_API_TIMEOUT_MS` (optional)  
  Request timeout in ms (default `15000`)
- `EVOLUTION_WEBHOOK_SECRET` (optional but recommended)  
  Shared secret checked by `/api/webhooks/evolution`

Existing env (already required by cron):

- `NAG_DISPATCH_KEY` for calling `/api/cron/nags`

## 6) How dispatch works now

- `channel = email` → Resend sender
- `channel = whatsapp` → Evolution `sendText`
- WhatsApp target number is resolved from the latest non-null `form_submissions.phone` matching the nag owner email.

If no phone is found, that nag send is marked as failed for that run.

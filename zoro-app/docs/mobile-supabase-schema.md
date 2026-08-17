# Mobile Supabase schema (applied via MCP)

Last applied: `token_billing_consume_rpcs` (after `token_billing` columns + `mobile_apply_product`)

## Tables

### `mobile_devices`
- `device_id` (PK), `platform`, `app_version`, `build_number`, `last_seen_at`, `created_at`

### `mobile_entitlements`
- `device_id` (PK, FK → mobile_devices)
- `is_pro`, `pro_expires_at`, `credits_balance` (legacy pack count)
- `token_balance`, `tokens_used_total` — Cloud AI billing (1 pack = 100,000 tokens)
- `free_ai_month_key`, `free_ai_used` — monthly token grant month key
- `onboarding_imports_used`, `onboarding_imports_eligible` — one-time setup pool (20 max, not deducted)
- `updated_at`

### `mobile_ai_consents`
- PK (`device_id`, `provider`) — providers include `zoroCloud`, `appleFoundation`, etc.
- `consented_at`, `revoked_at` (opt-out), `privacy_policy_version`, `app_version`, `platform`
- RLS enabled; service role only from app API

### Hermes mailbox
- `mobile_mailbox_claims` — short-lived email proof (`nonce_hash`, `email_verified_at`, `consumed_at`)
- `mobile_mailboxes` — one active row per claimed email and per device; `token_hash` only
- `mobile_mailbox_messages` — pending PDFs with `expires_at` / `acked_at`
- `mobile_mailbox_webhook_events` — inbound idempotency
- Storage bucket `mailbox-attachments` (private). RLS on; service-role API only.
- RPC `mobile_mailbox_purge_expired()`

## RPCs

### `mobile_consume_tokens(device_id_in, tokens_in, onboarding_phase_in default false, grant_only_in default false)`
- Month rollover grants 100,000 tokens to Free accounts
- Pro: unlimited (increments `tokens_used_total` only)
- Setup phase: counts usage, does not deduct
- Else: require `token_balance >= max(tokens_in, 1)` and deduct when `tokens_in > 0`
- `grant_only_in=true`: month grant, never 402 (entitlements refresh)

### `mobile_consume_import(device_id_in, kind_in, onboarding_phase_in default false)`
- Preflight wrapper: `mobile_consume_tokens(..., 0)`

### `mobile_apply_product(device_id_in, product_id_in)`
- `pro_monthly`: Pro + 32-day expiry
- `credit_1`: +100,000 tokens

### `mobile_finish_onboarding_imports(device_id_in)`
- Sets `onboarding_imports_eligible = false` permanently

### `mobile_effective_is_pro(is_pro, pro_expires_at)`
- Pro + 3-day grace

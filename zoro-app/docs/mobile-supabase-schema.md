# Mobile Supabase schema (applied via MCP)

Last applied: `drop_duplicate_mobile_consume_import` (after `mobile_onboarding_imports_and_cloud_consent`)

## Tables

### `mobile_devices`
- `device_id` (PK), `platform`, `app_version`, `build_number`, `last_seen_at`, `created_at`

### `mobile_entitlements`
- `device_id` (PK, FK → mobile_devices)
- `is_pro`, `pro_expires_at`, `credits_balance`
- `free_ai_month_key`, `free_ai_used` — monthly free import
- `onboarding_imports_used`, `onboarding_imports_eligible` — one-time setup pool (20 max)
- `updated_at`

### `mobile_ai_consents`
- PK (`device_id`, `provider`) — providers include `zoroCloud`, `appleFoundation`, etc.
- `consented_at`, `revoked_at` (opt-out), `privacy_policy_version`, `app_version`, `platform`
- RLS enabled; service role only from app API

## RPCs

### `mobile_consume_import(device_id_in, kind_in, onboarding_phase_in default false)`
- Pro: unlimited
- Setup phase (`onboarding_phase_in=true` + eligible): uses onboarding pool (20)
- Else: 1 free/month, then 1 credit per import (all kinds)

### `mobile_finish_onboarding_imports(device_id_in)`
- Sets `onboarding_imports_eligible = false` permanently

### `mobile_effective_is_pro(is_pro, pro_expires_at)`
- Pro + 3-day grace

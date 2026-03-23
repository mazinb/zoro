# Nag API

## Sign-in & onboarding (no token yet)

### `POST /api/auth/nag-email-check`

**Body:** `{ "email": "string" }`

**Response 200:** `{ "registered": true | false }` — whether `users` already has this email. Does not send email.

### `POST /api/auth/nag-request-link`

**Body:** `{ "email": "string", "name"?: "string" }`

- If the email **exists**: sends the Nags magic link (same as a logged-in magic link). `name` is ignored.
- If the email is **new**: `name` is **required**; creates a `users` row (and `user_data` with `name`), then sends the link.

**Response 200:** `{ "success": true, "created": true | false }` (`created` true when a new user row was inserted).

**Errors:** `400` invalid email or missing name for new users; `502` email send failure.

---

All other user routes require a link token (`users.verification_token` or `user_data.user_token`) resolved via `resolveTokenToUserId`.

**Invalid or unknown tokens** return **401 Unauthorized** (not 404), so you can tell them apart from a missing HTTP route.

## `POST /api/nag-parse`

Parses free-text into a schedule draft using OpenAI (`OPENAI_API_KEY`). The model is told the user’s **`users.timezone`** so `time_hhmm` is interpreted in local wall time. Falls back to defaults if the key is missing or the call fails (without service role, the prompt uses **UTC**).

This route lives at **`/api/nag-parse`** (not under `/api/nags/parse`) so it is never mistaken for `/api/nags/[id]` with `id=parse`.

_(The older path `/api/nags/parse` was removed for that reason.)_

**Body (JSON):**

```json
{
  "token": "string",
  "text": "Remind me to file GST every month on the 15th at 10am until 2026-12-31",
  "default_channel": "email"
}
```

`default_channel` optional: `email` | `whatsapp` (default `email`).

**Response 200:**

```json
{
  "draft": {
    "message": "File GST",
    "channel": "email",
    "frequency": "monthly",
    "time_hhmm": "10:00",
    "day_of_week": null,
    "day_of_month": 15,
    "end_type": "until_date",
    "until_date": "2026-12-31",
    "occurrences_max": null,
    "parse_fallback": false
  }
}
```

`parse_fallback: true` when OpenAI was not used or failed.

---

## `GET /api/nags?token=...`

**Query:**

- `token` (required)
- `status` optional: `active` | `archived` | `cancelled` | `all` (default `active`). **`all`** returns **active + archived** only (excludes `cancelled`).

**Response 200:**

```json
{
  "nags": [ { "...row..." } ],
  "profile": { "email": "user@example.com", "timezone": "America/New_York" }
}
```

`timezone` is the user’s IANA zone from `users.timezone` (default `UTC`).

---

## `PATCH /api/nag-profile`

Updates **`users.timezone`** and recomputes **`next_at`** for every **active** nag for that user.

**Body (JSON):**

```json
{
  "token": "string",
  "timezone": "America/Los_Angeles"
}
```

**Response 200:** `{ "timezone": "America/Los_Angeles" }`

**Errors:** `400` if timezone is missing or not a valid IANA id; `401` invalid token; `503` missing service role.

---

## `POST /api/nags`

Creates a nag; sends a confirmation email to `users.email` when `channel` is `email` and Resend is configured.

**Body:**

```json
{
  "token": "string",
  "message": "string",
  "channel": "email",
  "frequency": "daily|weekly|monthly|once",
  "time_hhmm": "17:00",
  "day_of_week": 4,
  "day_of_month": null,
  "end_type": "forever|until_date|occurrences",
  "until_date": "2026-12-31",
  "occurrences_max": 10
}
```

- `day_of_week`: ISO-style **0 = Monday … 6 = Sunday** (weekly only).
- `day_of_month`: 1–31 (monthly only).
- For `end_type: occurrences`, set `occurrences_max` ≥ 1.
- For `until_date`, use `YYYY-MM-DD`.

**Response 201:** created row.

---

## `PATCH /api/nags/:id`

**Body:** `token` plus any updatable fields (`message`, `channel`, `frequency`, `time_hhmm`, `day_of_week`, `day_of_month`, `end_type`, `until_date`, `occurrences_max`, `status`).

When schedule fields change, `next_at` is recomputed. Setting `status` to `archived` or `cancelled` stops cron delivery.

---

## `DELETE /api/nags/:id?token=...`

Soft-cancel: sets `status` to `cancelled`.

---

## `GET | POST /api/cron/nags`

**Auth:** `Authorization: Bearer <NAG_DISPATCH_KEY>` only (no query-string secret).

If `NAG_DISPATCH_KEY` is unset, the route returns **503**.

**Behavior:** For each due `nags` row (`status = active`, `channel = email`, `next_at <= now()`), sends the nag email via Resend, updates `last_sent_at`, advances `next_at` or completes the series (`occurrences_remaining`) or archives one-shot / past-`until_date` nags.

**Monitoring:** Each invocation inserts a row into **`nag_dispatch_runs`** (`ok`, `checked`, `sent`, `failed`, `error`, timestamps). Schedule the job from **Supabase Cron** — see [supabase-cron.md](./supabase-cron.md).

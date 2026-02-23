# Cron / follow-up service reference

This document describes how an **external** cron or follow-up service should use the `reminders` table. The Zoro app does not run reminder delivery itself; it only creates rows via `POST /api/reminders`.

## Table: `reminders`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (generated). |
| `user_id` | uuid | Optional; links to `users.id`. |
| `user_key` | text | **Required.** Used for building the check-in link. In practice this is the user’s `users.verification_token`. The app sets this when creating a reminder so the cron can resolve the link without touching `users` if desired. |
| `scheduled_at` | timestamptz | When the reminder should be sent. |
| `description` | text | Short label (e.g. "Update income", "Review assets"). |
| `context` | text | One of: `income`, `assets`, `expenses`. Use to build the correct URL (e.g. `/income?token=...`, `/assets?token=...`, `/expenses?token=...`). |
| `recurrence` | text | Recurrence pattern: `monthly:DD` (day 1–31), `quarterly:W` (week 1–4 of quarter), or `annually:M` (month 1–12). Used to compute the next `scheduled_at` after each send. |
| `priority` | text | Optional; reserved for future use. |
| `status` | text | `pending` (default), `sent`, or other values your service uses. |
| `created_at` | timestamptz | Set on insert. |
| `updated_at` | timestamptz | Set on insert/update. |
| `sent_at` | timestamptz | Optional; set when the reminder is actually sent. |
| `created_from_email_id` | uuid | Optional; for email-origin reminders. |

## How the app creates reminders

- **Endpoint:** `POST /api/reminders`
- **Body:** `token`, `description`, `context` (`income` \| `assets` \| `expenses`), and recurrence params:
  - **Monthly:** `recurrence: "monthly"`, `recurrence_day`: 1–31 (day of month).
  - **Quarterly:** `recurrence: "quarterly"`, `recurrence_week`: 1–4 (week of quarter).
  - **Annually:** `recurrence: "annually"`, `recurrence_month`: 1–12 (month).
- The API computes the first `scheduled_at` (next occurrence at 09:00) and stores `recurrence` as e.g. `monthly:15`, `quarterly:2`, `annually:6`.

## What the cron service should do

1. **Poll** (or use Supabase realtime if preferred) for rows where:
   - `status = 'pending'`
   - `scheduled_at <= now()` (or within a short window to allow for clock skew).

2. **Build the link** for each reminder:
   - Base URL + path by `context`:
     - `income` → `/income?token={user_key}`
     - `assets` → `/assets?token={user_key}`
     - `expenses` → `/expenses?token={user_key}`
   - Use `user_key` as the `token` query param (same value the app stored from `users.verification_token`).

3. **Send** the reminder (email, push, etc.) including the link and optionally `description`.

4. **Update** the row for **recurring** reminders:
   - If `recurrence` is set (e.g. `monthly:15`, `quarterly:2`, `annually:6`): compute the **next** occurrence from the same rules (next month on that day, next quarter that week, next year that month), set `scheduled_at` to that time, and leave `status = 'pending'` so the reminder runs again. Set `sent_at = now()` (and optionally append to a log).
   - If `recurrence` is empty or `once`: set `status = 'sent'`, `sent_at = now()`, and do not reschedule.

No cron or follow-up logic lives in the Zoro app; all scheduling and delivery is the responsibility of this external service.

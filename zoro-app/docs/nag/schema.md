# `nags` table

Applied via Supabase migration **`create_nags_table`** (`apply_migration`). Includes `set_nags_updated_at` trigger for `updated_at`.

## Columns

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK | `REFERENCES users(id) ON DELETE CASCADE` |
| `message` | text | |
| `channel` | text | `email` \| `whatsapp` |
| `frequency` | text | `daily` \| `weekly` \| `monthly` \| `once` |
| `time_hhmm` | text | `HH:MM` (24h), wall time in the user’s **`users.timezone`** (IANA, default `UTC`) |
| `day_of_week` | smallint | 0–6, **0 = Monday … 6 = Sunday**; null if N/A |
| `day_of_month` | smallint | 1–31; null if N/A |
| `end_type` | text | `forever` \| `until_date` \| `occurrences` |
| `until_date` | date | |
| `occurrences_max` | int | |
| `occurrences_remaining` | int | Decremented after each send when `end_type = occurrences` |
| `status` | text | `active` \| `archived` \| `cancelled` |
| `next_at` | timestamptz | Next scheduled send (email cron) |
| `last_sent_at` | timestamptz | |
| `nag_until_done` | boolean | Follow-up emails until user marks done (email channel) |
| `followup_interval_hours` | smallint | Hours between follow-ups; null = default from frequency |
| `linked_domain` | text | Optional link domain: `wealth` or `goal` |
| `linked_key` | text | Optional linked item key (`expenses`,`income`,`assets`,`save`,`home`,`invest`,`insurance`,`tax`,`retire`) |
| `linked_label` | text | Optional UI label for the linked item |
| `linked_path` | text | Optional app path for deep-linking (must start with `/`) |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` |

## Indexes

- `(user_id, status)`
- Partial on `next_at` where `status = 'active' AND channel = 'email'`

## RLS

`ENABLE ROW LEVEL SECURITY` with **no** policies for `anon` / `authenticated`. Application code uses the **service role** client only after validating the user token in Next.js API routes.

---

# `nag_dispatch_runs` table

Migration **`nag_dispatch_runs_monitoring`**. One row per **`/api/cron/nags`** run for operations monitoring.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `started_at` | timestamptz | When the handler began |
| `finished_at` | timestamptz | When the handler finished |
| `ok` | boolean | Handler completed without uncaught error |
| `checked` | int | Due nags considered |
| `sent` | int | Emails accepted by Resend |
| `failed` | int | Skipped or send failures |
| `error` | text | Set when `ok = false` |
| `source` | text | default `next_api` |

## RLS

Enabled with **no** policies for `anon` / `authenticated`. Inserts use the **service role** from Next.js. Query in the Supabase SQL Editor as project owner.

---

# `reminders` table (main-site, wealth pages)

Separate from **`nags`**: stores recurring check-in rows for `/income`, `/assets`, `/expenses` via **`/api/reminders`**.

- **GET** `?token=` — list rows for the user.
- **POST** — create (body: `token`, `description`, `context`, `recurrence`, …).
- **DELETE** `?token=&id=` — delete one row (owner-scoped).

For **email / WhatsApp / webhook** schedules, users use **Nags** (`nags` table + `/api/nags`).
